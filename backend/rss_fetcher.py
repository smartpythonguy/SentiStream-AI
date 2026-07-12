"""
rss_fetcher.py — SentiStream AI
================================
Fetches live RSS feeds from Google News, BBC, Reuters, and TechCrunch.
Filters articles by keyword/topic and returns structured, clean data
ready for use in a sentiment analysis pipeline.

Usage (VS Code / terminal):
    python backend/rss_fetcher.py

Or import into your pipeline:
    from rss_fetcher import fetch_articles
    articles = fetch_articles("AI", sources=["bbc", "techcrunch"])
"""

import feedparser
import re
import html
from datetime import datetime
from typing import Optional
from email.utils import parsedate_to_datetime


# ---------------------------------------------------------------------------
# RSS Feed Source Registry
# Each entry maps a friendly name to its RSS URL.
# Add or swap URLs here without touching any other code.
# ---------------------------------------------------------------------------

RSS_SOURCES: dict[str, str] = {
    "google_news": "https://news.google.com/rss",
    "bbc":         "https://feeds.bbci.co.uk/news/rss.xml",
    "reuters":     "https://feeds.reuters.com/reuters/topNews",
    "techcrunch":  "https://techcrunch.com/feed/",
}

# Google News supports a topic/keyword query via URL parameter
GOOGLE_NEWS_SEARCH_URL = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"


# ---------------------------------------------------------------------------
# Text Cleaning Helpers
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode HTML entities from a string."""
    if not text:
        return ""
    text = html.unescape(text)                  # &amp; → &, &lt; → <, etc.
    text = re.sub(r"<[^>]+>", "", text)         # strip <tag>...</tag>
    text = re.sub(r"\s+", " ", text).strip()    # collapse whitespace
    return text


def _parse_date(entry) -> str:
    """
    Extract a human-readable published date from a feed entry.
    Returns an ISO-format string (YYYY-MM-DD HH:MM:SS) or 'Unknown'.
    """
    # feedparser normalises dates into a time.struct_time in 'published_parsed'
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            dt = datetime(*entry.published_parsed[:6])
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    # Fallback: raw RFC-2822 string → datetime
    raw = getattr(entry, "published", "") or getattr(entry, "updated", "")
    if raw:
        try:
            return parsedate_to_datetime(raw).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    return "Unknown"


def _clean_summary(summary: str) -> str:
    """
    Clean a raw RSS summary:
    - Strip HTML
    - Remove Reuters / BBC source suffixes like '(Reuters)'
    - Truncate to a readable length
    """
    text = _strip_html(summary)
    text = re.sub(r"\s*\(Reuters\)\s*-?\s*", "", text)   # Reuters prefix
    text = re.sub(r"\s*- BBC.*$", "", text)               # BBC suffix
    text = text.strip()
    # Truncate at 500 chars, breaking on a word boundary
    if len(text) > 500:
        text = text[:500].rsplit(" ", 1)[0] + "…"
    return text


# ---------------------------------------------------------------------------
# Article Builder
# ---------------------------------------------------------------------------

def _build_article(entry, source_name: str) -> dict:
    """
    Turn a single feedparser entry into a clean, structured dict.

    Returns:
        {
            "headline":  str,
            "summary":   str,
            "source":    str,
            "published": str,   # "YYYY-MM-DD HH:MM:SS" or "Unknown"
            "link":      str,
        }
    """
    headline = _strip_html(getattr(entry, "title", "No title"))
    raw_summary = (
        getattr(entry, "summary", "")
        or getattr(entry, "description", "")
        or ""
    )
    summary  = _clean_summary(raw_summary) or "No summary available."
    link     = getattr(entry, "link", "#")
    pub_date = _parse_date(entry)

    return {
        "headline":  headline,
        "summary":   summary,
        "source":    source_name,
        "published": pub_date,
        "link":      link,
    }


# ---------------------------------------------------------------------------
# Per-Source Fetcher
# ---------------------------------------------------------------------------

def _fetch_from_source(source_key: str, keyword: Optional[str] = None) -> list[dict]:
    """
    Fetch and parse articles from a single RSS source.

    Args:
        source_key: One of the keys in RSS_SOURCES (case-insensitive).
        keyword:    Optional keyword to filter headlines/summaries.

    Returns:
        A list of article dicts.
    """
    source_key = source_key.lower()

    # Google News can embed the keyword directly in the URL for better results
    if source_key == "google_news" and keyword:
        url = GOOGLE_NEWS_SEARCH_URL.format(query=keyword.replace(" ", "+"))
    else:
        url = RSS_SOURCES.get(source_key)
        if not url:
            print(f"[rss_fetcher] ⚠️  Unknown source '{source_key}' — skipping.")
            return []

    print(f"[rss_fetcher] 📡 Fetching from {source_key}: {url}")
    feed = feedparser.parse(url)

    if feed.bozo:
        # bozo=True means feedparser encountered a malformed feed
        print(f"[rss_fetcher] ⚠️  Feed may be malformed for '{source_key}': {feed.bozo_exception}")

    articles = []
    for entry in feed.entries:
        article = _build_article(entry, source_name=source_key)

        # Keyword filter (applied to headline + summary, case-insensitive)
        if keyword:
            haystack = (article["headline"] + " " + article["summary"]).lower()
            if keyword.lower() not in haystack:
                continue

        articles.append(article)

    print(f"[rss_fetcher] ✅  {len(articles)} article(s) from '{source_key}'")
    return articles


# ---------------------------------------------------------------------------
# Public API — use this in your sentiment pipeline
# ---------------------------------------------------------------------------

def fetch_articles(
    keyword: Optional[str] = None,
    sources: Optional[list[str]] = None,
    max_per_source: int = 10,
) -> list[dict]:
    """
    Fetch articles from one or more RSS sources, optionally filtered by keyword.

    Args:
        keyword:        Topic or keyword to search/filter (e.g. "AI", "climate").
                        Pass None to fetch all headlines without filtering.
        sources:        List of source keys to query. Defaults to all four sources.
                        Valid keys: "google_news", "bbc", "reuters", "techcrunch"
        max_per_source: Maximum number of articles to keep per source.

    Returns:
        A flat list of article dicts, each containing:
            - headline  (str)
            - summary   (str)
            - source    (str)
            - published (str)
            - link      (str)

    Example:
        >>> from rss_fetcher import fetch_articles
        >>> articles = fetch_articles("machine learning", sources=["bbc", "techcrunch"])
        >>> for a in articles:
        ...     print(a["headline"], "|", a["source"])
    """
    if sources is None:
        sources = list(RSS_SOURCES.keys())   # all four by default

    all_articles: list[dict] = []

    for source in sources:
        fetched = _fetch_from_source(source, keyword=keyword)
        all_articles.extend(fetched[:max_per_source])

    # Sort newest-first (entries with "Unknown" dates fall to the bottom)
    all_articles.sort(
        key=lambda a: a["published"] if a["published"] != "Unknown" else "",
        reverse=True,
    )

    return all_articles


# ---------------------------------------------------------------------------
# Sentiment-Pipeline Integration Helper
# ---------------------------------------------------------------------------

def articles_to_sentiment_input(articles: list[dict]) -> list[dict]:
    """
    Convert fetched articles into the format expected by a sentiment model.

    Returns a list of dicts with:
        - text:   headline + " " + summary  (the string to score)
        - meta:   original article dict     (for downstream labelling)

    Plug this directly into your sentiment pipeline, e.g.:
        inputs  = articles_to_sentiment_input(articles)
        results = [sentiment_model.predict(i["text"]) for i in inputs]
    """
    return [
        {
            "text": f"{a['headline']}. {a['summary']}",
            "meta": a,
        }
        for a in articles
    ]


# ---------------------------------------------------------------------------
# CLI — run directly in VS Code terminal: python backend/rss_fetcher.py
# ---------------------------------------------------------------------------

def _print_article(article: dict, index: int) -> None:
    """Pretty-print a single article to the terminal."""
    sep = "─" * 70
    print(f"\n{sep}")
    print(f"  #{index + 1}  [{article['source'].upper()}]  {article['published']}")
    print(f"{sep}")
    print(f"  📰  {article['headline']}")
    print(f"  📝  {article['summary']}")
    print(f"  🔗  {article['link']}")


# ---------------------------------------------------------------------------
# Test / Mock mode — used to verify the pipeline without live network access
# Run: python backend/rss_fetcher.py --test
# ---------------------------------------------------------------------------

_MOCK_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Feed</title>
    <item>
      <title>AI model breaks new benchmark in reasoning tasks</title>
      <description>Researchers unveiled a new &lt;b&gt;AI system&lt;/b&gt; that outperforms all prior models on complex reasoning benchmarks, raising fresh debates about capabilities.</description>
      <link>https://example.com/ai-benchmark</link>
      <pubDate>Wed, 13 May 2026 08:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Tech layoffs continue despite record profits</title>
      <description>Several major technology firms announced fresh rounds of redundancies this week, even as quarterly earnings hit all-time highs.</description>
      <link>https://example.com/tech-layoffs</link>
      <pubDate>Wed, 13 May 2026 06:30:00 +0000</pubDate>
    </item>
    <item>
      <title>Climate summit reaches landmark carbon agreement</title>
      <description>World leaders signed a historic accord pledging net-zero emissions by 2040, with binding targets for the G20 bloc.</description>
      <link>https://example.com/climate-summit</link>
      <pubDate>Tue, 12 May 2026 22:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>"""


def fetch_articles_mock(keyword: Optional[str] = None, max_per_source: int = 10) -> list[dict]:
    """
    Returns mock articles for local testing — no network required.
    Useful for CI pipelines, unit tests, and offline development.
    """
    import io
    feed = feedparser.parse(io.BytesIO(_MOCK_FEED.encode()))
    articles = []
    for entry in feed.entries:
        article = _build_article(entry, source_name="mock")
        if keyword:
            haystack = (article["headline"] + " " + article["summary"]).lower()
            if keyword.lower() not in haystack:
                continue
        articles.append(article)
    return articles[:max_per_source]


# ---------------------------------------------------------------------------
# CLI — run directly in VS Code terminal
#   Live mode : python backend/rss_fetcher.py "artificial intelligence"
#   Test mode : python backend/rss_fetcher.py --test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    TEST_MODE = "--test" in sys.argv
    clean_args = [a for a in sys.argv[1:] if a != "--test"]

    if TEST_MODE:
        keyword = "AI"
        print(f"\n{'═' * 70}")
        print("  SentiStream AI — RSS Fetcher  [MOCK / TEST MODE]")
        print(f"  Keyword : {keyword!r}  |  No network required")
        print(f"{'═' * 70}\n")

        articles = fetch_articles_mock(keyword=keyword)
        for i, article in enumerate(articles):
            _print_article(article, i)

        pipeline_input = articles_to_sentiment_input(articles)
        print(f"\n  ✅ Mock pipeline input ready — {len(pipeline_input)} item(s)")
        print(f"  text → {pipeline_input[0]['text'][:120]}…\n")

    else:
        keyword = " ".join(clean_args) if clean_args else "technology"

        print(f"\n{'═' * 70}")
        print(f"  SentiStream AI — RSS Fetcher")
        print(f"  Keyword : {keyword!r}")
        print(f"  Sources : {', '.join(RSS_SOURCES.keys())}")
        print(f"{'═' * 70}\n")

        articles = fetch_articles(keyword=keyword, max_per_source=5)

        if not articles:
            print("  No articles found. Try a broader keyword.")
            print("  Tip: run with --test to verify the pipeline offline.\n")
            sys.exit(0)

        for i, article in enumerate(articles):
            _print_article(article, i)

        print(f"\n{'═' * 70}")
        print(f"  Total articles fetched: {len(articles)}")
        print(f"{'═' * 70}\n")

        pipeline_input = articles_to_sentiment_input(articles)
        print("  Sample sentiment pipeline input (first article):")
        print(f"  text → {pipeline_input[0]['text'][:120]}…\n")