"""
backend/aggregator.py
Takes a list of sentiment prediction results and aggregates them into
a structured summary report.

Produces:
    - Positive / Neutral / Negative percentage breakdown
    - Overall verdict string
    - Top keywords per sentiment group
    - Sample opinions (best-scoring posts per class)
    - Raw counts

Usage:
    from backend.aggregator import SentimentAggregator
    agg    = SentimentAggregator()
    report = agg.aggregate(items_with_predictions)
"""

import re
import logging
from collections import Counter

log = logging.getLogger("SentiStream.aggregator")


class SentimentAggregator:
    """
    Aggregate a list of predicted items into a readable report dict.

    Input: list of dicts, each containing:
        text   — original text
        label  — "Positive" | "Negative" | "Neutral"
        score  — Reddit upvote score (used for ranking)
        probabilities — { "Positive": float, ... }

    Output: a single report dict (see aggregate() docstring).
    """

    # Words that are too generic to be useful as "common keywords"
    _BORING = {
        "this", "that", "with", "have", "from", "they", "will", "been",
        "more", "also", "just", "very", "really", "much", "even", "than",
        "like", "about", "would", "could", "should", "when", "what",
        "there", "their", "your", "just", "into", "over", "after",
        "because", "though", "while", "still", "does", "did", "has",
        "not", "all", "any", "some", "its", "but", "for", "the", "and",
        "are", "was", "were", "had", "him", "her", "his", "she", "out",
        "who", "how", "our", "use", "used", "using", "get", "got",
    }

    def __init__(
        self,
        top_keywords:    int = 10,
        sample_opinions: int = 3,
        min_word_len:    int = 4,
    ):
        """
        Args:
            top_keywords    : How many common keywords to include per group.
            sample_opinions : How many example opinions to include per group.
            min_word_len    : Minimum character length to consider a keyword.
        """
        self.top_keywords    = top_keywords
        self.sample_opinions = sample_opinions
        self.min_word_len    = min_word_len

    # ── Internal helpers ──────────────────────────────────────────

    def _verdict(self, pos_pct: float, neg_pct: float, neu_pct: float) -> str:
        """
        Generate a plain-English verdict from sentiment percentages.

        Thresholds:
            ≥ 70% positive → Very Positive
            ≥ 55% positive → Mostly Positive
            ≥ 70% negative → Very Negative
            ≥ 55% negative → Mostly Negative
            Otherwise      → Mixed / Neutral
        """
        if pos_pct >= 70:
            return "Very Positive"
        elif pos_pct >= 55:
            return "Mostly Positive"
        elif neg_pct >= 70:
            return "Very Negative"
        elif neg_pct >= 55:
            return "Mostly Negative"
        elif neu_pct >= 50:
            return "Mostly Neutral"
        else:
            return "Mixed Opinions"

    def _extract_keywords(self, texts: list) -> list:
        """
        Find the most common meaningful words across a list of texts.

        Steps:
            1. Concatenate all texts
            2. Remove non-alpha characters
            3. Split into words
            4. Filter by length + boring-word list
            5. Return top N by frequency
        """
        word_counts: Counter = Counter()
        for text in texts:
            if not isinstance(text, str):
                continue
            words = re.sub(r"[^a-z\s]", " ", text.lower()).split()
            for w in words:
                if len(w) >= self.min_word_len and w not in self._BORING:
                    word_counts[w] += 1

        return [word for word, _ in word_counts.most_common(self.top_keywords)]

    def _top_opinions(self, items: list) -> list:
        """
        Return the best sample opinions sorted by Reddit score (upvotes).
        Falls back to confidence score if Reddit score is unavailable.
        """
        # Sort by upvote score descending
        sorted_items = sorted(
            items,
            key=lambda x: x.get("score", 0),
            reverse=True,
        )

        seen = set()
        opinions = []
        for item in sorted_items:
            text = str(item.get("text", "")).strip()
            # Truncate long texts for display
            display = text[:200] + "…" if len(text) > 200 else text
            if display not in seen and display:
                seen.add(display)
                opinions.append({
                    "text":      display,
                    "score":     item.get("score", 0),
                    "subreddit": item.get("subreddit", ""),
                    "url":       item.get("url", ""),
                })
            if len(opinions) >= self.sample_opinions:
                break

        return opinions

    # ── Public API ────────────────────────────────────────────────

    def aggregate(self, items: list) -> dict:
        """
        Aggregate a list of sentiment-predicted items into a report.

        Args:
            items : List of dicts. Each must have:
                      text       — original text
                      label      — "Positive" | "Negative" | "Neutral"
                      score      — Reddit upvote score
                      url        — post URL
                      subreddit  — subreddit name

        Returns:
            dict with keys:
                total            — int: total items analysed
                counts           — dict: { Positive: N, Negative: N, Neutral: N }
                percentages      — dict: { Positive: %, Negative: %, Neutral: % }
                verdict          — str: e.g. "Mostly Positive"
                keywords         — dict: { Positive: [...], Negative: [...], Neutral: [...] }
                top_opinions     — dict: { Positive: [...], Negative: [...], Neutral: [...] }
                all_keywords     — list: top keywords across ALL items
        """
        if not items:
            return {
                "total":        0,
                "counts":       {"Positive": 0, "Negative": 0, "Neutral": 0},
                "percentages":  {"Positive": 0.0, "Negative": 0.0, "Neutral": 0.0},
                "verdict":      "No Data",
                "keywords":     {"Positive": [], "Negative": [], "Neutral": []},
                "top_opinions": {"Positive": [], "Negative": [], "Neutral": []},
                "all_keywords": [],
            }

        # ── Split by label ────────────────────────────────────────
        groups = {"Positive": [], "Negative": [], "Neutral": []}
        for item in items:
            label = item.get("label", "Neutral")
            if label in groups:
                groups[label].append(item)
            else:
                groups["Neutral"].append(item)

        total = len(items)
        counts = {k: len(v) for k, v in groups.items()}

        percentages = {
            k: round(v / total * 100, 1)
            for k, v in counts.items()
        }

        # ── Verdict ────────────────────────────────────────────────
        verdict = self._verdict(
            percentages["Positive"],
            percentages["Negative"],
            percentages["Neutral"],
        )

        # ── Keywords per group ─────────────────────────────────────
        keywords = {
            k: self._extract_keywords([i["text"] for i in v])
            for k, v in groups.items()
        }

        # ── Keywords across all items ──────────────────────────────
        all_keywords = self._extract_keywords([i["text"] for i in items])

        # ── Top opinions per group ─────────────────────────────────
        top_opinions = {
            k: self._top_opinions(v)
            for k, v in groups.items()
        }

        return {
            "total":        total,
            "counts":       counts,
            "percentages":  percentages,
            "verdict":      verdict,
            "keywords":     keywords,
            "top_opinions": top_opinions,
            "all_keywords": all_keywords,
        }
