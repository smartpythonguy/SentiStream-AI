"""
news_analyzer.py
────────────────────────────────────────────────────────────
SentiStream AI — News Sentiment Analyzer
Run from project root:  python backend/news_analyzer.py
────────────────────────────────────────────────────────────
"""

import os
import sys
import re
from collections import Counter

# ── Path setup (keeps imports relative to backend/) ──────────────
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))   # .../backend
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)                # .../project root

sys.path.insert(0, CURRENT_DIR)    # so  "from rss_fetcher import ..." works
sys.path.insert(0, PROJECT_ROOT)   # so  pkl files are found at root level

# ── Local backend imports ────────────────────────────────────────
from rss_fetcher import fetch_articles   # pulls live RSS feeds
from predictor import Predictor          # transformer-based sentiment model


# ════════════════════════════════════════════════════════════════
#  HELPER: keyword extractor
# ════════════════════════════════════════════════════════════════

# Words too common to be useful as keywords
STOPWORDS = {
    "this", "that", "with", "from", "have", "will", "they", "their",
    "about", "there", "would", "could", "should", "after", "before",
    "because", "while", "where", "when", "what", "which", "been",
    "being", "into", "over", "under", "news", "said", "says", "more",
    "than", "just", "also", "your", "some", "were", "then", "them",
    "these", "those", "such", "very", "even", "only", "much", "many",
    "like", "well", "back", "time", "year", "make", "made",
}


def extract_keywords(texts: list, top_n: int = 10) -> list:
    """
    Return the top_n most frequent meaningful words across all texts.
    Each text is a raw headline + summary string.
    """
    words = []
    for text in texts:
        # Keep only letters, lowercase everything
        tokens = re.sub(r"[^a-zA-Z\s]", " ", text.lower()).split()
        words.extend(
            w for w in tokens
            if len(w) > 3 and w not in STOPWORDS
        )
    return [word for word, _ in Counter(words).most_common(top_n)]


def _shorten(text: str, max_len: int = 100) -> str:
    """Trim a headline to a clean, sentence-friendly fragment."""
    text = text.strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:")


def build_narrative(headlines: list, sentiment: str) -> str:
    """
    Build a natural-language paragraph describing the news coverage in a
    sentiment group, grounded in the ACTUAL headlines rather than a list
    of frequent keywords. Mirrors backend/domain_router._build_news_narrative.

    `headlines` is a list of raw headline strings.
    """
    if not headlines:
        return f"No {sentiment.lower()} coverage was found for this topic."

    n = len(headlines)

    if n == 1:
        samples = [headlines[0]]
    elif n == 2:
        samples = headlines[:2]
    else:
        samples = [headlines[0], headlines[n // 2], headlines[-1]]

    fragments = [_shorten(s) for s in samples]

    if sentiment == "Positive":
        if n == 1:
            body = f'one positive story stands out: "{fragments[0]}"'
        elif n == 2:
            body = (
                f'two stories strike an upbeat tone — one reporting that '
                f'"{fragments[0]}", and another noting "{fragments[1]}"'
            )
        else:
            body = (
                f'coverage ranges from "{fragments[0]}" to "{fragments[-1]}", '
                f'with a story in between noting "{fragments[1]}"'
            )
        possessive = "its" if n > 1 else "this story's"
        return (
            f"Out of {n} headline{'s' if n != 1 else ''} flagged as positive, {body}. "
            f"Together they paint an encouraging picture for this topic, "
            f"suggesting the recent news cycle has leaned in {possessive} favour."
        )

    elif sentiment == "Negative":
        if n == 1:
            body = f'the lone negative headline reports "{fragments[0]}"'
        elif n == 2:
            body = (
                f'two stories raise concern — one stating "{fragments[0]}", '
                f'and another adding "{fragments[1]}"'
            )
        else:
            body = (
                f'the spread runs from "{fragments[0]}" through "{fragments[1]}" '
                f'to "{fragments[-1]}"'
            )
        return (
            f"{n} headline{'s' if n != 1 else ''} carried a negative tone, and {body}. "
            f"These reports point to friction or setbacks that readers following "
            f"this topic should be aware of."
        )

    else:  # Neutral
        if n == 1:
            body = f'the single neutral item reports "{fragments[0]}"'
        elif n == 2:
            body = f'"{fragments[0]}" and "{fragments[1]}" were both reported in a measured tone'
        else:
            body = (
                f'stories such as "{fragments[0]}" and "{fragments[-1]}" were reported '
                f'alongside "{fragments[1]}"'
            )
        return (
            f"{n} headline{'s' if n != 1 else ''} {'were' if n != 1 else 'was'} classified as neutral — {body}. "
            f"These pieces stick to factual reporting without taking a clear "
            f"positive or negative stance."
        )


def build_overall_summary(pos_count: int, neg_count: int, neu_count: int) -> str:
    """
    Compose a short, natural-language Overall Summary synthesising the
    balance across all three sentiment groups. Mirrors
    backend/domain_router._build_overall_summary.
    """
    total = pos_count + neg_count + neu_count
    if total == 0:
        return "No headlines were available to summarise for this topic."

    pos_pct = pos_count / total
    neg_pct = neg_count / total
    neu_pct = neu_count / total

    if pos_pct >= 0.55:
        tone = (
            f"Out of {total} headlines analysed, the majority ({pos_count} of {total}) "
            f"struck a positive tone, suggesting recent coverage of this topic "
            f"has been broadly favourable."
        )
    elif neg_pct >= 0.55:
        tone = (
            f"Out of {total} headlines analysed, the majority ({neg_count} of {total}) "
            f"carried a negative tone, indicating recent coverage has been "
            f"dominated by criticism or concern."
        )
    elif neu_pct >= 0.5:
        tone = (
            f"Out of {total} headlines analysed, most ({neu_count} of {total}) were "
            f"neutral in tone, suggesting coverage has so far stayed largely "
            f"factual rather than opinionated."
        )
    else:
        tone = (
            f"Out of {total} headlines analysed, opinion is split — {pos_count} positive, "
            f"{neg_count} negative, and {neu_count} neutral — pointing to a story still "
            f"developing without a clear narrative direction."
        )

    counts = {"positive": pos_count, "negative": neg_count, "neutral": neu_count}
    sorted_groups = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    runner_up = sorted_groups[1]

    if runner_up[1] > 0:
        followup = (
            f" A smaller share of coverage ({runner_up[1]} headline"
            f"{'s' if runner_up[1] != 1 else ''}) leaned {runner_up[0]}, "
            f"adding some nuance to the overall picture."
        )
    else:
        followup = ""

    return tone + followup


# ════════════════════════════════════════════════════════════════
#  HELPER: simple ASCII bar chart
# ════════════════════════════════════════════════════════════════

def bar(pct: float, width: int = 28) -> str:
    """Turn a percentage into a visual bar:  ████░░░░  63%"""
    filled = round(pct / 100 * width)
    return "█" * filled + "░" * (width - filled) + f"  {pct:.1f}%"


# ════════════════════════════════════════════════════════════════
#  HELPER: print one headline block
# ════════════════════════════════════════════════════════════════

def _print_headline(index: int, item: dict) -> None:
    """Print a single article entry in a consistent format."""
    summary_raw = item.get("summary") or ""
    preview = summary_raw[:160].strip()
    if len(summary_raw) > 160:
        preview += "…"
    print(f"\n  {index}. {item['headline']}")
    print(f"     Source  : {item['source']}")
    print(f"     Summary : {preview}")


# ════════════════════════════════════════════════════════════════
#  MAIN ANALYSIS FUNCTION
# ════════════════════════════════════════════════════════════════

def analyze_news(topic: str) -> None:
    """
    Full pipeline:
      1. Fetch live RSS articles for `topic`
      2. Clean text with TextCleaner
      3. Predict sentiment (Positive / Neutral / Negative)
      4. Print a formatted report to the console
    """

    # ── 1. Fetch ─────────────────────────────────────────────────
    print(f"\n🔍  Fetching news for: '{topic}' …\n")

    articles = fetch_articles(
        keyword=topic,
        sources=["google_news", "bbc", "reuters", "techcrunch"],
        max_per_source=10,
    )

    if not articles:
        print("❌  No articles found.")
        print("    → Check your internet connection or try a different topic.")
        return

    print(f"✅  {len(articles)} articles fetched.\n")

    # ── 2. Build predictor (transformer model, loaded once) ───────
    predictor = Predictor()

    # ── 3. Predict sentiment for every article in one batch ───────
    raw_texts = [
        f"{article['headline']} {article['summary']}"
        for article in articles
    ]

    predictions = predictor.predict_batch(raw_texts)

    sentiments:       list = []
    article_texts:    list = []
    detailed_results: list = []

    for article, raw_text, pred in zip(articles, raw_texts, predictions):
        pred_label = pred["label"]
        sentiments.append(pred_label)
        article_texts.append(raw_text)
        detailed_results.append({
            "headline":  article["headline"],
            "source":    article["source"],
            "sentiment": pred_label,
            "summary":   article["summary"],
        })

    total = len(sentiments)

    if total == 0:
        print("❌  All articles were empty after cleaning. Nothing to analyse.")
        return

    # ── 4. Tally counts and percentages ──────────────────────────
    pos = sentiments.count("Positive")
    neu = sentiments.count("Neutral")
    neg = sentiments.count("Negative")

    pos_pct = (pos / total) * 100
    neu_pct = (neu / total) * 100
    neg_pct = (neg / total) * 100

    # Overall verdict
    if pos_pct >= 55:
        verdict = "🟢  Mostly Positive"
    elif neg_pct >= 55:
        verdict = "🔴  Mostly Negative"
    elif neu_pct >= 50:
        verdict = "🔵  Mostly Neutral"
    else:
        verdict = "🟡  Mixed Opinions"

    # ── 5. Keywords ───────────────────────────────────────────────
    keywords = extract_keywords(article_texts)

    # ── 6. Bucket articles by sentiment ──────────────────────────
    positives = [r for r in detailed_results if r["sentiment"] == "Positive"]
    negatives = [r for r in detailed_results if r["sentiment"] == "Negative"]
    neutrals  = [r for r in detailed_results if r["sentiment"] == "Neutral"]

    # ── 7. Print report ───────────────────────────────────────────
    DIVIDER = "═" * 62
    THIN    = "─" * 62

    print(DIVIDER)
    print("  📰  SENTISTREAM AI — NEWS SENTIMENT REPORT")
    print(f"  Topic  : {topic.upper()}")
    print(f"  Sample : {total} articles analysed")
    print(DIVIDER)

    # Overall verdict
    print(f"\n  Overall Verdict : {verdict}\n")

    # Sentiment bar chart
    print("  Sentiment Breakdown:")
    print(f"  ✅ Positive  {bar(pos_pct)}  ({pos})")
    print(f"  ➖ Neutral   {bar(neu_pct)}  ({neu})")
    print(f"  ❌ Negative  {bar(neg_pct)}  ({neg})")

    # Top keywords
    print(f"\n  🔑  Top Keywords:")
    print(f"  {', '.join(keywords) if keywords else 'N/A'}")

    # ── AI Summaries ────────────────────────────────────────────
    pos_headlines_text = [r["headline"] for r in positives]
    neg_headlines_text = [r["headline"] for r in negatives]
    neu_headlines_text = [r["headline"] for r in neutrals]

    print(f"\n{THIN}")
    print("  🧠  AI OVERALL SUMMARY")
    print(THIN)
    print(f"  {build_overall_summary(pos, neg, neu)}")

    print(f"\n{THIN}")
    print("  ✅  POSITIVE NARRATIVE")
    print(THIN)
    print(f"  {build_narrative(pos_headlines_text, 'Positive')}")

    print(f"\n{THIN}")
    print("  ❌  NEGATIVE NARRATIVE")
    print(THIN)
    print(f"  {build_narrative(neg_headlines_text, 'Negative')}")

    print(f"\n{THIN}")
    print("  ➖  NEUTRAL NARRATIVE")
    print(THIN)
    print(f"  {build_narrative(neu_headlines_text, 'Neutral')}")


    # ── Positive headlines ────────────────────────────────────────
    print(f"\n{THIN}")
    print("  ✅  POSITIVE HEADLINES")
    print(THIN)
    if positives:
        for i, item in enumerate(positives[:5], 1):
            _print_headline(i, item)
    else:
        print("  (none found)")

    # ── Negative headlines ────────────────────────────────────────
    print(f"\n{THIN}")
    print("  ❌  NEGATIVE HEADLINES")
    print(THIN)
    if negatives:
        for i, item in enumerate(negatives[:5], 1):
            _print_headline(i, item)
    else:
        print("  (none found)")

    # ── Neutral headlines ─────────────────────────────────────────
    print(f"\n{THIN}")
    print("  ➖  NEUTRAL HEADLINES")
    print(THIN)
    if neutrals:
        for i, item in enumerate(neutrals[:3], 1):
            _print_headline(i, item)
    else:
        print("  (none found)")

    print(f"\n{DIVIDER}\n")


# ════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("╔══════════════════════════════════════╗")
    print("║   SentiStream AI  —  News Analyzer   ║")
    print("╚══════════════════════════════════════╝")

    try:
        topic = input("\nEnter a news topic (e.g. AI, Tesla, Climate): ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n\nExiting. Goodbye!")
        sys.exit(0)

    if not topic:
        print("❌  Topic cannot be empty. Run the script again.")
        sys.exit(1)

    analyze_news(topic)
