"""
backend/analyzer.py
SentimentAnalyzer — the main orchestrator that wires everything together.

This is the single entry point your frontend (Streamlit, CLI, API)
calls. It handles:
    1. Fetching live Reddit data (or using MockFetcher for testing)
    2. Batch-predicting sentiment for each item
    3. Aggregating results into a report
    4. Returning the final report dict

Usage:
    from backend.analyzer import SentimentAnalyzer

    analyzer = SentimentAnalyzer(use_mock=False)   # real Reddit
    report   = analyzer.analyze("electric vehicles")
    print(report["verdict"])          # "Mostly Positive"
    print(report["percentages"])      # {"Positive": 72.1, ...}
"""

import logging

from backend.config       import cfg
from backend.cleaner      import TextCleaner
from backend.model_loader import ModelLoader
from backend.predictor    import Predictor
from backend.aggregator   import SentimentAggregator
from backend.reddit_fetcher import RedditFetcher, MockRedditFetcher

log = logging.getLogger("SentiStream.analyzer")


class SentimentAnalyzer:
    """
    Main orchestrator — one method call to go from keyword → full report.

    Workflow:
        analyze(query)
            │
            ├─ RedditFetcher.fetch(query)        → raw Reddit items
            ├─ Predictor.predict_batch(texts)    → labels + probabilities
            ├─ merge predictions back into items
            └─ SentimentAggregator.aggregate()   → final report dict

    Parameters:
        use_mock : bool — if True, use MockRedditFetcher instead of
                   real Reddit API. Useful for development/testing.
    """

    def __init__(
        self,
        use_mock:        bool = False,
        model_path:      str  = None,
        vectorizer_path: str  = None,
    ):
        """
        Args:
            use_mock        : True = synthetic data, False = live Reddit.
            model_path      : Override default model .pkl path.
            vectorizer_path : Override default vectorizer .pkl path.
        """
        # ── Text cleaner ──────────────────────────────────────────
        self.cleaner = TextCleaner()

        # ── Model loader ──────────────────────────────────────────
        self.loader = ModelLoader(
            model_path      = model_path      or cfg.MODEL_PATH,
            vectorizer_path = vectorizer_path or cfg.VECTORIZER_PATH,
        )

        # ── Predictor ─────────────────────────────────────────────
        self.predictor = Predictor(loader=self.loader, cleaner=self.cleaner)

        # ── Reddit fetcher ────────────────────────────────────────
        if use_mock:
            log.info("Using MockRedditFetcher (no API credentials needed).")
            self.fetcher = MockRedditFetcher()
        else:
            if not cfg.validate_reddit_creds():
                log.warning(
                    "No Reddit credentials found — falling back to MockFetcher.\n"
                    "To use real Reddit data: copy .env.example → .env and fill in your keys."
                )
                self.fetcher = MockRedditFetcher()
            else:
                self.fetcher = RedditFetcher(
                    client_id=cfg.REDDIT_CLIENT_ID,
                    client_secret=cfg.REDDIT_CLIENT_SECRET,
                    user_agent=cfg.REDDIT_USER_AGENT,
                )

        # ── Aggregator ────────────────────────────────────────────
        self.aggregator = SentimentAggregator(
            top_keywords    = cfg.TOP_KEYWORDS,
            sample_opinions = cfg.SAMPLE_OPINIONS,
        )

    # ── Public API ────────────────────────────────────────────────

    def analyze(
        self,
        query: str,
        limit: int = None,
    ) -> dict:
        """
        Full pipeline: fetch → predict → aggregate → return report.

        Args:
            query : Keyword or topic to search, e.g. "electric vehicles"
            limit : Max posts to fetch (overrides config if set)

        Returns:
            report dict with keys:
                query        — the original search query
                total        — number of items analysed
                counts       — { Positive: N, ... }
                percentages  — { Positive: %, ... }
                verdict      — plain-English summary string
                keywords     — { Positive: [...], Negative: [...], Neutral: [...] }
                all_keywords — top keywords across all items
                top_opinions — { Positive: [...], Negative: [...], Neutral: [...] }
                raw_items    — full list of items with predictions attached
        """
        if not query or not query.strip():
            return {"error": "Query cannot be empty.", "query": query}

        query = query.strip()
        fetch_limit = limit or cfg.REDDIT_POST_LIMIT

        log.info('=== analyze(query="%s", limit=%d) ===', query, fetch_limit)

        # ── Step 1: Fetch from Reddit ─────────────────────────────
        try:
            raw_items = self.fetcher.fetch(
                query             = query,
                limit             = fetch_limit,
                comments_per_post = cfg.REDDIT_COMMENTS_PER_POST,
                sort              = cfg.REDDIT_SORT,
                time_filter       = cfg.REDDIT_TIME_FILTER,
            )
        except Exception as exc:
            log.error("Fetch failed: %s", exc)
            return {"error": f"Reddit fetch failed: {exc}", "query": query}

        if not raw_items:
            return {
                "error":   "No Reddit posts found for this query.",
                "query":   query,
                "total":   0,
            }

        log.info("Fetched %d items. Running sentiment analysis …", len(raw_items))

        # ── Step 2: Batch predict ─────────────────────────────────
        texts       = [item["text"] for item in raw_items]
        predictions = self.predictor.predict_batch(texts)

        # ── Step 3: Merge predictions into items ──────────────────
        enriched = []
        for item, pred in zip(raw_items, predictions):
            merged = {**item, **pred}   # combine both dicts
            enriched.append(merged)

        # ── Step 4: Aggregate ─────────────────────────────────────
        report = self.aggregator.aggregate(enriched)

        # ── Step 5: Add metadata ──────────────────────────────────
        report["query"]     = query
        report["raw_items"] = enriched

        log.info(
            'Analysis complete: %s  (pos=%.1f%% neg=%.1f%% neu=%.1f%%)',
            report["verdict"],
            report["percentages"].get("Positive", 0),
            report["percentages"].get("Negative", 0),
            report["percentages"].get("Neutral",  0),
        )

        return report

    def predict_single(self, text: str) -> dict:
        """
        Quick single-text prediction without any Reddit fetching.

        Useful for testing or validating specific sentences.

        Returns:
            dict with label and probabilities.
        """
        return self.predictor.predict(text)
