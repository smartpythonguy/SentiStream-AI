"""
backend/restaurant_fetcher.py — SentiStream AI
================================================
Dedicated restaurant data fetcher.

Primary  : Google Places API  (details + customer reviews)
Secondary: JustDial scrape    (reviews, rating, cuisine tags)
Tertiary : TripAdvisor scrape (reviews, rating)

All three sources normalise reviews into a single common schema:
    {
        "text":     str,   # review body → fed to the local sentiment model
        "headline": str,   # short label shown in UI ("Google Review", etc.)
        "rating":   float | None,
        "author":   str,   # reviewer name when the source exposes it, else ""
        "date":     str,   # relative date ("2 months ago") when available, else ""
        "source":   str,   # "Google" | "JustDial" | "TripAdvisor"
        "url":      str,
    }

Place metadata (name, rating, address, hours, …) is returned separately
in a `place_info` dict and surfaced in the domain_router response.

Environment variable required:
    GOOGLE_PLACES_API_KEY   — Google Cloud project with Places API enabled
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

log = logging.getLogger("SentiStream.restaurant_fetcher")

# ── Google Places API ─────────────────────────────────────────────────────────
_PLACES_FIND_URL   = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
_PLACES_DETAIL_URL = "https://maps.googleapis.com/maps/api/place/details/json"
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
)

# Hard limit from Places API: 5 reviews per details call
_GOOGLE_MAX_REVIEWS = 5

_PRICE_LABELS = {
    0: "Free",
    1: "Inexpensive (₹)",
    2: "Moderate (₹₹)",
    3: "Expensive (₹₹₹)",
    4: "Very Expensive (₹₹₹₹)",
}

_IGNORE_TYPES = {
    "point_of_interest", "establishment", "food", "store",
    "premise", "geocode", "locality", "route",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_api_key() -> str:
    key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        log.warning("GOOGLE_PLACES_API_KEY not set — Google Places calls will be skipped.")
    return key


def _fetch_json(url: str, params: Dict) -> Optional[Dict]:
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full_url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        log.error("JSON fetch failed for %s: %s", url, exc)
        return None


def _fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        log.warning("HTML fetch failed for %s: %s", url, exc)
        return ""


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    return text


# ── Google Places ─────────────────────────────────────────────────────────────

def _google_find_place_id(name: str, api_key: str) -> Optional[str]:
    params = {
        "input":     name,
        "inputtype": "textquery",
        "fields":    "place_id",
        "key":       api_key,
    }
    data = _fetch_json(_PLACES_FIND_URL, params)
    if not data or data.get("status") != "OK":
        log.warning("FindPlace status: %s", data.get("status") if data else "None")
        return None
    candidates = data.get("candidates", [])
    return candidates[0]["place_id"] if candidates else None


def _google_place_details(place_id: str, api_key: str) -> Optional[Dict]:
    params = {
        "place_id": place_id,
        "fields": (
            "name,rating,user_ratings_total,price_level,"
            "formatted_address,opening_hours,website,url,"
            "reviews,types,editorial_summary"
        ),
        "key":          api_key,
        "reviews_sort": "most_relevant",
    }
    data = _fetch_json(_PLACES_DETAIL_URL, params)
    if not data or data.get("status") != "OK":
        log.warning("PlaceDetails status: %s", data.get("status") if data else "None")
        return None
    return data.get("result")


def _parse_google_result(result: Dict, restaurant_name: str) -> Tuple[Dict, List[Dict]]:
    name        = result.get("name", restaurant_name)
    rating      = result.get("rating")
    total_rev   = result.get("user_ratings_total")
    price_level = result.get("price_level")
    address     = result.get("formatted_address", "")
    maps_url    = result.get("url", "")
    website     = result.get("website", "")

    hours_data = result.get("opening_hours", {})
    hours      = hours_data.get("weekday_text", [])
    open_now   = hours_data.get("open_now")

    cuisine_tags = [
        t.replace("_", " ").title()
        for t in result.get("types", [])
        if t not in _IGNORE_TYPES
    ]

    place_info: Dict = {
        "name":          name,
        "rating":        rating,
        "total_reviews": total_rev,
        "price_level":   _PRICE_LABELS.get(price_level, "N/A") if price_level is not None else "N/A",
        "cuisine":       cuisine_tags[:4],
        "address":       address,
        "hours":         hours,
        "open_now":      open_now,
        "maps_url":      maps_url,
        "website":       website,
        "source":        "Google Places",
    }

    reviews: List[Dict] = []
    for r in result.get("reviews", [])[:_GOOGLE_MAX_REVIEWS]:
        body = _clean(r.get("text", ""))
        if not body:
            continue
        star = r.get("rating")
        reviews.append({
            "text":     body,
            "headline": f"Google Review — {star}★" if star else "Google Review",
            "rating":   float(star) if star else None,
            "author":   _clean(r.get("author_name", "")),
            "date":     _clean(r.get("relative_time_description", "")),
            "source":   "Google",
            "url":      maps_url,
        })

    return place_info, reviews


def fetch_google_restaurant(name: str) -> Tuple[Optional[Dict], List[Dict]]:
    api_key = _get_api_key()
    if not api_key:
        return None, []
    place_id = _google_find_place_id(name, api_key)
    if not place_id:
        return None, []
    result = _google_place_details(place_id, api_key)
    if not result:
        return None, []
    return _parse_google_result(result, name)


# ── JustDial ──────────────────────────────────────────────────────────────────

def _parse_justdial_reviews(html: str, url: str) -> List[Dict]:
    reviews: List[Dict] = []

    # Pattern 1 — jd_review_paragraph
    for m in re.finditer(
        r'class="jd_review_paragraph[^"]*"[^>]*>(.*?)</p>',
        html, re.DOTALL | re.IGNORECASE,
    ):
        body = _clean(re.sub(r"<[^>]+>", "", m.group(1)))
        if body and len(body) > 20:
            reviews.append({"text": body, "headline": "JustDial Review",
                            "rating": None, "source": "JustDial", "url": url})

    # Pattern 2 — reviw-cont
    if not reviews:
        for m in re.finditer(
            r'class="reviw-cont[^"]*"[^>]*>(.*?)</div>',
            html, re.DOTALL | re.IGNORECASE,
        ):
            body = _clean(re.sub(r"<[^>]+>", "", m.group(1)))
            if body and len(body) > 20:
                reviews.append({"text": body, "headline": "JustDial Review",
                                "rating": None, "source": "JustDial", "url": url})

    rating_match = re.search(r'"ratingValue"\s*:\s*"?([\d.]+)"?', html)
    jd_rating = float(rating_match.group(1)) if rating_match else None
    if jd_rating:
        for rev in reviews:
            rev["rating"] = jd_rating

    return reviews[:10]


def fetch_justdial_restaurant(name: str) -> List[Dict]:
    slug = urllib.parse.quote_plus(name.replace(" ", "-").lower())
    url  = f"https://www.justdial.com/Mumbai/{slug}"
    html = _fetch_html(url)
    if not html:
        return []
    reviews = _parse_justdial_reviews(html, url)
    log.info("JustDial: %d reviews for '%s'", len(reviews), name)
    return reviews


# ── TripAdvisor ───────────────────────────────────────────────────────────────

def _parse_tripadvisor_reviews(html: str, url: str) -> List[Dict]:
    reviews: List[Dict] = []

    # <q class="...partial_entry...">...</q>
    for m in re.finditer(
        r'<q[^>]*class="[^"]*partial_entry[^"]*"[^>]*>(.*?)</q>',
        html, re.DOTALL | re.IGNORECASE,
    ):
        body = _clean(re.sub(r"<[^>]+>", "", m.group(1)))
        if body and len(body) > 20:
            reviews.append({"text": body, "headline": "TripAdvisor Review",
                            "rating": None, "source": "TripAdvisor", "url": url})

    # JSON-LD reviewBody fields
    for m in re.finditer(r'"reviewBody"\s*:\s*"((?:[^"\\]|\\.)+)"', html, re.DOTALL):
        try:
            body = _clean(m.group(1).encode("utf-8").decode("unicode_escape", errors="replace"))
        except Exception:
            body = _clean(m.group(1))
        if body and len(body) > 20:
            reviews.append({"text": body, "headline": "TripAdvisor Review",
                            "rating": None, "source": "TripAdvisor", "url": url})

    seen, deduped = set(), []
    for r in reviews:
        key = r["text"][:80]
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    return deduped[:10]


def fetch_tripadvisor_restaurant(name: str) -> List[Dict]:
    q   = urllib.parse.quote_plus(name)
    url = (
        f"https://www.tripadvisor.com/Search?q={q}"
        f"&searchSessionId=&sid=&blockRedirect=true&geo=&details=&category=restaurants"
    )
    html = _fetch_html(url)
    if not html:
        return []
    reviews = _parse_tripadvisor_reviews(html, url)
    log.info("TripAdvisor: %d reviews for '%s'", len(reviews), name)
    return reviews


# ── Aggregator (public API) ───────────────────────────────────────────────────

def fetch_restaurant_data(name: str) -> Dict:
    """
    Master entry point for the Restaurant domain.

    Priority order (all live, real sources — no synthetic data):
      1. Google Places API  → place_info + up to 5 reviews (with author + date)
      2. JustDial scrape    → up to 10 additional reviews
      3. TripAdvisor scrape → up to 10 additional reviews

    If every source returns nothing, `reviews` is empty and the caller renders
    a clean "no data" state — reviews are never fabricated.

    Returns:
        {
            "place_info": {
                name, rating, total_reviews, price_level,
                cuisine, address, hours, open_now, maps_url, website, source
            },
            "reviews": [
                {
                    "text":     str,    ← ONLY this field is fed to the model
                    "headline": str,
                    "rating":   float | None,
                    "author":   str,
                    "date":     str,
                    "source":   str,
                    "url":      str,
                },
                …
            ]
        }
    """
    place_info: Optional[Dict] = None
    all_reviews: List[Dict]    = []

    # 1. Google Places
    try:
        place_info, google_reviews = fetch_google_restaurant(name)
        all_reviews.extend(google_reviews)
    except Exception as exc:
        log.error("Google Places error: %s", exc)

    # 2. JustDial
    try:
        all_reviews.extend(fetch_justdial_restaurant(name))
    except Exception as exc:
        log.warning("JustDial error: %s", exc)

    # 3. TripAdvisor
    try:
        all_reviews.extend(fetch_tripadvisor_restaurant(name))
    except Exception as exc:
        log.warning("TripAdvisor error: %s", exc)

    # NOTE: No synthetic fallback. If every live source returns nothing we keep
    # all_reviews empty; domain_router._analyze_restaurant() turns that into a
    # clean "No restaurant data found" response, so the UI never displays
    # fabricated reviews.

    # Normalise schema: guarantee every review carries the optional display
    # fields the frontend renders (author / date / rating), defaulting to empty
    # so missing values are hidden rather than faked.
    for r in all_reviews:
        r.setdefault("author", "")
        r.setdefault("date", "")
        r.setdefault("rating", None)
        r.setdefault("headline", f"{r.get('source', 'Customer')} Review")

    # Minimal stub when Google Places unavailable
    if place_info is None:
        place_info = {
            "name":          name,
            "rating":        None,
            "total_reviews": None,
            "price_level":   "N/A",
            "cuisine":       [],
            "address":       "",
            "hours":         [],
            "open_now":      None,
            "maps_url":      "",
            "website":       "",
            "source":        "Fallback",
        }

    # Deduplicate by text prefix
    seen: set = set()
    deduped: List[Dict] = []
    for r in all_reviews:
        key = r["text"][:60].lower().strip()
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    return {"place_info": place_info, "reviews": deduped}
