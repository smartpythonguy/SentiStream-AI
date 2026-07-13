"""
backend/movie_review_collector.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Movie Review Collector (v1.0)

Completely independent of sentiment prediction.  Collects raw review
text from up to 7 sources, stores structured review objects, then
deduplicates before returning them to the caller.

Sources (attempted in priority order):
    1. Google Reviews      (via SerpApi / custom search)
    2. IMDb                (user reviews page scrape)
    3. Rotten Tomatoes     (audience + critic reviews)
    4. Metacritic          (user reviews)
    5. Letterboxd          (film page + recent reviews)
    6. TMDb Reviews        (API — requires TMDB_API_KEY)
    7. RogerEbert.com      (review body)
    8. Wikipedia           (plot + critical-reception summary)

Each collected review is stored as a ReviewItem TypedDict:
    {
        "text":   str,          # review body — goes to sentiment model
        "source": str,          # canonical source name
        "rating": str | None,   # e.g. "8.2/10", "4/5", "87%" — None if absent
        "url":    str,          # direct link to the review or source page
    }

Deduplication:
    • Exact duplicate text is removed (set-based).
    • Near-duplicate text (≥ 90 % character overlap via SequenceMatcher)
      is collapsed to whichever copy appeared first.
    • Empty / whitespace-only texts are always dropped.

Public API:
    from movie_review_collector import collect_movie_reviews

    reviews = collect_movie_reviews(
        topic     = "Pushpa 2",
        movie_info = info_dict,   # optional; supplies imdb_id + title
        max_per_source = 12,      # default
    )
    # returns List[ReviewItem]  — ready to hand to _predictor.predict_batch()
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from typing import Dict, List, Optional, TypedDict

log = logging.getLogger("SentiStream.movie_collector")

# ── HTTP / scraping constants ──────────────────────────────────────────
_TIMEOUT = 9       # seconds per request
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent":      _UA,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Minimum character length for a review to be meaningful
_MIN_TEXT_LEN = 30

# Similarity threshold above which two reviews are considered near-duplicates
_DEDUP_THRESHOLD = 0.90


# ── Review schema ──────────────────────────────────────────────────────

class ReviewItem(TypedDict):
    text:   str
    source: str
    rating: Optional[str]
    url:    str


# ── Low-level HTTP helpers ─────────────────────────────────────────────

def _get(url: str, extra_headers: Optional[Dict[str, str]] = None) -> Optional[bytes]:
    """Fetch *url* and return raw bytes; None on any error."""
    try:
        hdrs = {**_HEADERS, **(extra_headers or {})}
        req  = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
            return r.read()
    except Exception as exc:
        log.debug("GET %s → %s", url, exc)
        return None


def _html(url: str, extra_headers: Optional[Dict[str, str]] = None) -> str:
    """Return decoded HTML for *url*, empty string on failure."""
    raw = _get(url, extra_headers)
    if raw is None:
        return ""
    try:
        return raw.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _jget(url: str, extra_headers: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Fetch and JSON-parse *url*; None on any error."""
    raw = _get(url, extra_headers)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# ── Text normalisation ─────────────────────────────────────────────────

def _clean_text(raw: str) -> str:
    """
    Minimal clean: collapse whitespace and strip HTML entities / tags.
    Does NOT run full NLP cleaning — that belongs to the sentiment pipeline.
    """
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", raw)
    # Decode common HTML entities
    text = (
        text
        .replace("&amp;",  "&")
        .replace("&lt;",   "<")
        .replace("&gt;",   ">")
        .replace("&quot;", '"')
        .replace("&#39;",  "'")
        .replace("&nbsp;", " ")
    )
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _make_review(
    text:   str,
    source: str,
    url:    str,
    rating: Optional[str] = None,
) -> Optional[ReviewItem]:
    """
    Validate and return a ReviewItem, or None if the text is too short.
    """
    cleaned = _clean_text(text)
    if len(cleaned) < _MIN_TEXT_LEN:
        return None
    return ReviewItem(
        text   = cleaned,
        source = source,
        rating = rating or None,
        url    = url,
    )


# ── Deduplication ──────────────────────────────────────────────────────

def _deduplicate(reviews: List[ReviewItem]) -> List[ReviewItem]:
    """
    Remove exact and near-duplicate review texts.

    Pass 1 — exact: normalise text to lowercase + collapsed whitespace and
              drop any review whose normalised form has been seen before.
    Pass 2 — near:  for every surviving pair, compute SequenceMatcher ratio;
              drop the later one if ratio ≥ _DEDUP_THRESHOLD.

    This is O(n²) on near-duplicates but n is typically < 100, so it's fast.
    """
    # Pass 1: exact dedup
    seen_exact: set = set()
    pass1: List[ReviewItem] = []
    for r in reviews:
        key = re.sub(r"\s+", " ", r["text"].lower()).strip()
        if key and key not in seen_exact:
            seen_exact.add(key)
            pass1.append(r)

    # Pass 2: near-duplicate dedup
    kept: List[ReviewItem] = []
    for candidate in pass1:
        norm_c = candidate["text"].lower()
        is_dup = False
        for existing in kept:
            norm_e = existing["text"].lower()
            ratio  = SequenceMatcher(None, norm_c, norm_e, autojunk=False).ratio()
            if ratio >= _DEDUP_THRESHOLD:
                is_dup = True
                break
        if not is_dup:
            kept.append(candidate)

    log.debug(
        "Dedup: %d raw → %d after exact → %d after near-dup",
        len(reviews), len(pass1), len(kept),
    )
    return kept


# ─────────────────────────────────────────────────────────────────────
# Source collectors
# Each function returns List[ReviewItem] (may be empty on failure).
# ─────────────────────────────────────────────────────────────────────


# ── 1. Google Reviews ─────────────────────────────────────────────────

def _collect_google(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Collect via Google Custom Search JSON API (requires GOOGLE_CSE_API_KEY
    and GOOGLE_CSE_ID env vars).  Searches for "<topic> movie reviews site:*".

    Falls back silently when keys are absent — no crash, no mock data.
    """
    api_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    cse_id  = os.environ.get("GOOGLE_CSE_ID",  "").strip()
    if not api_key or not cse_id:
        log.debug("Google Reviews: env vars GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID not set — skipping")
        return []

    query  = f"{topic} movie review"
    params = urllib.parse.urlencode({
        "key":   api_key,
        "cx":    cse_id,
        "q":     query,
        "num":   min(max_items, 10),
    })
    data = _jget(f"https://www.googleapis.com/customsearch/v1?{params}")
    if not data:
        return []

    results = []
    for item in data.get("items", [])[:max_items]:
        snippet = item.get("snippet", "")
        link    = item.get("link", "https://www.google.com")
        r = _make_review(snippet, "Google Reviews", link)
        if r:
            results.append(r)

    log.debug("Google Reviews: %d items collected", len(results))
    return results


# ── 2. IMDb User Reviews ──────────────────────────────────────────────

def _collect_imdb(imdb_id: str, max_items: int) -> List[ReviewItem]:
    """
    Scrape the IMDb user-reviews page for the title identified by *imdb_id*.
    Extracts review text and numeric ratings (x/10).
    """
    if not imdb_id:
        log.debug("IMDb reviews: no imdb_id — skipping")
        return []

    url  = f"https://www.imdb.com/title/{imdb_id}/reviews/"
    page = _html(url, {"Accept": "text/html"})
    if not page:
        return []

    reviews = []

    # Each user review lives in a <div class="review-container"> block.
    # We extract the content block, then pull rating and text from within.
    blocks = re.findall(
        r'<div[^>]+class="[^"]*review-container[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>',
        page, re.S,
    )
    # Fallback: JSON-LD data sometimes contains review snippets
    if not blocks:
        ld_matches = re.findall(
            r'"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"', page
        )
        for body in ld_matches[:max_items]:
            text = body.encode("utf-8").decode("unicode_escape", errors="replace")
            r = _make_review(text, "IMDb", url)
            if r:
                reviews.append(r)
        if reviews:
            log.debug("IMDb: %d reviews via JSON-LD fallback", len(reviews))
            return reviews[:max_items]

    for block in blocks[:max_items]:
        # Rating: <span class="rating-other-user-rating"><span>N</span>/10</span>
        rat_m = re.search(
            r'rating-other-user-rating[^>]*>.*?<span>([\d.]+)</span>\s*/\s*10',
            block, re.S,
        )
        rating = f"{rat_m.group(1)}/10" if rat_m else None

        # Review text: inside <div class="text show-more__control ...">
        txt_m = re.search(
            r'class="[^"]*text\s+show-more__control[^"]*"[^>]*>(.*?)</div>',
            block, re.S,
        )
        if not txt_m:
            txt_m = re.search(r'class="[^"]*content[^"]*"[^>]*>(.*?)</div>', block, re.S)

        if txt_m:
            r = _make_review(txt_m.group(1), "IMDb", url, rating)
            if r:
                reviews.append(r)

    log.debug("IMDb: %d reviews collected", len(reviews))
    return reviews


# ── 3. Rotten Tomatoes ────────────────────────────────────────────────

def _rt_slug(topic: str) -> str:
    """Convert a movie title to a likely RT URL slug."""
    slug = topic.lower()
    slug = re.sub(r"[^\w\s]", "", slug)
    slug = re.sub(r"\s+", "_", slug.strip())
    return slug


def _collect_rotten_tomatoes(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Scrape audience + critic review snippets from Rotten Tomatoes.

    RT dynamically loads most content, so we rely on:
      • JSON-LD embedded in the page for critic snippets
      • og:description / meta description as a fallback summary
    """
    slug  = _rt_slug(topic)
    url   = f"https://www.rottentomatoes.com/m/{slug}"
    page  = _html(url)

    # Try a second slug variant if the first fails (e.g. "the_movie_2024")
    if not page or len(page) < 500:
        alt_slug = re.sub(r"_the$|^the_", "", slug)
        page = _html(f"https://www.rottentomatoes.com/m/{alt_slug}")
        url  = f"https://www.rottentomatoes.com/m/{alt_slug}"

    if not page:
        return []

    reviews = []

    # ── Critic reviews from JSON-LD ────────────────────────────────────
    # RT embeds some critic snippets in LD+JSON as "reviewBody"
    for body in re.findall(r'"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"', page)[:max_items]:
        text = body.encode("utf-8").decode("unicode_escape", errors="replace")
        r = _make_review(text, "Rotten Tomatoes", url)
        if r:
            reviews.append(r)

    # ── Tomatometer / audience score as pseudo-ratings ─────────────────
    # We surface these in the "rating" field of a synthetic summary item
    tomatometer = None
    audience    = None

    tm = re.search(r'"tomatometer_score"\s*:\s*(\d+)|"tomatoMeter"\s*:\s*(\d+)', page)
    if tm:
        tomatometer = f"{(tm.group(1) or tm.group(2))}%"

    am = re.search(r'"audience_score"\s*:\s*(\d+)|"audienceScore"\s*:\s*(\d+)', page)
    if am:
        audience = f"{(am.group(1) or am.group(2))}%"

    # ── og:description as a synopsis/review summary ───────────────────
    desc_m = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', page)
    if desc_m:
        summary = _clean_text(desc_m.group(1))
        # Build a score string only when we have at least one number
        scores = []
        if tomatometer:
            scores.append(f"Tomatometer {tomatometer}")
        if audience:
            scores.append(f"Audience {audience}")
        rating_str = " | ".join(scores) if scores else None
        r = _make_review(summary, "Rotten Tomatoes", url, rating_str)
        if r:
            reviews.insert(0, r)   # put summary first

    log.debug("Rotten Tomatoes: %d items collected", len(reviews))
    return reviews[:max_items]


# ── 4. Metacritic ─────────────────────────────────────────────────────

def _mc_slug(topic: str) -> str:
    """Convert a movie title to a likely Metacritic URL slug."""
    slug = topic.lower()
    slug = re.sub(r"[^\w\s]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return slug


def _collect_metacritic(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Scrape Metacritic for user reviews and the Metascore.
    Metacritic uses server-rendered HTML for the initial page load,
    so review snippets are usually accessible via regex on the HTML.
    """
    slug   = _mc_slug(topic)
    url    = f"https://www.metacritic.com/movie/{slug}/"
    page   = _html(url)
    if not page:
        return []

    reviews = []

    # ── Metascore ─────────────────────────────────────────────────────
    meta_m = re.search(
        r'"metaScore"\s*:\s*(\d+)|'
        r'<span[^>]+class="[^"]*metascore_w[^"]*"[^>]*>\s*(\d+)',
        page,
    )
    metascore = None
    if meta_m:
        metascore = f"{meta_m.group(1) or meta_m.group(2)}/100"

    # ── Critic review snippets from JSON-LD / data attributes ─────────
    for body in re.findall(r'"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"', page)[:max_items]:
        text = body.encode("utf-8").decode("unicode_escape", errors="replace")
        r = _make_review(text, "Metacritic", url, metascore)
        if r:
            reviews.append(r)

    # ── Summary from og:description ───────────────────────────────────
    if not reviews:
        desc_m = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', page)
        if desc_m:
            r = _make_review(desc_m.group(1), "Metacritic", url, metascore)
            if r:
                reviews.append(r)

    log.debug("Metacritic: %d items collected", len(reviews))
    return reviews[:max_items]


# ── 5. Letterboxd ─────────────────────────────────────────────────────

def _lbd_slug(topic: str) -> str:
    """Convert a movie title to a likely Letterboxd film slug."""
    slug = topic.lower()
    slug = re.sub(r"[^\w\s]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return slug


def _collect_letterboxd(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Collect popular reviews from Letterboxd.

    Letterboxd renders reviews server-side in /film/<slug>/reviews/by/activity/
    so they are accessible via HTML scrape.  Each review card contains:
      • .body-text p  — review text
      • .rating       — star rating (★ counts → /5)
    """
    slug = _lbd_slug(topic)
    url  = f"https://letterboxd.com/film/{slug}/reviews/by/activity/"
    page = _html(url)
    if not page:
        return []

    reviews = []

    # Review blocks: <li class="film-detail ..."> containers
    blocks = re.findall(
        r'<li[^>]+class="[^"]*film-detail[^"]*"[^>]*>(.*?)</li>',
        page, re.S,
    )
    if not blocks:
        # Try alternative: <div class="film-detail-content">
        blocks = re.findall(
            r'<div[^>]+class="[^"]*film-detail-content[^"]*"[^>]*>(.*?)</div>',
            page, re.S,
        )

    for block in blocks[:max_items]:
        # Star rating: ★ symbols inside .rating span
        star_m  = re.search(r'class="[^"]*rating[^"]*"[^>]*>([\★½\s]+)<', block)
        rating  = None
        if star_m:
            stars = star_m.group(1).strip()
            count = stars.count("★") + 0.5 * stars.count("½")
            if count > 0:
                rating = f"{count:.1f}/5"

        # Review text body
        txt_m = re.search(
            r'<div[^>]+class="[^"]*body-text[^"]*"[^>]*>(.*?)</div>',
            block, re.S,
        )
        if not txt_m:
            txt_m = re.search(r'<p[^>]*>(.*?)</p>', block, re.S)

        if txt_m:
            r = _make_review(txt_m.group(1), "Letterboxd", url, rating)
            if r:
                reviews.append(r)

    # Fallback: og:description summary from the film page itself
    if not reviews:
        film_page = _html(f"https://letterboxd.com/film/{slug}/")
        if film_page:
            desc_m = re.search(
                r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"',
                film_page,
            )
            if desc_m:
                r = _make_review(desc_m.group(1), "Letterboxd", f"https://letterboxd.com/film/{slug}/")
                if r:
                    reviews.append(r)

    log.debug("Letterboxd: %d items collected", len(reviews))
    return reviews[:max_items]


# ── 6. TMDb Reviews ───────────────────────────────────────────────────

def _collect_tmdb(topic: str, movie_info: Dict, max_items: int) -> List[ReviewItem]:
    """
    Fetch user reviews from the TMDb Reviews endpoint.
    Requires TMDB_API_KEY env var.  Uses tmdb_id from movie_info when
    available (avoids a second search call); otherwise searches first.
    """
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        log.debug("TMDb Reviews: no TMDB_API_KEY — skipping")
        return []

    tmdb_id = movie_info.get("tmdb_id", "")
    media_type = "movie"

    # ── Resolve TMDb ID ────────────────────────────────────────────────
    if not tmdb_id:
        q = urllib.parse.urlencode({
            "api_key":       api_key,
            "query":         topic,
            "include_adult": "false",
            "language":      "en-US",
        })
        search = _jget(f"https://api.themoviedb.org/3/search/multi?{q}")
        if search:
            hit = next(
                (x for x in search.get("results", []) if x.get("media_type") in ("movie", "tv")),
                None,
            )
            if hit:
                tmdb_id    = hit["id"]
                media_type = hit.get("media_type", "movie")

    if not tmdb_id:
        return []

    # ── Fetch reviews ─────────────────────────────────────────────────
    q2   = urllib.parse.urlencode({"api_key": api_key, "language": "en-US", "page": 1})
    data = _jget(
        f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}/reviews?{q2}"
    )
    if not data:
        return []

    reviews = []
    review_url = (
        f"https://www.themoviedb.org/{'movie' if media_type == 'movie' else 'tv'}"
        f"/{tmdb_id}/reviews"
    )
    for rev in data.get("results", [])[:max_items]:
        body = rev.get("content", "")
        r    = _make_review(body, "TMDb", review_url)
        if r:
            reviews.append(r)

    log.debug("TMDb Reviews: %d items collected", len(reviews))
    return reviews


# ── 7. RogerEbert.com ─────────────────────────────────────────────────

def _re_slug(topic: str) -> str:
    """Convert a movie title to a likely RogerEbert URL slug."""
    slug = topic.lower()
    slug = re.sub(r"[^\w\s]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return slug


def _collect_rogerebert(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Scrape the review body from RogerEbert.com.
    The URL pattern is: https://www.rogerebert.com/reviews/<slug>
    Ratings appear as star counts (0–4 stars).
    """
    slug = _re_slug(topic)
    url  = f"https://www.rogerebert.com/reviews/{slug}"
    page = _html(url)
    if not page:
        return []

    reviews = []

    # ── Star rating ────────────────────────────────────────────────────
    star_m = re.search(
        r'class="[^"]*star-rating[^"]*"[^>]*>.*?'
        r'((?:<i[^>]*class="[^"]*icon-star[^"]*"[^>]*>.*?</i>\s*)+)',
        page, re.S,
    )
    rating = None
    if star_m:
        full  = len(re.findall(r'icon-star[^-]', star_m.group(1)))
        half  = len(re.findall(r'icon-star-half',  star_m.group(1)))
        count = full + half * 0.5
        if count > 0:
            rating = f"{count:.1f}/4"

    # Fallback: look for structured rating data
    if not rating:
        sm2 = re.search(r'"ratingValue"\s*:\s*"?([\d.]+)"?', page)
        if sm2:
            rating = f"{sm2.group(1)}/4"

    # ── Review body ────────────────────────────────────────────────────
    # Main review text is inside <div class="page-content">
    body_m = re.search(
        r'<div[^>]+class="[^"]*page-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
        page, re.S,
    )
    if not body_m:
        # Narrower fallback
        body_m = re.search(r'<article[^>]*>(.*?)</article>', page, re.S)

    if body_m:
        # Extract all <p> text within the content block
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', body_m.group(1), re.S)
        # Take the longest paragraphs (most substantive) up to max_items
        paragraphs.sort(key=len, reverse=True)
        for para in paragraphs[:max_items]:
            r = _make_review(para, "RogerEbert.com", url, rating)
            if r:
                reviews.append(r)
    else:
        # Last resort: og:description
        desc_m = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', page)
        if desc_m:
            r = _make_review(desc_m.group(1), "RogerEbert.com", url, rating)
            if r:
                reviews.append(r)

    log.debug("RogerEbert: %d items collected", len(reviews))
    return reviews[:max_items]


# ── 8. Wikipedia (critical-reception section) ─────────────────────────

def _collect_wikipedia(topic: str, max_items: int) -> List[ReviewItem]:
    """
    Extract the critical-reception / critical-response excerpt from the
    Wikipedia REST summary API.  Falls back to the full extract when no
    reception section is found.

    Only produces a single ReviewItem — Wikipedia is a fallback source,
    not a review platform.
    """
    q    = urllib.parse.quote(topic)
    data = _jget(f"https://en.wikipedia.org/api/rest_v1/page/summary/{q}")

    # Try disambiguation suffixes if needed
    if not data or data.get("type") == "disambiguation":
        for suffix in ["(film)", "(TV_series)", "(miniseries)"]:
            q2   = urllib.parse.quote(f"{topic} {suffix}")
            data = _jget(f"https://en.wikipedia.org/api/rest_v1/page/summary/{q2}")
            if data and data.get("type") != "disambiguation":
                break

    if not data:
        return []

    extract = data.get("extract", "")
    if not extract:
        return []

    # Find sentences that discuss critical reception
    sentences = re.split(r"(?<=[.!?])\s+", extract)
    _RECEPTION_KW = re.compile(
        r"\b(review|critic|praise|lauded|acclaimed|award|rating|score|rotten|"
        r"certified|metacritic|letterboxd|imdb|audience|reception|\bpan\b|"
        r"mixed|controversy)\b",
        re.I,
    )
    reception = [s for s in sentences if _RECEPTION_KW.search(s)]

    if reception:
        combined = " ".join(reception[:4])
    else:
        # Fallback: first 3 sentences (plot / intro)
        combined = " ".join(sentences[:3])

    url = data.get("content_urls", {}).get("desktop", {}).get("page", "https://www.wikipedia.org")
    r   = _make_review(combined, "Wikipedia", url)

    log.debug("Wikipedia: %s", "1 item collected" if r else "no useful text")
    return [r] if r else []


# ─────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────

def collect_movie_reviews(
    topic:          str,
    movie_info:     Optional[Dict] = None,
    max_per_source: int = 12,
) -> List[ReviewItem]:
    """
    Collect, merge, and deduplicate reviews for *topic* from all available
    sources.  Returns a list of ReviewItem dicts ready for sentiment scoring.

    Parameters
    ----------
    topic : str
        Movie / TV show title as entered by the user.
    movie_info : dict, optional
        Output of fetch_movie_metadata() — supplies imdb_id, tmdb_id, title.
        Pass None to let each collector do its own lookup.
    max_per_source : int
        Maximum reviews to collect per source (default 12).

    Returns
    -------
    List[ReviewItem]
        Deduplicated list of reviews; empty if all sources fail.
        Each item is guaranteed to have non-empty "text" (≥ 30 chars).
    """
    info = movie_info or {}

    # Resolve identifiers from movie_info
    imdb_id    = info.get("imdb_id", "")
    # Strip "Not Available" sentinel from metadata service
    if imdb_id == "Not Available":
        imdb_id = ""

    log.info("Collecting reviews for %r (imdb_id=%s)", topic, imdb_id or "unknown")

    # ── Run all collectors ────────────────────────────────────────────
    # Each collector is independent — a failure in one never blocks others.
    all_reviews: List[ReviewItem] = []

    # 1. Google Reviews
    try:
        all_reviews.extend(_collect_google(topic, max_per_source))
    except Exception as exc:
        log.warning("Google Reviews collector raised: %s", exc)

    # 2. IMDb
    try:
        all_reviews.extend(_collect_imdb(imdb_id, max_per_source))
    except Exception as exc:
        log.warning("IMDb collector raised: %s", exc)

    # 3. Rotten Tomatoes
    try:
        all_reviews.extend(_collect_rotten_tomatoes(topic, max_per_source))
    except Exception as exc:
        log.warning("Rotten Tomatoes collector raised: %s", exc)

    # 4. Metacritic
    try:
        all_reviews.extend(_collect_metacritic(topic, max_per_source))
    except Exception as exc:
        log.warning("Metacritic collector raised: %s", exc)

    # 5. Letterboxd
    try:
        all_reviews.extend(_collect_letterboxd(topic, max_per_source))
    except Exception as exc:
        log.warning("Letterboxd collector raised: %s", exc)

    # 6. TMDb Reviews
    try:
        all_reviews.extend(_collect_tmdb(topic, info, max_per_source))
    except Exception as exc:
        log.warning("TMDb Reviews collector raised: %s", exc)

    # 7. RogerEbert.com
    try:
        all_reviews.extend(_collect_rogerebert(topic, max_per_source))
    except Exception as exc:
        log.warning("RogerEbert collector raised: %s", exc)

    # 8. Wikipedia (always last — lowest review richness)
    try:
        all_reviews.extend(_collect_wikipedia(topic, max_per_source))
    except Exception as exc:
        log.warning("Wikipedia collector raised: %s", exc)

    # ── Deduplicate ───────────────────────────────────────────────────
    unique = _deduplicate(all_reviews)

    log.info(
        "collect_movie_reviews: %d raw reviews → %d unique for %r",
        len(all_reviews), len(unique), topic,
    )
    return unique
