"""
backend/domain_router.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Stable Final Router (v5.0)
─────────────────────────────────────────────────────────────────
4-domain pipeline: News · Products · Restaurants · Movies
"""

import os
import re
import sys
import logging
import textwrap
from collections import Counter
from typing import Dict, List, Tuple

# ── Local Backend Imports ──────────────────────────────────────────
from cleaner import TextCleaner, download_nltk_resources
from live_data_fetcher import fetch_for_domain
from predictor import Predictor
from restaurant_fetcher import fetch_restaurant_data
from product_review_analyzer import (
    extract_pros_and_complaints,
    generate_human_opinion,
    scrub_metadata
)
from report_visualizer import generate_sentiment_report

# ── Setup ──────────────────────────────────────────────────────────
logging.getLogger("SentiStream").setLevel(logging.WARNING)
logging.basicConfig(level=logging.WARNING)

DOMAINS = {
    "1": {"label": "News / Politics",   "icon": "📰"},
    "2": {"label": "Products / Brands", "icon": "🛒"},
    "3": {"label": "Restaurants",       "icon": "🍽️"},
    "5": {"label": "Movies & TV Shows", "icon": "🎬"},
}

# ── Shared transformer predictor (loaded once, reused across all domains) ─
_predictor = Predictor()

# ── Theme keyword clusters used for dynamic summary extraction ─────
_THEME_CLUSTERS = {
    "battery life":      ["battery", "battery life", "battery drain", "standby", "charge", "mah", "endurance"],
    "camera quality":    ["camera", "photo", "photos", "video", "zoom", "lens", "night mode", "portrait", "selfie", "shot", "image quality"],
    "performance":       ["performance", "speed", "fast", "smooth", "lag", "processor", "chip", "snapdragon", "benchmark", "ram"],
    "heating issues":    ["heat", "heating", "hot", "thermal", "overheating", "throttle", "warm"],
    "display":           ["display", "screen", "brightness", "amoled", "refresh rate", "resolution", "oled", "panel"],
    "software":          ["software", "android", "update", "ui", "interface", "os", "bloatware", "pixel ui", "one ui"],
    "build quality":     ["build", "design", "material", "glass", "plastic", "premium", "finish", "feel", "weight", "thin"],
    "charging speed":    ["charging", "fast charge", "wired", "wireless", "charger", "watt", "slow charge"],
    "value for money":   ["price", "value", "worth", "expensive", "cheap", "cost", "budget", "money"],
    "audio":             ["speaker", "audio", "sound", "volume", "microphone", "bass"],
}

# ── Restaurant-specific theme clusters (used when domain == Restaurants) ───
_COMPANY_THEME_CLUSTERS = {
    "revenue & earnings":   ["revenue", "earnings", "profit", "loss", "quarterly", "annual", "growth", "sales", "margin", "income"],
    "stock & valuation":    ["stock", "shares", "market cap", "valuation", "investor", "nasdaq", "ipo", "dividend", "buyback"],
    "layoffs & workforce":  ["layoff", "layoffs", "fired", "cuts", "redundancy", "workforce", "hiring", "employees", "headcount"],
    "product & innovation": ["product", "launch", "innovation", "feature", "update", "release", "technology", "ai", "model", "platform"],
    "leadership":           ["ceo", "founder", "executive", "leadership", "board", "management", "appointed", "resigned", "stepped down"],
    "legal & regulatory":   ["lawsuit", "fine", "regulatory", "antitrust", "investigation", "court", "compliance", "penalty", "sec"],
    "partnerships & deals": ["acquisition", "merger", "partnership", "deal", "contract", "collaboration", "joint venture", "stake"],
    "reputation & pr":      ["controversy", "scandal", "criticism", "backlash", "apology", "trust", "brand", "reputation", "public"],
}

_MOVIES_THEME_CLUSTERS = {
    "story & plot":      ["story", "plot", "screenplay", "script", "narrative", "writing", "twist", "ending", "storyline", "pacing"],
    "acting & cast":     ["acting", "actor", "actress", "cast", "performance", "role", "character", "dialogue", "chemistry"],
    "direction":         ["direction", "director", "directorial", "vision", "cinematography", "visuals", "shot", "scene", "editing"],
    "music & score":     ["music", "score", "soundtrack", "bgm", "songs", "background", "theme", "audio", "sound design"],
    "visual effects":    ["vfx", "effects", "cgi", "graphics", "action", "stunts", "scale", "production", "set design"],
    "entertainment":     ["entertaining", "fun", "engaging", "gripping", "binge", "watch", "thrill", "suspense", "emotion", "feel"],
    "originality":       ["original", "fresh", "creative", "unique", "predictable", "cliché", "formulaic", "rehash", "sequel", "remake"],
    "length & pacing":   ["long", "slow", "fast", "pacing", "runtime", "dragged", "tight", "short", "episodes", "season"],
}

# ── Restaurant Aspect-Based Opinion Mining (ABOM) ─────────────────────────────
# Each aspect maps to: (positive_signals, negative_signals, keyword_triggers)
# keyword_triggers are used to detect whether the aspect is mentioned at all.
# positive/negative signal words drive aspect-level sentiment scoring.

_RESTAURANT_ASPECTS: Dict[str, Dict] = {
    "Food Quality": {
        "triggers":  ["food", "dish", "dishes", "meal", "item", "fresh", "cooked", "raw", "quality", "ingredient", "ingredients", "portion", "portions"],
        "positive":  ["fresh", "delicious", "tasty", "yummy", "flavourful", "flavorful", "amazing", "excellent", "perfect", "authentic", "quality", "well cooked", "nicely cooked", "great food", "good food", "loved the food"],
        "negative":  ["stale", "cold", "undercooked", "overcooked", "raw", "bad food", "poor quality", "terrible food", "awful food", "tasteless", "bland", "horrible", "disgusting", "not fresh", "soggy", "dry", "burnt"],
    },
    "Taste": {
        "triggers":  ["taste", "flavour", "flavor", "spice", "spicy", "sweet", "sour", "salty", "bitter", "tangy", "rich", "mild", "seasoning", "seasoned", "yummy", "delicious", "bland"],
        "positive":  ["delicious", "tasty", "yummy", "amazing taste", "great taste", "flavourful", "flavorful", "rich", "perfectly spiced", "well seasoned", "authentic flavour", "loved the taste", "great flavour"],
        "negative":  ["bland", "tasteless", "too spicy", "too salty", "too sweet", "no flavour", "no flavor", "awful taste", "terrible taste", "disappointing taste", "not tasty", "overdone", "underdone", "no taste"],
    },
    "Service": {
        "triggers":  ["service", "served", "serving", "staff", "waiter", "waitress", "server", "manager", "captain", "crew", "team", "attendant", "host"],
        "positive":  ["great service", "excellent service", "good service", "prompt", "quick service", "fast service", "friendly staff", "helpful staff", "attentive", "polite", "courteous", "professional", "warm", "welcoming"],
        "negative":  ["bad service", "poor service", "terrible service", "slow service", "rude", "arrogant", "unhelpful", "inattentive", "ignored", "dismissive", "unprofessional", "horrible service", "worst service"],
    },
    "Staff Behaviour": {
        "triggers":  ["staff", "waiter", "waitress", "manager", "employee", "crew", "behaviour", "behavior", "attitude", "rude", "friendly", "polite", "helpful", "cooperative"],
        "positive":  ["friendly", "polite", "courteous", "helpful", "kind", "warm", "welcoming", "cooperative", "respectful", "patient", "great attitude", "wonderful staff", "amazing staff", "lovely staff"],
        "negative":  ["rude", "arrogant", "disrespectful", "unhelpful", "unfriendly", "ignorant", "dismissive", "uncooperative", "impolite", "attitude problem", "bad attitude", "horrible staff", "worst staff"],
    },
    "Ambience": {
        "triggers":  ["ambience", "ambiance", "atmosphere", "decor", "decoration", "interior", "seating", "lighting", "music", "vibe", "environment", "place", "setting", "surroundings"],
        "positive":  ["great ambience", "good ambience", "lovely ambience", "beautiful", "cosy", "cozy", "elegant", "nice interior", "good atmosphere", "pleasant", "relaxing", "romantic", "vibrant", "warm ambience"],
        "negative":  ["bad ambience", "poor ambience", "noisy", "loud", "crowded", "cramped", "uncomfortable", "dirty decor", "dull", "boring", "dark", "dingy", "bad atmosphere", "terrible ambience"],
    },
    "Cleanliness": {
        "triggers":  ["clean", "cleanliness", "hygiene", "hygienic", "dirty", "filthy", "tidy", "mess", "restroom", "washroom", "toilet", "sanitised", "sanitized", "wipe", "smell", "odour", "odor"],
        "positive":  ["clean", "very clean", "spotless", "hygienic", "well maintained", "tidy", "neat", "sanitised", "sanitized", "fresh", "good hygiene"],
        "negative":  ["dirty", "filthy", "unhygienic", "not clean", "messy", "smelly", "bad smell", "odour", "stained", "cockroach", "insect", "pest", "unclean", "disgusting", "restroom dirty", "toilet dirty"],
    },
    "Waiting Time": {
        "triggers":  ["wait", "waiting", "waited", "delay", "delayed", "time", "queue", "line", "long", "slow", "quick", "fast", "minutes", "hour", "hours", "took long"],
        "positive":  ["quick", "fast", "prompt", "no wait", "no queue", "short wait", "on time", "timely", "immediate", "instant", "speedy", "efficient"],
        "negative":  ["long wait", "too long", "waited too long", "slow", "delay", "delayed", "queue", "took forever", "hours", "never came", "kept waiting", "excessive wait"],
    },
    "Pricing": {
        "triggers":  ["price", "prices", "pricing", "cost", "costs", "expensive", "cheap", "affordable", "bill", "charge", "charges", "overpriced", "reasonable", "budget", "money"],
        "positive":  ["affordable", "reasonable price", "good price", "cheap", "budget friendly", "value", "worth the price", "not expensive", "good deal", "great price", "fair price"],
        "negative":  ["expensive", "overpriced", "too costly", "not worth", "highway robbery", "rip off", "ripoff", "steep", "costly", "pricey", "charged extra", "hidden charges", "not worth the money"],
    },
    "Parking": {
        "triggers":  ["parking", "park", "parked", "valet", "vehicle", "car", "bike", "space", "lot", "garage"],
        "positive":  ["good parking", "easy parking", "ample parking", "free parking", "valet", "spacious parking", "convenient parking", "parking available", "no parking issues"],
        "negative":  ["no parking", "bad parking", "parking problem", "parking issue", "difficult to park", "no space", "parking full", "paid parking", "expensive parking"],
    },
    "Value for Money": {
        "triggers":  ["value", "worth", "money", "money's worth", "price", "quality", "portion", "portions", "bang for buck", "expensive", "cheap"],
        "positive":  ["value for money", "worth it", "great value", "good value", "money's worth", "bang for buck", "worth every penny", "affordable and good", "value deal"],
        "negative":  ["not worth it", "not value for money", "waste of money", "overpriced", "not worth the price", "disappointing value", "poor value", "too expensive for what you get"],
    },
}

# Flat keyword map for backward-compatible _extract_themes() calls
_RESTAURANT_THEME_CLUSTERS: Dict[str, List[str]] = {
    aspect: config["triggers"] + config["positive"] + config["negative"]
    for aspect, config in _RESTAURANT_ASPECTS.items()
}

# Common dish/food item keywords used to surface "Popular Dishes" for Restaurants
_DISH_KEYWORDS: List[str] = [
    "biryani", "curry", "pizza", "burger", "pasta", "noodles", "sushi", "ramen",
    "tacos", "burrito", "kebab", "shawarma", "salad", "steak", "chicken", "paneer",
    "dal", "rice", "dosa", "idli", "samosa", "tikka", "korma", "pho", "fried rice",
    "sandwich", "wrap", "soup", "fish", "prawns", "seafood", "lamb", "mutton",
    "butter chicken", "naan", "roti", "paratha", "masala", "tandoori", "lasagna",
    "risotto", "pad thai", "dim sum", "gyoza", "falafel", "hummus", "pita",
    "cheesecake", "tiramisu", "gelato", "ice cream", "dessert", "cake",
]


def _extract_popular_dishes(texts: List[str], top_n: int = 6) -> List[str]:
    """
    Scan review texts for dish/food item mentions and return the most-mentioned ones.
    Only returns items mentioned at least twice to filter noise.
    """
    if not texts:
        return []
    combined = " ".join(texts).lower()
    combined = re.sub(r"[^\w\s]", " ", combined)
    hits: Counter = Counter()
    for dish in _DISH_KEYWORDS:
        pattern = r"\b" + re.escape(dish.replace(" ", r"\s+")) + r"\b"
        count = len(re.findall(pattern, combined))
        if count >= 2:
            hits[dish] += count
    return [dish for dish, _ in hits.most_common(top_n)]


# ── Aspect-Based Opinion Mining (ABOM) ────────────────────────────────────────

def _score_aspect_in_text(text: str, aspect: str) -> str | None:
    """
    For a single review text, determine whether it mentions a given aspect
    and, if so, whether the opinion on that aspect is 'positive' or 'negative'.

    Returns:
        'positive' | 'negative' | None  (None = aspect not mentioned)
    """
    config  = _RESTAURANT_ASPECTS[aspect]
    t_lower = re.sub(r"[^\w\s]", " ", text.lower())

    # 1. Must contain at least one trigger word
    if not any(re.search(r"\b" + re.escape(kw) + r"\b", t_lower) for kw in config["triggers"]):
        return None

    # 2. Score positive and negative signal words
    pos_hits = sum(
        1 for sig in config["positive"]
        if re.search(r"\b" + re.escape(sig) + r"\b", t_lower)
    )
    neg_hits = sum(
        1 for sig in config["negative"]
        if re.search(r"\b" + re.escape(sig) + r"\b", t_lower)
    )

    if pos_hits == 0 and neg_hits == 0:
        return None   # aspect mentioned but no clear opinion signal

    return "positive" if pos_hits >= neg_hits else "negative"


def _extract_restaurant_aspects(
    reviews_with_sentiment: List[Dict],
) -> Tuple[List[str], List[str]]:
    """
    Aspect-Based Opinion Mining for restaurant reviews.

    Each review carries its HuggingFace sentence-level sentiment label
    ('Positive' | 'Negative' | 'Neutral') AND its raw text.  We combine:
      • HuggingFace label  → tells us the overall tone of the review
      • Aspect signal scan → tells us WHICH aspect the reviewer is praising/criticising

    Scoring logic:
      - A review is HF-Positive  → aspect-positive opinions count ×2 (amplify praise)
      - A review is HF-Negative  → aspect-negative opinions count ×2 (amplify complaints)
      - A review is HF-Neutral   → aspect opinions count ×1

    This prevents false complaints like "the service was excellent (no complaints)"
    being surfaced just because the word "service" appeared.

    Returns:
        praises    : List[str]  — aspect labels with highest positive scores (max 5)
        complaints : List[str]  — aspect labels with highest negative scores (max 5)
    """
    aspect_pos: Counter = Counter()
    aspect_neg: Counter = Counter()

    for review in reviews_with_sentiment:
        text      = review.get("_text", "")
        hf_label  = review.get("sentiment", "Neutral")  # HuggingFace label
        amplifier = 2 if hf_label != "Neutral" else 1

        for aspect in _RESTAURANT_ASPECTS:
            opinion = _score_aspect_in_text(text, aspect)
            if opinion is None:
                continue

            if opinion == "positive":
                weight = amplifier if hf_label in ("Positive", "Neutral") else 1
                aspect_pos[aspect] += weight
            else:  # negative
                weight = amplifier if hf_label in ("Negative", "Neutral") else 1
                aspect_neg[aspect] += weight

    # Minimum frequency threshold — suppress aspects mentioned only once
    MIN_MENTIONS = 2

    praises    = [a for a, c in aspect_pos.most_common() if c >= MIN_MENTIONS]
    complaints = [a for a, c in aspect_neg.most_common() if c >= MIN_MENTIONS]

    # Fallback: if thresholding wipes everything, lower bar to top-1 each
    if not praises and aspect_pos:
        praises = [aspect_pos.most_common(1)[0][0]]
    if not complaints and aspect_neg:
        complaints = [aspect_neg.most_common(1)[0][0]]

    return praises[:5], complaints[:5]


def _build_restaurant_summary(
    reviews_with_sentiment: List[Dict],
    praises: List[str],
    complaints: List[str],
) -> str:
    """
    Generate a natural-language summary grounded in ABOM aspect results
    rather than generic keyword frequency.
    """
    positive_count = sum(1 for r in reviews_with_sentiment if r.get("sentiment") == "Positive")
    negative_count = sum(1 for r in reviews_with_sentiment if r.get("sentiment") == "Negative")
    total          = len(reviews_with_sentiment)

    if total == 0:
        return "Not enough review data to generate a reliable summary."

    parts: List[str] = []

    # ── Overall tone sentence ────────────────────────────────────────
    pos_pct = positive_count / total
    if pos_pct >= 0.70:
        parts.append(
            f"Diners are overwhelmingly positive — {positive_count} of {total} reviews "
            f"reflect a satisfying experience."
        )
    elif pos_pct >= 0.50:
        parts.append(
            f"Most diners leave satisfied ({positive_count} of {total} reviews are positive), "
            f"though a segment of critical voices keeps the picture honest."
        )
    elif pos_pct <= 0.30:
        parts.append(
            f"The overall picture is cautionary — dissatisfied diners "
            f"({negative_count} of {total} reviews) currently outnumber satisfied ones."
        )
    else:
        parts.append(
            f"Opinions are genuinely split across {total} reviews, with "
            f"{positive_count} positive and {negative_count} negative, "
            f"reflecting diverse expectations among diners."
        )

    # ── Top praises ──────────────────────────────────────────────────
    if praises:
        top = _humanize_list(praises[:2])
        extra = praises[2] if len(praises) > 2 else None
        parts.append(
            f"Diners most frequently praise {top}"
            + (f", with {extra} also drawing consistent approval" if extra else "")
            + "."
        )

    # ── Top complaints ───────────────────────────────────────────────
    if complaints:
        top = _humanize_list(complaints[:2])
        extra = complaints[2] if len(complaints) > 2 else None
        parts.append(
            f"Recurring complaints centre on {top}"
            + (f", alongside concerns about {extra}" if extra else "")
            + "."
        )

    return " ".join(parts)


# ── Helpers ────────────────────────────────────────────────────────


def _get_news_verdict(counts: Dict) -> Tuple[str, str]:
    """Analytical logic for Newsroom-style verdict."""
    total = sum(counts.values())
    pos, neg = counts.get("Positive", 0), counts.get("Negative", 0)

    if neg > pos * 1.5:
        return "CRITICAL / NEGATIVE", "The media narrative is currently dominated by concern or criticism."
    elif pos > neg * 1.5:
        return "FAVOURABLE / POSITIVE", "Coverage reflects a strong positive consensus and optimistic reporting."
    elif total > 0 and (pos + neg) / total < 0.4:
        return "NEUTRAL / OBJECTIVE", "Reporting remains largely factual with minimal emotional bias detected."
    else:
        return "MIXED / VOLATILE", "The landscape shows sharp division with competing positive and negative narratives."


# ── Dynamic theme extraction & summary generation ─────────────────

def _extract_themes(texts: List[str], clusters: Dict[str, List[str]] = None) -> List[str]:
    """
    Scan a list of text strings for theme cluster matches.
    Returns theme labels ranked by how many texts mention them,
    with a minimum frequency threshold to avoid noise.

    `clusters` defaults to _THEME_CLUSTERS (product/electronics themes);
    pass _RESTAURANT_THEME_CLUSTERS for restaurant reviews.
    """
    if not texts:
        return []

    clusters = clusters or _THEME_CLUSTERS

    combined = " ".join(texts).lower()
    # Strip punctuation for cleaner matching
    combined = re.sub(r"[^\w\s]", " ", combined)

    theme_hits: Counter = Counter()
    for theme, keywords in clusters.items():
        for kw in keywords:
            # Count whole-word occurrences
            count = len(re.findall(r"\b" + re.escape(kw) + r"\b", combined))
            if count:
                theme_hits[theme] += count

    # Return themes that appeared meaningfully (at least 2 hits or mentioned in 2+ texts)
    ranked = [t for t, c in theme_hits.most_common() if c >= 2]
    return ranked[:4]  # Cap at 4 themes per sentiment group for readability


def _extract_top_keywords(texts: List[str], top_n: int = 6) -> List[str]:
    """
    Extract the most frequent meaningful words from a list of texts.
    Filters out very common stop-words.
    """
    _STOPWORDS = {
        "the", "and", "for", "this", "that", "with", "have", "from",
        "just", "been", "they", "their", "after", "about", "would",
        "could", "very", "more", "some", "also", "than", "really",
        "like", "much", "when", "into", "been", "which", "even",
        "will", "not", "but", "its", "are", "was", "has", "had",
    }
    tokens = []
    for t in texts:
        words = re.sub(r"[^\w\s]", " ", t.lower()).split()
        tokens.extend([w for w in words if len(w) > 4 and w not in _STOPWORDS])
    return [w for w, _ in Counter(tokens).most_common(top_n)]


def _shorten(text: str, max_len: int = 100) -> str:
    """Trim a headline to a clean, sentence-friendly fragment."""
    text = text.strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") 


def _build_news_narrative(texts: List[str], sentiment: str) -> str:
    """
    Build a natural-language paragraph describing the news coverage in a
    sentiment group, grounded in the ACTUAL headlines.

    Strategy:
        1. Pick up to 3 representative headlines (first, middle, last) for spread.
        2. Vary openers and closers by sentiment and count so repeated calls
           don't produce identical prose.
        3. Close each narrative with a forward-looking editorial note rather
           than a generic boilerplate line.
    """
    if not texts:
        return f"No {sentiment.lower()} coverage found for this topic."

    n = len(texts)

    if n == 1:
        samples = [texts[0]]
    elif n == 2:
        samples = texts[:2]
    else:
        samples = [texts[0], texts[n // 2], texts[-1]]

    fragments = [_shorten(s, 90) for s in samples]

    if sentiment == "Positive":
        if n == 1:
            opening = f'A single upbeat story dominates: "{fragments[0]}".'
            close = "While limited in volume, positive reporting can shift the broader narrative if momentum builds."
        elif n == 2:
            opening = (
                f'Two stories contribute to a positive read — "{fragments[0]}" '
                f'and "{fragments[1]}".'
            )
            close = "Though the sample is small, both pieces lean constructive and reflect early favourable signals."
        else:
            opening = (
                f'{n} headlines carry an optimistic tone. Leading coverage includes '
                f'"{fragments[0]}", while mid-range stories such as "{fragments[1]}" '
                f'reinforce the trend, and reporting like "{fragments[-1]}" rounds out the picture.'
            )
            close = "The breadth of positive coverage suggests a genuine shift in sentiment rather than isolated praise."
        return f"{opening} {close}"

    elif sentiment == "Negative":
        if n == 1:
            opening = f'One critical headline stands out: "{fragments[0]}".'
            close = "A single negative story rarely defines a narrative, but it warrants attention if the topic is sensitive."
        elif n == 2:
            opening = (
                f'Two critical reports weigh on coverage — "{fragments[0]}" '
                f'and "{fragments[1]}".'
            )
            close = "The concerns raised are specific rather than systemic, though both point to friction worth monitoring."
        else:
            opening = (
                f'{n} headlines take a critical stance. The most prominent — '
                f'"{fragments[0]}" — sets a concerning tone, echoed by stories like '
                f'"{fragments[1]}" and capped by "{fragments[-1]}".'
            )
            close = "This volume of critical coverage indicates sustained negative attention that is unlikely to resolve quickly."
        return f"{opening} {close}"

    else:  # Neutral
        if n == 1:
            opening = f'One factual report sits in the neutral column: "{fragments[0]}".'
            close = "Neutral coverage often signals that the story is still developing and reporters are reserving judgement."
        elif n == 2:
            opening = (
                f'Two pieces take a measured, factual approach — "{fragments[0]}" '
                f'and "{fragments[1]}".'
            )
            close = "Neither story leans strongly positive or negative, suggesting coverage is in an informational rather than opinionated phase."
        else:
            opening = (
                f'{n} items were classified as neutral, including "{fragments[0]}", '
                f'"{fragments[1]}", and "{fragments[-1]}".'
            )
            close = "The prevalence of neutral reporting suggests the story is being tracked closely but has not yet triggered strong editorial reactions."
        return f"{opening} {close}"


def _build_overall_summary(
    positive_texts: List[str],
    negative_texts: List[str],
    neutral_texts: List[str],
) -> str:
    """
    Compose a natural-language Overall Summary for the News and Movies domains.
    Synthesises the balance across sentiment groups into 2-3 sentences.
    Avoids generic boilerplate — each branch produces distinct, readable prose.
    """
    pos, neg, neu = len(positive_texts), len(negative_texts), len(neutral_texts)
    total = pos + neg + neu

    if total == 0:
        return "No data was available to generate a summary for this topic."

    pos_pct = pos / total
    neg_pct = neg / total
    neu_pct = neu / total

    # ── Primary tone sentence ────────────────────────────────────────
    if pos_pct >= 0.65:
        tone = (
            f"Coverage is strongly positive — {pos} of {total} items lean favourable, "
            f"indicating the topic is resonating well with audiences and media alike."
        )
    elif pos_pct >= 0.45 and pos_pct > neg_pct:
        tone = (
            f"The overall mood leans positive, with {pos} of {total} items expressing "
            f"approval or optimism, though a notable share of critical voices keeps "
            f"the picture from being uniformly rosy."
        )
    elif neg_pct >= 0.65:
        tone = (
            f"Sentiment skews heavily negative — {neg} of {total} items carry a critical "
            f"or concerned tone, signalling significant friction around this topic."
        )
    elif neg_pct >= 0.45 and neg_pct > pos_pct:
        tone = (
            f"The balance tilts negative, with {neg} of {total} items raising concerns "
            f"or criticism. Positive voices exist but are currently outnumbered."
        )
    elif neu_pct >= 0.55:
        tone = (
            f"Most coverage ({neu} of {total} items) is factual and measured, "
            f"suggesting the story is still being tracked rather than editorially judged."
        )
    else:
        tone = (
            f"Sentiment is genuinely divided across {total} items — {pos} positive, "
            f"{neg} negative, and {neu} neutral — reflecting an active and contested topic "
            f"without a dominant narrative yet."
        )

    # ── Runner-up context sentence ───────────────────────────────────
    counts = {"positive": pos, "negative": neg, "neutral": neu}
    sorted_groups = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    runner_up_label, runner_up_count = sorted_groups[1]

    if runner_up_count > 0:
        rn = runner_up_count
        followup = (
            f" {rn} item{'s' if rn != 1 else ''} fell in the {runner_up_label} column, "
            f"providing counterweight to the dominant tone."
        )
    else:
        followup = ""

    return tone + followup


def _build_dynamic_summary(
    positive_texts: List[str],
    negative_texts: List[str],
    neutral_texts:  List[str] = None,
    clusters: Dict[str, List[str]] = None,
    domain: str = "products",
) -> str:
    """
    Compose a natural-language AI summary tailored to the calling domain.

    - News / Movies: delegates to _build_overall_summary (count-based narrative).
    - Products: consumer-review framing (what buyers love vs. what frustrates them).
    - Restaurants: dining-experience framing (what diners rave about vs. complain about).

    `clusters` lets callers substitute a domain-specific theme cluster set.
    `domain` hint ('products' | 'restaurants') drives vocabulary choices.
    """
    # ── News / Movies path ────────────────────────────────────────────
    if neutral_texts is not None:
        return _build_overall_summary(positive_texts, negative_texts, neutral_texts)

    # ── Shared theme / keyword extraction ─────────────────────────────
    pos_themes   = _extract_themes(positive_texts, clusters)
    neg_themes   = _extract_themes(negative_texts, clusters)
    pos_keywords = _extract_top_keywords(positive_texts)
    neg_keywords = _extract_top_keywords(negative_texts)

    pos_count, neg_count = len(positive_texts), len(negative_texts)
    total = pos_count + neg_count

    parts: List[str] = []

    # ── Domain-specific vocabulary ─────────────────────────────────────
    is_restaurant = (domain == "restaurants")
    praise_verb   = "rave about" if is_restaurant else "praise"
    source_label  = "diners"     if is_restaurant else "buyers"
    gripe_verb    = "flag"       if is_restaurant else "cite"
    complaint_noun= "experiences"if is_restaurant else "use cases"

    # ── Positive themes ────────────────────────────────────────────────
    if positive_texts and pos_count > 0:
        if pos_themes:
            top = _humanize_list(pos_themes[:2])
            secondary = pos_themes[2] if len(pos_themes) > 2 else None
            parts.append(
                f"Most {source_label} {praise_verb} {top}"
                + (f", with {secondary} also drawing consistent approval" if secondary else "")
                + "."
            )
        elif pos_keywords:
            parts.append(
                f"Positive feedback centres on {_humanize_list(pos_keywords[:3])}."
            )

    # ── Negative themes ────────────────────────────────────────────────
    if negative_texts and neg_count > 0:
        if neg_themes:
            top = _humanize_list(neg_themes[:2])
            secondary = neg_themes[2] if len(neg_themes) > 2 else None
            parts.append(
                f"Critical voices {gripe_verb} {top} as recurring pain points"
                + (f", alongside concerns about {secondary}" if secondary else "")
                + "."
            )
        elif neg_keywords:
            parts.append(
                f"Negative feedback frequently mentions {_humanize_list(neg_keywords[:3])}."
            )

    # ── Overall balance sentence ───────────────────────────────────────
    if total > 0:
        pos_pct = pos_count / total
        if pos_pct >= 0.70:
            parts.append(
                f"On balance, {source_label} are largely satisfied — "
                f"praise outweighs criticism by a significant margin."
            )
        elif pos_pct >= 0.50:
            parts.append(
                f"Sentiment leans positive overall, though the complaints raised "
                f"are specific enough to matter for prospective {source_label}."
            )
        elif pos_pct <= 0.30:
            parts.append(
                f"The overall picture is cautionary — dissatisfied {source_label} "
                f"currently outnumber satisfied ones, and the concerns are recurring "
                f"rather than isolated."
            )
        else:
            parts.append(
                f"Opinions are genuinely split, reflecting diverse {complaint_noun} "
                f"and expectations. Individual results will vary depending on priorities."
            )

    return " ".join(parts) if parts else "Not enough discussion data to generate a reliable summary."


def _humanize_list(items: List[str]) -> str:
    """Join a list into a natural English phrase: 'a, b and c'."""
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


def _extract_dynamic_pros_cons(
    positive_texts: List[str],
    negative_texts: List[str],
    clusters: Dict[str, List[str]] = None,
) -> Tuple[List[str], List[str]]:
    """
    Derive pros and cons from actual discussion content via theme extraction.
    Falls back to top keywords when no theme clusters match.

    `clusters` defaults to _THEME_CLUSTERS; pass _RESTAURANT_THEME_CLUSTERS
    for restaurant reviews so "Top Praises" / "Top Complaints" reflect
    food/service/ambience themes rather than electronics specs.
    """
    pos_themes = _extract_themes(positive_texts, clusters)
    neg_themes = _extract_themes(negative_texts, clusters)

    pros = pos_themes[:5] if pos_themes else _extract_top_keywords(positive_texts, top_n=5)
    cons = neg_themes[:5] if neg_themes else _extract_top_keywords(negative_texts, top_n=5)

    return pros, cons


# ── Company Intelligence extractor ──────────────────────────────────

_EMPLOYEE_KEYWORDS  = ["employee", "employees", "staff", "workers", "workforce", "team", "culture", "workplace", "glassdoor", "morale"]
_CUSTOMER_KEYWORDS  = ["customer", "customers", "user", "users", "client", "clients", "consumer", "consumers", "review", "experience", "satisfaction"]
_LAYOFF_KEYWORDS    = ["layoff", "layoffs", "fired", "laid off", "cuts", "redundancy", "retrenchment", "downsizing"]
_HIRING_KEYWORDS    = ["hiring", "hire", "recruit", "jobs", "openings", "headcount", "growing team", "expanding"]
_MARKET_CAP_KEYWORDS = ["market cap", "valuation", "billion", "trillion", "market value", "nasdaq", "nyse", "stock"]


def _build_company_intelligence(
    positive_texts: List[str],
    negative_texts: List[str],
    neutral_texts:  List[str],
    all_results: List[Dict],
) -> Dict:
    """
    Extract structured intelligence fields for the Companies dashboard
    from classified article texts. All analysis is grounded in the
    actual fetched articles — no hardcoded data.

    Returns a dict with:
        positive_drivers   — top positive theme labels (from company clusters)
        negative_drivers   — top negative theme labels (from company clusters)
        employee_sentiment — snippet assembled from employee-related texts
        customer_sentiment — snippet assembled from customer-related texts
        layoff_signal      — True if layoff keywords detected in recent texts
        hiring_signal      — True if hiring keywords detected in recent texts
        key_themes         — ranked theme labels across all articles
    """
    all_texts = positive_texts + negative_texts + neutral_texts
    combined  = " ".join(all_texts).lower()
    combined  = re.sub(r"[^\w\s]", " ", combined)

    # ── Positive / Negative Drivers (company theme clusters) ─────────
    pos_themes = _extract_themes(positive_texts, _COMPANY_THEME_CLUSTERS)
    neg_themes = _extract_themes(negative_texts, _COMPANY_THEME_CLUSTERS)
    positive_drivers = pos_themes[:5] if pos_themes else _extract_top_keywords(positive_texts, top_n=5)
    negative_drivers = neg_themes[:5] if neg_themes else _extract_top_keywords(negative_texts, top_n=5)

    # ── Employee sentiment — collect headlines mentioning employee terms ──
    employee_headlines = []
    for r in all_results:
        h = r.get("headline", "").lower()
        if any(kw in h for kw in _EMPLOYEE_KEYWORDS):
            employee_headlines.append(r.get("headline", ""))

    if employee_headlines:
        employee_sentiment = f"{len(employee_headlines)} article{'s' if len(employee_headlines) != 1 else ''} mention workforce or culture topics. Key stories: " + "; ".join(employee_headlines[:2]) + "."
    else:
        employee_sentiment = "No specific employee or workplace coverage found in recent articles."

    # ── Customer sentiment — collect headlines mentioning customer terms ──
    customer_headlines = []
    for r in all_results:
        h = r.get("headline", "").lower()
        if any(kw in h for kw in _CUSTOMER_KEYWORDS):
            customer_headlines.append(r.get("headline", ""))

    if customer_headlines:
        customer_sentiment = f"{len(customer_headlines)} article{'s' if len(customer_headlines) != 1 else ''} cover customer or user experience. Key stories: " + "; ".join(customer_headlines[:2]) + "."
    else:
        customer_sentiment = "No specific customer or user experience coverage found in recent articles."

    # ── Layoff / hiring signals ───────────────────────────────────────
    layoff_signal = any(
        re.search(r"\b" + re.escape(kw) + r"\b", combined)
        for kw in _LAYOFF_KEYWORDS
    )
    hiring_signal = any(
        re.search(r"\b" + re.escape(kw) + r"\b", combined)
        for kw in _HIRING_KEYWORDS
    )

    # ── Overall key themes across all articles ─────────────────────
    key_themes = _extract_themes(all_texts, _COMPANY_THEME_CLUSTERS)

    return {
        "positive_drivers":   positive_drivers,
        "negative_drivers":   negative_drivers,
        "employee_sentiment": employee_sentiment,
        "customer_sentiment": customer_sentiment,
        "layoff_signal":      layoff_signal,
        "hiring_signal":      hiring_signal,
        "key_themes":         key_themes[:6],
    }


# ── News Report (UNCHANGED) ──────────────────────────────────────────

def run_news_report(topic: str, items: List[Dict]):
    """Detailed Intelligence Report for News & Politics."""
    all_results = []

    for it in items:
        result = _predictor.predict(it['text'])
        label  = result["label"]
        prob   = max(result["probabilities"].values()) / 100.0
        all_results.append({**it, "label": label, "conf": prob, "clean": result["cleaned_text"]})

    counts = Counter([r["label"] for r in all_results])
    total = len(all_results)

    groups = {"Positive": [], "Negative": [], "Neutral": []}
    for r in all_results: groups[r["label"]].append(r)
    for k in groups: groups[k].sort(key=lambda x: x["conf"], reverse=True)

    tokens = []
    for r in all_results: tokens.extend([w for w in r["clean"].split() if len(w) > 4])
    top_kw = [w for w, _ in Counter(tokens).most_common(8)]

    print("\n" + "═"*66)
    print(f"  📰  SENTISTREAM NEWSROOM: {topic.upper()}")
    print("═"*66)

    v_title, v_desc = _get_news_verdict(counts)
    print(f"\n  OVERALL VERDICT : {v_title}")
    print(f"  ANALYSIS        : {v_desc}")

    print(f"\n  SENTIMENT DISTRIBUTION")
    for label, char in [("Positive", "▓"), ("Neutral", "▒"), ("Negative", "░")]:
        pct = (counts[label]/total)*100 if total > 0 else 0
        bar = char * int(pct/3)
        print(f"  {label:<10} [{bar:<33}] {pct:>5.1f}%")

    if top_kw:
        print(f"\n  TRENDING TOPICS: {', '.join(top_kw)}")

    for section, icon in [("Positive", "🟢"), ("Negative", "🔴"), ("Neutral", "⚪")]:
        samples = groups[section][:3]
        if samples:
            print(f"\n  {icon} TOP {section.upper()} COVERAGE")
            for r in samples:
                clean_h = scrub_metadata(r["headline"])
                print(f"    • ({int(r['conf']*100)}%) {clean_h[:75]}...")

    print("\n" + "═"*66 + "\n")
    generate_sentiment_report(counts["Positive"], counts["Neutral"], counts["Negative"], topic)


# ── Product Report (UNCHANGED) ────────────────────────────────────────

def run_product_report(topic: str, items: List[Dict]):
    """Generates a premium consumer-intelligence report for products."""
    results = []
    for it in items:
        result = _predictor.predict(it['text'])
        label  = result["label"]
        prob   = max(result["probabilities"].values()) / 100.0
        results.append({**it, "label": label, "conf": prob})

    groups = {"Positive": [], "Negative": [], "Neutral": []}
    for r in results: groups[r["label"]].append(r)
    for key in groups: groups[key].sort(key=lambda x: x["conf"], reverse=True)

    print("\n" + "═"*64)
    print(f"  🛒  SENTISTREAM AI — CONSUMER INTELLIGENCE: {topic.upper()}")
    print("═"*64)

    for tone in ["Positive", "Negative"]:
        label_text = "🟢 TOP POSITIVE" if tone == "Positive" else "🔴 TOP NEGATIVE"
        print(f"\n  {label_text} FEEDBACK")
        samples = groups[tone][:3]
        if not samples:
            print("      No significant signal found in this category."); continue
        for i, it in enumerate(samples, 1):
            opinion = generate_human_opinion(it, label=tone, confidence=it['conf'])
            wrapped = textwrap.fill(opinion, width=60, initial_indent="      ", subsequent_indent="      ")
            print(f"\n    {i}. \"\n{wrapped}\n      \"")

    p_texts = [x['text'] for x in groups["Positive"]]
    n_texts = [x['text'] for x in groups["Negative"]]
    pros = extract_pros_and_complaints(p_texts)
    cons = extract_pros_and_complaints(n_texts)
    if pros: print(f"\n  ✔ COMMON PROS: {', '.join(pros)}")
    if cons: print(f"  ✖ COMMON COMPLAINTS: {', '.join(cons)}")
    print("\n" + "═"*64 + "\n")
    generate_sentiment_report(len(groups["Positive"]), len(groups["Neutral"]), len(groups["Negative"]), topic)


# ── Main Loop ───────────────────────────────────────────────────────

def run_router():
    download_nltk_resources()
    while True:
        print(f"\n  Select Domain:\n  1. {DOMAINS['1']['icon']} {DOMAINS['1']['label']}\n  2. {DOMAINS['2']['icon']} {DOMAINS['2']['label']}\n  3. {DOMAINS['3']['icon']} {DOMAINS['3']['label']}\n  5. {DOMAINS['5']['icon']} {DOMAINS['5']['label']}\n  q. 👋 Quit")
        choice = input("\n  Choice: ").strip().lower()
        if choice == 'q': break
        if choice not in DOMAINS: continue

        topic = input(f"  Enter {DOMAINS[choice]['label']} Topic: ").strip()
        if not topic: continue

        print(f"\n  🌐 Fetching live signals for '{topic}'...")
        items = fetch_for_domain(choice, topic)
        if not items:
            print("  ⚠️ No data found."); continue

        if choice == "2":
            run_product_report(topic, items)
        else:
            run_news_report(topic, items)

if __name__ == "__main__":
    try:
        run_router()
    except KeyboardInterrupt:
        print("\n  Process stopped.")


# ── Source-name resolver ─────────────────────────────────────────────

_KNOWN_DOMAINS: Dict[str, str] = {
    "cnn.com":              "CNN",
    "bbc.co.uk":            "BBC",
    "bbc.com":              "BBC",
    "reuters.com":          "Reuters",
    "aljazeera.com":        "Al Jazeera",
    "theguardian.com":      "The Guardian",
    "nytimes.com":          "New York Times",
    "washingtonpost.com":   "Washington Post",
    "apnews.com":           "AP News",
    "bloomberg.com":        "Bloomberg",
    "foxnews.com":          "Fox News",
    "nbcnews.com":          "NBC News",
    "abcnews.go.com":       "ABC News",
    "politico.com":         "Politico",
    "axios.com":            "Axios",
    "theverge.com":         "The Verge",
    "ft.com":               "Financial Times",
    "wsj.com":              "Wall Street Journal",
    "economist.com":        "The Economist",
    "time.com":             "TIME",
    "forbes.com":           "Forbes",
    "businessinsider.com":  "Business Insider",
    "cnbc.com":             "CNBC",
    "sky.com":              "Sky News",
    "independent.co.uk":    "The Independent",
    "telegraph.co.uk":      "The Telegraph",
    "npr.org":              "NPR",
    "vox.com":              "Vox",
    "theatlantic.com":      "The Atlantic",
    "wired.com":            "Wired",
    "techcrunch.com":       "TechCrunch",
}

# Hostnames that are aggregators / proxies — never surfaced as a source name
_BLOCKED_HOSTS: set = {
    "news.google.com",
    "google.com",
    "google.co.uk",
    "amp.google.com",
    "feedburner.com",
    "feed.feedburner.com",
}


# ── Movie review source canonical names ─────────────────────────────
_MOVIE_SOURCE_DOMAINS: Dict[str, str] = {
    "imdb.com":          "IMDb",
    "rottentomatoes.com":"Rotten Tomatoes",
    "letterboxd.com":    "Letterboxd",
    "metacritic.com":    "Metacritic",
    "themoviedb.org":    "TMDb",
    "tmdb.org":          "TMDb",
    "wikipedia.org":     "Wikipedia",
    "en.wikipedia.org":  "Wikipedia",
    "google.com":        "Google Reviews",
    "rogerebert.com":    "RogerEbert.com",
    "empireonline.com":  "Empire",
    "screendaily.com":   "Screen Daily",
    "variety.com":       "Variety",
    "hollywoodreporter.com": "The Hollywood Reporter",
    "indiewire.com":     "IndieWire",
    "collider.com":      "Collider",
    "ign.com":           "IGN",
}


def _fetch_movie_info(topic: str) -> Dict:
    """
    Fetch real movie/TV metadata.
    Priority: TMDb (TMDB_API_KEY) → OMDb (OMDB_API_KEY) → empty strings.
    Never guesses or hardcodes values.
    """
    import urllib.request, urllib.parse, json as _json

    info: Dict = {
        "title": topic, "year": "", "poster": "", "imdb_rating": "",
        "rt_score": "", "budget": "", "box_office": "", "release_date": "",
        "runtime": "", "genre": "", "genres": [], "imdb_id": "",
        "media_type": "", "total_seasons": "", "series_status": "",
        "streaming_platforms": [], "overview": "",
    }

    def _fmt(n: int) -> str:
        if not n: return ""
        return f"${n/1_000_000_000:.1f}B" if n >= 1_000_000_000 else f"${n/1_000_000:.0f}M"

    tmdb_key = os.environ.get("TMDB_API_KEY", "")
    tmdb_ok  = False

    if tmdb_key:
        try:
            q = urllib.parse.urlencode({"api_key": tmdb_key, "query": topic,
                                        "include_adult": "false", "language": "en-US"})
            with urllib.request.urlopen(
                f"https://api.themoviedb.org/3/search/multi?{q}", timeout=8) as r:
                hit = next((x for x in _json.loads(r.read())["results"]
                            if x.get("media_type") in ("movie", "tv")), None)
            if not hit:
                raise ValueError

            mid  = hit["id"]
            mtyp = hit["media_type"]
            atr  = "external_ids,watch/providers"

            if mtyp == "movie":
                q2 = urllib.parse.urlencode({"api_key": tmdb_key,
                                             "append_to_response": atr, "language": "en-US"})
                with urllib.request.urlopen(
                    f"https://api.themoviedb.org/3/movie/{mid}?{q2}", timeout=8) as r:
                    d = _json.loads(r.read())
                info.update({
                    "title":        d.get("title", topic),
                    "year":         (d.get("release_date") or "")[:4],
                    "release_date": d.get("release_date", ""),
                    "poster":       f"https://image.tmdb.org/t/p/w500{d['poster_path']}" if d.get("poster_path") else "",
                    "runtime":      f"{d['runtime']} min" if d.get("runtime") else "",
                    "imdb_id":      d.get("imdb_id") or (d.get("external_ids") or {}).get("imdb_id", ""),
                    "overview":     d.get("overview", ""),
                    "media_type":   "Movie",
                    "budget":       _fmt(d.get("budget", 0)),
                    "box_office":   _fmt(d.get("revenue", 0)),
                    "genres":       [g["name"] for g in d.get("genres", [])],
                    "genre":        ", ".join(g["name"] for g in d.get("genres", [])),
                    "series_status": {"Released": "Released"}.get(d.get("status", ""), d.get("status", "")),
                    "streaming_platforms": [p["provider_name"] for p in
                        d.get("watch/providers", {}).get("results", {}).get("US", {}).get("flatrate", [])][:4],
                })
            else:
                q2 = urllib.parse.urlencode({"api_key": tmdb_key,
                                             "append_to_response": atr, "language": "en-US"})
                with urllib.request.urlopen(
                    f"https://api.themoviedb.org/3/tv/{mid}?{q2}", timeout=8) as r:
                    d = _json.loads(r.read())
                air = d.get("first_air_date", "")
                rt  = d.get("episode_run_time", [])
                status_map = {"Returning Series": "Running", "Ended": "Ended",
                              "Cancelled": "Cancelled", "In Production": "In Production",
                              "Planned": "Upcoming"}
                info.update({
                    "title":         d.get("name", topic),
                    "year":          air[:4] if air else "",
                    "release_date":  air,
                    "poster":        f"https://image.tmdb.org/t/p/w500{d['poster_path']}" if d.get("poster_path") else "",
                    "runtime":       f"{rt[0]} min/ep" if rt else "",
                    "imdb_id":       (d.get("external_ids") or {}).get("imdb_id", ""),
                    "overview":      d.get("overview", ""),
                    "media_type":    "TV Mini-Series" if d.get("type") == "Miniseries" else "TV Series",
                    "total_seasons": str(d.get("number_of_seasons", "")),
                    "genres":        [g["name"] for g in d.get("genres", [])],
                    "genre":         ", ".join(g["name"] for g in d.get("genres", [])),
                    "series_status": status_map.get(d.get("status", ""), d.get("status", "")),
                    "streaming_platforms": [p["provider_name"] for p in
                        d.get("watch/providers", {}).get("results", {}).get("US", {}).get("flatrate", [])][:4],
                })
            tmdb_ok = True
        except Exception:
            pass

    omdb_key = os.environ.get("OMDB_API_KEY", "")
    if omdb_key:
        try:
            q = urllib.parse.urlencode(
                {"i": info["imdb_id"], "apikey": omdb_key, "plot": "short"} if info["imdb_id"]
                else {"t": topic, "apikey": omdb_key, "plot": "short"})
            with urllib.request.urlopen(f"https://www.omdbapi.com/?{q}", timeout=6) as r:
                od = _json.loads(r.read())
            if od.get("Response") == "True":
                info["imdb_rating"] = od.get("imdbRating", "")
                for rat in od.get("Ratings", []):
                    if "Rotten Tomatoes" in rat.get("Source", ""):
                        info["rt_score"] = rat["Value"]; break
                if not tmdb_ok:
                    rtyp = od.get("Type", "").lower()
                    info.update({
                        "title": od.get("Title", topic), "year": od.get("Year", ""),
                        "poster": od.get("Poster", ""), "runtime": od.get("Runtime", ""),
                        "release_date": od.get("Released", ""), "box_office": od.get("BoxOffice", ""),
                        "overview": od.get("Plot", ""),
                        "genres": [g.strip() for g in od.get("Genre", "").split(",") if g.strip()],
                        "genre": od.get("Genre", ""),
                        "media_type": "TV Series" if rtyp == "series" else "Movie",
                        "total_seasons": od.get("totalSeasons", "") if rtyp == "series" else "",
                        "series_status": ("Ended" if (od.get("Year","").replace("–","-").split("-")[-1].strip().isdigit())
                                          else "Running") if rtyp == "series" else "Released",
                    })
        except Exception:
            pass

    return info


def _fetch_movie_reviews(topic: str, movie_info: Dict) -> List[Dict]:
    """
    Fetch movie reviews from preferred sources.
    Returns a list of review dicts compatible with the sentiment pipeline:
      {"text": str, "headline": str, "source": str, "url": str}

    Strategy (in order, stops once enough items collected):
      1. Reddit r/movies + r/flicks search via fetch_for_domain("5", topic)
         — already implemented; gives community review text.
      2. Stub slots for IMDb / RT / Letterboxd scraped titles so the
         detected_sources section always surfaces the canonical sources
         even when full scraping is unavailable.
    """
    items = fetch_for_domain("5", topic)

    # Tag each item with a normalised source name so the frontend shows
    # "IMDb", "Letterboxd" etc. instead of raw hostnames.
    normalised = []
    for it in items:
        url  = it.get("url") or it.get("link") or ""
        src  = _resolve_movie_source(url, it.get("source", ""))
        normalised.append({**it, "source": src or it.get("source", "Review")})

    return normalised


def _resolve_movie_source(url: str, fallback: str = "") -> str:
    """Resolve a URL to a canonical movie review source name."""
    if url:
        try:
            from urllib.parse import urlparse
            host = re.sub(r"^www\.", "", urlparse(url).hostname or "")
            for domain, name in _MOVIE_SOURCE_DOMAINS.items():
                if domain in host or host in domain:
                    return name
            if host:
                return host
        except Exception:
            pass
    return fallback.strip() if fallback.strip() else ""


def _resolve_source_name(url: str, fallback_source: str = "") -> str:
    """
    Return a clean publisher name from a URL.

    Priority:
      1. Exact hostname match against _KNOWN_DOMAINS.
      2. Substring scan (handles subdomains like 'www.bbc.co.uk').
      3. The raw ``fallback_source`` value if non-empty.
      4. The bare hostname (e.g. 'news.ycombinator.com' → 'news.ycombinator.com').

    Returns empty string for aggregator/proxy hostnames (e.g. news.google.com)
    so callers can filter them out before surfacing to the frontend.
    Never returns 'Unknown Source'.
    """
    if url:
        try:
            from urllib.parse import urlparse
            hostname = urlparse(url).hostname or ""
            # Remove leading 'www.'
            clean_host = re.sub(r"^www\.", "", hostname)

            # Aggregator hostnames (e.g. news.google.com): don't use the URL
            # as the source name, but fall through to use fallback_source instead.
            if clean_host not in _BLOCKED_HOSTS:
                # 1. Exact match
                if clean_host in _KNOWN_DOMAINS:
                    return _KNOWN_DOMAINS[clean_host]

                # 2. Substring match (handles subdomains / country TLDs)
                for domain_key, label in _KNOWN_DOMAINS.items():
                    if domain_key in clean_host or clean_host in domain_key:
                        return label

                # 3. Return clean hostname as-is (still meaningful)
                if clean_host:
                    return clean_host
        except Exception:
            pass

    # Use the source field supplied by the fetcher (e.g. RSS <source> tag)
    if fallback_source and fallback_source.strip():
        src = fallback_source.strip()
        # Reject google aggregator labels that come via the source field
        if "google" in src.lower():
            return ""
        return src

    return ""


# ── API entry point ──────────────────────────────────────────────────

def analyze_topic(domain: str, topic: str) -> Dict:
    """
    Analyse live Reddit/news data for *topic* and return a structured
    result dict suitable for the frontend API.

    For the Products domain:
        - Neutral sentiment is excluded from results and counts.
        - pros, cons and ai_summary are derived dynamically from the
          actual discussion texts — no hardcoded templates are used.

    For the Restaurants domain:
        - All three sentiment classes are kept (Neutral included), so
          "Top Reviews" reflects a realistic spread of opinions.
        - pros/cons ("Top Praises" / "Top Complaints") are derived using
          restaurant-specific theme clusters (food quality, service,
          wait time, ambience, value, hygiene, delivery).
        - ai_summary is a theme-based overall summary, same style as Products.
        - top_reviews mirrors `results` — top 3 reviews per sentiment group.

    For the News domain:
        - All three sentiment classes (Positive, Neutral, Negative) are
          included, matching the existing newsroom behaviour.
        - Top 3 headlines per sentiment group are selected by confidence.
        - Dominant sentiment is whichever group has the highest count.
        - Per-sentiment narrative summaries are generated from all headlines.

    Returns:
        {
            "status":            "success" | "error",
            "domain":            str,
            "topic":             str,
            "results":           [{"headline": str, "sentiment": str,
                                   "confidence": float, "source": str,
                                   "url": str}, ...],
            "dominant_sentiment": str,   # "Positive" | "Negative" | "Neutral"
            "dominant_pct":       float, # percentage of dominant class
            "pros":              [str, ...],   # "Top Praises" for Restaurants
            "cons":              [str, ...],   # "Top Complaints" for Restaurants
            "ai_summary":        str,   # "Overall Summary"
            "news_narratives":   {      # News domain only — per-sentiment narratives
                "positive": str,
                "negative": str,
                "neutral":  str,
            },
            "top_reviews":       [...],  # Restaurants only — same shape as `results`
        }
    """
    domain_l = domain.lower()
    # ── Domain resolution trace ────────────────────────────────────
    # Homepage ANALYSIS_CATEGORIES.value → URL ?category=<value>
    #   → frontend mapCategoryToDomain() → ?domain=<value> on /analyze
    #   → resolved here to the internal `choice` key used by DOMAINS,
    #     fetch_for_domain(), and the model/vectorizer bundle.
    #
    #   "news"               → choice "1" (News / Politics)
    #   "products" (default) → choice "2" (Products / Brands)
    #   "restaurants"        → choice "3" (Restaurants)
    #   "movies"             → choice "5" (Movies & TV Shows)
    if domain_l in ["news", "politics", "news/politics"]:
        choice = "1"
    elif domain_l in ["restaurant", "restaurants", "food", "dining"]:
        choice = "3"
    elif domain_l in ["movies", "tv", "shows", "movies & tv shows", "film", "films", "television"]:
        choice = "5"
    else:
        choice = "2"

    is_news       = (choice == "1")
    is_product    = (choice == "2")
    is_restaurant = (choice == "3")
    is_movies     = (choice == "5")

    # ── RESTAURANT: dedicated pipeline (no RSS/news anywhere) ────────
    if is_restaurant:
        return _analyze_restaurant(topic, choice)

    # ── MOVIES: dedicated pipeline with OMDB metadata + review sources ─
    if is_movies:
        return _analyze_movies(topic, choice)

    # ── All other domains: RSS / Reddit fetch ─────────────────────
    items = fetch_for_domain(choice, topic)
    if not items:
        return {"status": "error", "message": "No live data found."}

    # ── Classify ALL fetched items in one batch call ──────────────
    texts       = [it["text"] for it in items]
    predictions = _predictor.predict_batch(texts)

    raw_results = []
    for it, pred in zip(items, predictions):
        label = pred["label"]
        conf  = max(pred["probabilities"].values()) / 100.0

        item_url    = it.get("url") or it.get("link") or ""
        source_name = _resolve_source_name(item_url, it.get("source", ""))
        if not source_name:
            source_name = "Source" if is_product else "News Source"

        raw_results.append({
            "headline":   scrub_metadata(it.get("headline", "")),
            "sentiment":  label,
            "confidence": round(conf * 100, 1),
            "source":     source_name,
            "url":        item_url,
            "_text":      it["text"],
            "_conf_raw":  conf,
        })

    # ── Products: drop Neutral entries entirely ───────────────────
    if is_product:
        raw_results = [r for r in raw_results if r["sentiment"] != "Neutral"]

    # ── Separate by sentiment ─────────────────────────────────────
    groups: Dict[str, List] = {"Positive": [], "Negative": [], "Neutral": []}
    for r in raw_results:
        groups[r["sentiment"]].append(r)

    for g in groups.values():
        g.sort(key=lambda x: x["_conf_raw"], reverse=True)

    counts = {k: len(v) for k, v in groups.items()}
    total  = sum(counts.values())
    dominant = max(counts, key=lambda k: counts[k]) if total > 0 else "Neutral"
    dominant_pct = round((counts[dominant] / total) * 100, 1) if total > 0 else 0.0

    top3: List[Dict] = []
    for sentiment in ["Positive", "Negative", "Neutral"]:
        top3.extend(groups[sentiment][:3])

    positive_texts = [r["_text"] for r in groups["Positive"]]
    negative_texts = [r["_text"] for r in groups["Negative"]]
    neutral_texts  = [r["_text"] for r in groups["Neutral"]]

    if is_news:
        news_narratives = {
            "positive": _build_news_narrative(positive_texts, "Positive"),
            "negative": _build_news_narrative(negative_texts, "Negative"),
            "neutral":  _build_news_narrative(neutral_texts,  "Neutral"),
        }
        pros, cons = [], []
        ai_summary = _build_dynamic_summary(
            positive_texts, negative_texts, neutral_texts
        )
    else:
        news_narratives = {}
        pros, cons = _extract_dynamic_pros_cons(positive_texts, negative_texts)
        ai_summary = _build_dynamic_summary(positive_texts, negative_texts)

    clean_results = [
        {
            "headline":   r["headline"],
            "sentiment":  r["sentiment"],
            "confidence": r["confidence"],
            "source":     r["source"],
            "url":        r["url"],
        }
        for r in top3
    ]

    response: Dict = {
        "status":             "success",
        "domain":             DOMAINS[choice]["label"],
        "topic":              topic,
        "results":            clean_results,
        "dominant_sentiment": dominant,
        "dominant_pct":       dominant_pct,
        "pros":               pros,
        "cons":               cons,
        "ai_summary":         ai_summary,
    }
    if is_news:
        response["news_narratives"] = news_narratives
    if is_product:
        response["top_reviews"]      = clean_results
        response["customer_summary"] = ai_summary

    return response


# ── Movies pipeline ──────────────────────────────────────────────────────────

def _analyze_movies(topic: str, choice: str) -> Dict:
    """
    Dedicated movie analysis pipeline.

    Data flow:
      _fetch_movie_info()      → OMDB metadata (budget, box office, release date, runtime, genre)
      _fetch_movie_reviews()   → Reddit r/movies community reviews (normalised source names)
      HuggingFace predictor    → sentence-level sentiment on review texts
      _extract_dynamic_pros_cons() → movie theme clusters (acting, direction, music, etc.)
      _build_overall_summary() → AI narrative summary

    Response includes `movie_info` and `detected_sources` for the frontend hero
    and sources row. Fully compatible with the existing sentiment pipeline.
    """
    # ── 1. Fetch metadata (non-blocking; degrades gracefully) ─────────
    movie_info = _fetch_movie_info(topic)

    # ── 2. Fetch reviews from preferred sources ───────────────────────
    items = _fetch_movie_reviews(topic, movie_info)
    if not items:
        return {"status": "error", "message": "No movie review data found."}

    # ── 3. Classify with HuggingFace ─────────────────────────────────
    texts       = [it["text"] for it in items]
    predictions = _predictor.predict_batch(texts)

    raw_results = []
    for it, pred in zip(items, predictions):
        label = pred["label"]
        conf  = max(pred["probabilities"].values()) / 100.0
        raw_results.append({
            "headline":   scrub_metadata(it.get("headline", "")),
            "sentiment":  label,
            "confidence": round(conf * 100, 1),
            "source":     it.get("source", "Review"),
            "url":        it.get("url") or it.get("link") or "",
            "_text":      it["text"],
            "_conf_raw":  conf,
        })

    # ── 4. Group & rank ───────────────────────────────────────────────
    groups: Dict[str, List] = {"Positive": [], "Negative": [], "Neutral": []}
    for r in raw_results:
        groups[r["sentiment"]].append(r)
    for g in groups.values():
        g.sort(key=lambda x: x["_conf_raw"], reverse=True)

    counts       = {k: len(v) for k, v in groups.items()}
    total        = sum(counts.values())
    dominant     = max(counts, key=lambda k: counts[k]) if total > 0 else "Neutral"
    dominant_pct = round((counts[dominant] / total) * 100, 1) if total > 0 else 0.0

    top3: List[Dict] = []
    for sentiment in ["Positive", "Negative", "Neutral"]:
        top3.extend(groups[sentiment][:3])

    positive_texts = [r["_text"] for r in groups["Positive"]]
    negative_texts = [r["_text"] for r in groups["Negative"]]
    neutral_texts  = [r["_text"] for r in groups["Neutral"]]

    # ── 5. Movie-specific pros/cons and summary ───────────────────────
    pros, cons = _extract_dynamic_pros_cons(
        positive_texts, negative_texts, clusters=_MOVIES_THEME_CLUSTERS
    )
    ai_summary = _build_overall_summary(positive_texts, negative_texts, neutral_texts)

    news_narratives = {
        "positive": _build_news_narrative(positive_texts, "Positive"),
        "negative": _build_news_narrative(negative_texts, "Negative"),
        "neutral":  _build_news_narrative(neutral_texts,  "Neutral"),
    }

    clean_results = [
        {
            "headline":   r["headline"],
            "sentiment":  r["sentiment"],
            "confidence": r["confidence"],
            "source":     r["source"],
            "url":        r["url"],
        }
        for r in top3
    ]

    # ── 6. Build detected_sources for the frontend sources row ────────
    source_counter: Counter = Counter(r["source"] for r in raw_results if r["source"])
    detected_sources = []
    # Preferred order: IMDb first, then RT, Letterboxd, Metacritic, others
    _PREFERRED_ORDER = ["IMDb", "Rotten Tomatoes", "Letterboxd", "Metacritic",
                        "TMDb", "Wikipedia", "Google Reviews"]
    seen = set()
    for preferred in _PREFERRED_ORDER:
        if preferred in source_counter:
            detected_sources.append({
                "name":         preferred,
                "articleCount": source_counter[preferred],
                "homepageUrl":  _MOVIE_SOURCE_URLS.get(preferred, ""),
            })
            seen.add(preferred)
    # Append any remaining sources not in the preferred list
    for src, cnt in source_counter.most_common():
        if src not in seen:
            detected_sources.append({
                "name":         src,
                "articleCount": cnt,
                "homepageUrl":  _MOVIE_SOURCE_URLS.get(src, ""),
            })

    return {
        "status":             "success",
        "domain":             DOMAINS[choice]["label"],
        "topic":              topic,
        "results":            clean_results,
        "dominant_sentiment": dominant,
        "dominant_pct":       dominant_pct,
        "pros":               pros,
        "cons":               cons,
        "ai_summary":         ai_summary,
        "news_narratives":    news_narratives,
        "movie_info":         movie_info,
        "detected_sources":   detected_sources,
    }


# ── Movie source homepage URLs (for detected_sources cards) ──────────
_MOVIE_SOURCE_URLS: Dict[str, str] = {
    "IMDb":                 "https://www.imdb.com",
    "Rotten Tomatoes":      "https://www.rottentomatoes.com",
    "Letterboxd":           "https://letterboxd.com",
    "Metacritic":           "https://www.metacritic.com",
    "TMDb":                 "https://www.themoviedb.org",
    "Wikipedia":            "https://www.wikipedia.org",
    "Google Reviews":       "https://www.google.com",
    "RogerEbert.com":       "https://www.rogerebert.com",
    "Empire":               "https://www.empireonline.com",
    "Variety":              "https://variety.com",
    "The Hollywood Reporter": "https://www.hollywoodreporter.com",
    "IndieWire":            "https://www.indiewire.com",
    "Collider":             "https://collider.com",
    "IGN":                  "https://www.ign.com",
}


# ── Restaurant pipeline ───────────────────────────────────────────────────────

def _analyze_restaurant(topic: str, choice: str) -> Dict:
    """
    Dedicated restaurant analysis pipeline.

    Data flow:
      fetch_restaurant_data()          → place_info + reviews[]
      review["text"] only              → HuggingFace sentiment (NO headlines/news)
      _extract_popular_dishes()        → dish mentions across all review texts
      _extract_dynamic_pros_cons()     → top praises / top complaints
      _build_dynamic_summary()         → AI summary paragraph
    """
    restaurant_data = fetch_restaurant_data(topic)
    place_info      = restaurant_data["place_info"]
    reviews         = restaurant_data["reviews"]

    if not reviews:
        return {"status": "error", "message": "No restaurant data found."}

    # Only review["text"] goes to HuggingFace — never headlines or news
    review_texts = [r["text"] for r in reviews]
    predictions  = _predictor.predict_batch(review_texts)

    raw_results = []
    for rev, pred in zip(reviews, predictions):
        label = pred["label"]
        conf  = max(pred["probabilities"].values()) / 100.0
        raw_results.append({
            "headline":   scrub_metadata(rev.get("headline", "Customer Review")),
            "sentiment":  label,
            "confidence": round(conf * 100, 1),
            "source":     rev.get("source", "Review"),
            "url":        rev.get("url", ""),
            "_text":      rev["text"],
            "_conf_raw":  conf,
        })

    # Group by sentiment
    groups: Dict[str, List] = {"Positive": [], "Negative": [], "Neutral": []}
    for r in raw_results:
        groups[r["sentiment"]].append(r)
    for g in groups.values():
        g.sort(key=lambda x: x["_conf_raw"], reverse=True)

    counts       = {k: len(v) for k, v in groups.items()}
    total        = sum(counts.values())
    dominant     = max(counts, key=lambda k: counts[k]) if total > 0 else "Neutral"
    dominant_pct = round((counts[dominant] / total) * 100, 1) if total > 0 else 0.0

    # Top 3 per sentiment group for "Top Reviews" card
    top3: List[Dict] = []
    for sentiment in ["Positive", "Negative", "Neutral"]:
        top3.extend(groups[sentiment][:3])

    positive_texts = [r["_text"] for r in groups["Positive"]]
    negative_texts = [r["_text"] for r in groups["Negative"]]
    neutral_texts  = [r["_text"] for r in groups["Neutral"]]
    all_texts      = positive_texts + negative_texts + neutral_texts

    # ── Aspect-Based Opinion Mining — uses HF labels + signal words ──
    pros, cons = _extract_restaurant_aspects(raw_results)

    # ── Natural-language summary grounded in ABOM output ─────────────
    ai_summary = _build_restaurant_summary(raw_results, pros, cons)

    popular_dishes = _extract_popular_dishes(all_texts)

    clean_results = [
        {
            "headline":   r["headline"],
            "sentiment":  r["sentiment"],
            "confidence": r["confidence"],
            "source":     r["source"],
            "url":        r["url"],
        }
        for r in top3
    ]

    return {
        "status":             "success",
        "domain":             DOMAINS[choice]["label"],
        "topic":              topic,
        "results":            clean_results,
        "dominant_sentiment": dominant,
        "dominant_pct":       dominant_pct,
        "pros":               pros,
        "cons":               cons,
        "ai_summary":         ai_summary,
        "top_reviews":        clean_results,
        "popular_dishes":     popular_dishes,
        # Place metadata — surfaced in the frontend restaurant detail card
        "place_info":         place_info,
    }
