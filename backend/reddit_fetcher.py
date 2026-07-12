"""
reddit_fetcher.py
Fetches Reddit posts for a given topic using the public RSS feed and feedparser.
Filters aggressively for high-quality consumer experience discussions only.

Usage:
    posts = fetch_reddit_posts("Pixel 9a")
    for post in posts:
        print(post["title"])
        print(post["summary"])
        print(post["link"])
"""

import re
import urllib.parse
from difflib import SequenceMatcher

try:
    import feedparser
except ImportError:
    raise ImportError("feedparser is not installed.\nRun:  pip install feedparser")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Titles containing any of these words/phrases are excluded (low-quality signals)
_EXCLUDE_KEYWORDS = [
    "help", "advice", "should i", "worth it", "question",
    "release date", "specs", "leak", "rumor", "rumour",
    "announced", "official", "hands-on", "first look",
    "breaking", "exclusive", "report", "according to",
    "pre-order", "preorder", "launch", "unveil", "introduces",
    "price cut", "deal", "discount", "sale", "coupon",
]

# News-style domain patterns — entries whose links come from these are dropped
_NEWS_DOMAINS = re.compile(
    r"(9to5google|theverge|gsmarena|androidauthority|techradar|"
    r"androidcentral|phonearena|engadget|cnet|tomshardware|"
    r"digitaltrends|wired|gizmodo|macrumors|bgr\.com|"
    r"xda-developers|notebookcheck|sammobile|slashgear|"
    r"androidpolice|phandroid|droid-life|androidheadlines)",
    re.IGNORECASE,
)

# Titles that match these community / meta patterns are excluded
_COMMUNITY_PATTERNS = [
    re.compile(r"^r/", re.IGNORECASE),
    re.compile(r"^u/", re.IGNORECASE),
    re.compile(r"^/r/", re.IGNORECASE),
    re.compile(r"^/u/", re.IGNORECASE),
    re.compile(r"^\w[\w\s]{0,20}\s+users?$", re.IGNORECASE),
    re.compile(r"^\w[\w\s]{0,20}\s+community$", re.IGNORECASE),
    re.compile(r"^\w[\w\s]{0,20}\s+subreddit$", re.IGNORECASE),
    re.compile(r"^(the\s+)?\w[\w\s]{0,20}\s+reddit$", re.IGNORECASE),
]

# Presence of any of these phrases in the title boosts the quality score
_EXPERIENCE_PHRASES = [
    "review", "experience", "after 1 month", "after one month",
    "after 2 months", "after two months", "after 3 months", "after three months",
    "after 6 months", "after a week", "after a year", "long term", "long-term",
    "battery life", "battery drain", "camera", "performance", "heating",
    "overheating", "throttling", "daily driver", "real world", "real-world",
    "impressed", "disappointed", "switched from", "coming from",
    "ownership", "hands on", "daily use", "in-depth", "detailed",
    "honest", "unboxing", "setup", "replaced my", "upgrade from",
]

# A title must contain at least one of these to qualify as a real discussion
_DISCUSSION_SIGNALS = re.compile(
    r"[!]|"
    r"\b(is|are|was|were|have|has|had|does|did|"
    r"love|hate|miss|wish|prefer|notice|find|feel|think|believe|"
    r"best|worst|better|worse|great|terrible|amazing|awful|solid|"
    r"vs|versus|compared|switched|coming|replaced|upgrade|"
    r"review|experience|battery|camera|performance|heating|"
    r"impressed|disappointed|recommend|avoid|buy|return|"
    r"after|month|week|year|daily|real|honest|detailed|"
    r"issue|problem|bug|fix|lag|slow|fast|smooth|crash)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# HTML / text cleaning
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode common HTML entities."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    entities = {
        "&amp;": "&", "&lt;": "<", "&gt;": ">",
        "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
    }
    for entity, char in entities.items():
        text = text.replace(entity, char)
    return re.sub(r"\s+", " ", text).strip()


def _clean_summary(summary: str) -> str:
    """Strip Reddit RSS boilerplate from the summary field."""
    summary = _strip_html(summary)
    summary = re.sub(
        r"^submitted\s+by\s+/u/\S+(\s+(in|to)\s+/r/\S+)?\s*",
        "", summary, flags=re.IGNORECASE,
    )
    summary = re.sub(r"\[link\]|\[comments\]", "", summary, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", summary).strip()


# ---------------------------------------------------------------------------
# Filter helpers
# ---------------------------------------------------------------------------

def _is_community_label(title: str) -> bool:
    return any(p.search(title.strip()) for p in _COMMUNITY_PATTERNS)


def _contains_excluded_keyword(title: str) -> bool:
    t = title.lower()
    return any(kw in t for kw in _EXCLUDE_KEYWORDS)


def _is_news_repost(link: str, title: str) -> bool:
    """Exclude entries that link to news domains or read like headlines."""
    if _NEWS_DOMAINS.search(link):
        return True
    # Headline patterns: "X announces Y", "X reveals Y", "X launches Y"
    if re.search(
        r"\b(announces?|reveals?|launches?|introduces?|unveils?|reports?)\b",
        title, re.IGNORECASE,
    ):
        return True
    return False


def _has_discussion_signal(title: str) -> bool:
    return bool(_DISCUSSION_SIGNALS.search(title))


def _is_near_duplicate(title: str, seen: list, threshold: float = 0.80) -> bool:
    return any(
        SequenceMatcher(None, title.lower(), s.lower()).ratio() >= threshold
        for s in seen
    )


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score_post(title: str, summary: str) -> int:
    """
    Higher score = better consumer discussion quality.
    Experience phrases carry the most weight.
    """
    score = 0
    title_lower  = title.lower()
    combined     = title_lower + " " + summary.lower()

    # Experience phrase hits (most valuable signal)
    for phrase in _EXPERIENCE_PHRASES:
        if phrase in combined:
            score += 5

    # Longer titles tend to be more descriptive
    score += min(len(title), 150) // 15

    # Summary has real body text
    if len(summary) > 120:
        score += 4
    elif len(summary) > 40:
        score += 2

    # First-person signals → personal experience
    if re.search(r"\b(i |my |me |we |our )", combined):
        score += 3

    return score


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_reddit_posts(topic: str, limit: int = 20) -> list:
    """
    Fetch and return the top 10 highest-quality Reddit consumer-experience
    posts matching *topic*, using the public Reddit RSS feed.

    Filtered out automatically:
        - Titles ending with '?'
        - Titles containing: help, advice, should I, worth it, question,
          release date, specs, and other low-signal keywords
        - Titles shorter than 20 characters
        - News article reposts (detected by domain and headline language)
        - Subreddit / community / username labels
        - Near-duplicate titles (≥ 80 % similarity)

    Prioritised:
        - Posts mentioning real user experience keywords (review, battery life,
          camera, performance, heating, after N months, etc.)

    Args:
        topic : Keyword or phrase to search for.
        limit : Raw RSS entries to fetch before filtering (default 20;
                raised internally to 50 for enough candidates).

    Returns:
        List of up to 10 dicts with keys:
            title   — clean discussion title
            summary — plain-text summary (HTML and boilerplate removed)
            link    — direct URL to the Reddit post
    """
    encoded_topic = urllib.parse.quote_plus(topic)
    fetch_limit   = max(limit, 50)
    url = (
        f"https://www.reddit.com/search.rss"
        f"?q={encoded_topic}&sort=relevance&limit={fetch_limit}"
    )

    feed = feedparser.parse(url)

    candidates = []
    for entry in feed.entries:
        title   = _strip_html(entry.get("title", "")).strip()
        summary = _clean_summary(entry.get("summary", ""))
        link    = entry.get("link", "").strip()

        # ── Hard filters ──────────────────────────────────────────
        if len(title) < 20:
            continue
        if title.endswith("?"):
            continue
        if _is_community_label(title):
            continue
        if _contains_excluded_keyword(title):
            continue
        if _is_news_repost(link, title):
            continue
        if not _has_discussion_signal(title):
            continue
        if not link.startswith("https://www.reddit.com"):
            continue

        candidates.append({
            "title":   title,
            "summary": summary,
            "link":    link,
            "_score":  _score_post(title, summary),
        })

    # ── Sort by quality score, then deduplicate ───────────────────
    candidates.sort(key=lambda p: p["_score"], reverse=True)

    seen_titles: list = []
    results     = []
    for post in candidates:
        if _is_near_duplicate(post["title"], seen_titles):
            continue
        seen_titles.append(post["title"])
        results.append({
            "title":   post["title"],
            "summary": post["summary"],
            "link":    post["link"],
        })
        if len(results) == 10:
            break

    return results
