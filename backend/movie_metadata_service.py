"""
backend/movie_metadata_service.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Movie / TV Metadata Service (v1.0)

Completely separated from sentiment analysis. Fetches real metadata
from four sources in a strict priority waterfall:

    1. TMDb  (primary — richest data, requires TMDB_API_KEY)
    2. OMDb  (secondary — IMDb ratings, RT scores, requires OMDB_API_KEY)
    3. IMDb  (tertiary — direct page scrape via imdb_id from step 1/2)
    4. Wikipedia (fallback — basic info when API keys are absent)

Rules:
  • Values are NEVER guessed or hardcoded.
  • Each field is filled from the highest-priority source that has it.
  • A field is set to "Not Available" only when every source has failed
    to supply a value for it.
  • The output dict is a superset of the old _fetch_movie_info() schema
    so domain_router.py / frontend require zero changes.

Public API:
    from movie_metadata_service import fetch_movie_metadata
    info = fetch_movie_metadata("Pushpa 2")
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

log = logging.getLogger("SentiStream.metadata")

# ── Canonical "not available" sentinel used across the whole file ──────
_NA = "Not Available"

# ── HTTP request timeout (seconds) per source ─────────────────────────
_TIMEOUT_TMDB = 8
_TIMEOUT_OMDB = 6
_TIMEOUT_IMDB = 8
_TIMEOUT_WIKI = 7

# ── Browser-like User-Agent for scrape calls (IMDb, Wikipedia) ────────
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ─────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────

def _get(url: str, timeout: int = 8, headers: Optional[Dict[str, str]] = None) -> Optional[bytes]:
    """Fetch *url* and return raw bytes, or None on any error."""
    try:
        req = urllib.request.Request(url, headers=headers or {"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception as exc:
        log.debug("GET %s failed: %s", url, exc)
        return None


def _jget(url: str, timeout: int = 8) -> Optional[Dict]:
    """Fetch *url* and JSON-parse the response. Returns None on error."""
    raw = _get(url, timeout=timeout, headers={"User-Agent": _UA})
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _fmt_money(n: Any) -> str:
    """Format an integer dollar amount as $XM / $X.XB. Empty string if falsy."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return ""
    if not n:
        return ""
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    return f"${n:,}"


def _empty_info(topic: str) -> Dict:
    """Return a fully-keyed info dict with empty strings (NOT _NA yet)."""
    return {
        # Identity
        "title":              topic,
        "year":               "",
        "release_date":       "",
        "media_type":         "",
        # Visual
        "poster":             "",
        # Ratings
        "imdb_rating":        "",
        "rt_score":           "",
        # Financials
        "budget":             "",
        "box_office":         "",
        # Detail
        "runtime":            "",
        "genre":              "",
        "genres":             [],
        "overview":           "",
        # Series / seasons
        "total_seasons":      "",
        "series_status":      "",
        # Identifiers (internal — not sent to frontend)
        "imdb_id":            "",
        # Streaming
        "streaming_platforms": [],
    }


def _apply_na(info: Dict) -> Dict:
    """
    Replace any empty-string values with _NA *after* all sources have run.
    Lists: replaced with [] (frontend renders as absent), not _NA.
    Fields that are intentionally list-typed keep their list form.
    """
    LIST_FIELDS = {"genres", "streaming_platforms"}
    NA_EXEMPT   = {"imdb_id"}  # internal — never shown to user

    for key, val in info.items():
        if key in NA_EXEMPT:
            continue
        if key in LIST_FIELDS:
            continue   # leave empty lists as-is
        if val == "" or val is None:
            info[key] = _NA
    return info


# ─────────────────────────────────────────────────────────────────────
# Source 1 — TMDb
# ─────────────────────────────────────────────────────────────────────

_TMDB_STATUS_MAP = {
    "Released":         "Released",
    "Returning Series": "Running",
    "Ended":            "Ended",
    "Cancelled":        "Cancelled",
    "In Production":    "In Production",
    "Planned":          "Upcoming",
    "Post Production":  "Post Production",
    "Rumored":          "Rumored",
}


def _fetch_tmdb(topic: str, info: Dict) -> bool:
    """
    Populate *info* from TMDb.  Returns True if a match was found.

    Covers:
        title, year, release_date, poster, runtime, imdb_id, overview,
        media_type, budget, box_office, genres, genre, series_status,
        total_seasons, streaming_platforms
    """
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        log.debug("TMDb: no TMDB_API_KEY — skipping")
        return False

    # ── Search ────────────────────────────────────────────────────────
    q = urllib.parse.urlencode({
        "api_key":        api_key,
        "query":          topic,
        "include_adult":  "false",
        "language":       "en-US",
    })
    data = _jget(f"https://api.themoviedb.org/3/search/multi?{q}", timeout=_TIMEOUT_TMDB)
    if not data:
        return False

    results = data.get("results", [])
    hit = next((x for x in results if x.get("media_type") in ("movie", "tv")), None)
    if not hit:
        log.debug("TMDb: no movie/tv result for %r", topic)
        return False

    mid  = hit["id"]
    mtyp = hit["media_type"]  # "movie" | "tv"

    # ── Detail call with external_ids + watch/providers appended ─────
    append = "external_ids,watch/providers"
    q2 = urllib.parse.urlencode({
        "api_key":            api_key,
        "append_to_response": append,
        "language":           "en-US",
    })

    if mtyp == "movie":
        detail = _jget(
            f"https://api.themoviedb.org/3/movie/{mid}?{q2}",
            timeout=_TIMEOUT_TMDB,
        )
        if not detail:
            return False

        genres = [g["name"] for g in detail.get("genres", [])]
        ext    = detail.get("external_ids") or {}
        imdb_id = detail.get("imdb_id") or ext.get("imdb_id", "")

        streaming = [
            p["provider_name"]
            for p in (
                detail.get("watch/providers", {})
                      .get("results", {})
                      .get("US", {})
                      .get("flatrate", [])
            )
        ][:5]

        info.update({
            "title":               detail.get("title", topic),
            "year":                (detail.get("release_date") or "")[:4],
            "release_date":        detail.get("release_date", ""),
            "poster":              (
                f"https://image.tmdb.org/t/p/w500{detail['poster_path']}"
                if detail.get("poster_path") else ""
            ),
            "runtime":             (
                f"{detail['runtime']} min" if detail.get("runtime") else ""
            ),
            "imdb_id":             imdb_id,
            "overview":            detail.get("overview", ""),
            "media_type":          "Movie",
            "budget":              _fmt_money(detail.get("budget", 0)),
            "box_office":          _fmt_money(detail.get("revenue", 0)),
            "genres":              genres,
            "genre":               ", ".join(genres),
            "series_status":       _TMDB_STATUS_MAP.get(
                                       detail.get("status", ""), detail.get("status", "")
                                   ),
            "streaming_platforms": streaming,
        })

    else:  # tv
        detail = _jget(
            f"https://api.themoviedb.org/3/tv/{mid}?{q2}",
            timeout=_TIMEOUT_TMDB,
        )
        if not detail:
            return False

        air    = detail.get("first_air_date", "")
        rt     = detail.get("episode_run_time", [])
        genres = [g["name"] for g in detail.get("genres", [])]
        ext    = detail.get("external_ids") or {}

        streaming = [
            p["provider_name"]
            for p in (
                detail.get("watch/providers", {})
                      .get("results", {})
                      .get("US", {})
                      .get("flatrate", [])
            )
        ][:5]

        # Determine media_type label
        tmdb_type = detail.get("type", "")
        if tmdb_type == "Miniseries":
            media_label = "TV Mini-Series"
        elif tmdb_type == "Documentary":
            media_label = "Documentary Series"
        else:
            media_label = "TV Series"

        info.update({
            "title":               detail.get("name", topic),
            "year":                air[:4] if air else "",
            "release_date":        air,
            "poster":              (
                f"https://image.tmdb.org/t/p/w500{detail['poster_path']}"
                if detail.get("poster_path") else ""
            ),
            "runtime":             f"{rt[0]} min/ep" if rt else "",
            "imdb_id":             ext.get("imdb_id", ""),
            "overview":            detail.get("overview", ""),
            "media_type":          media_label,
            "total_seasons":       str(detail.get("number_of_seasons", "")),
            "genres":              genres,
            "genre":               ", ".join(genres),
            "series_status":       _TMDB_STATUS_MAP.get(
                                       detail.get("status", ""), detail.get("status", "")
                                   ),
            "streaming_platforms": streaming,
        })

    log.debug("TMDb: populated info for %r (type=%s)", topic, mtyp)
    return True


# ─────────────────────────────────────────────────────────────────────
# Source 2 — OMDb
# ─────────────────────────────────────────────────────────────────────

def _fetch_omdb(topic: str, info: Dict, tmdb_ok: bool) -> bool:
    """
    Populate *info* fields from OMDb.

    Always fills: imdb_rating, rt_score.
    Also fills structural fields (title, year, poster, runtime, genres,
    media_type, total_seasons, series_status, box_office, overview)
    when TMDb did NOT already succeed (tmdb_ok=False).

    Returns True if OMDb returned a valid response.
    """
    api_key = os.environ.get("OMDB_API_KEY", "").strip()
    if not api_key:
        log.debug("OMDb: no OMDB_API_KEY — skipping")
        return False

    # Prefer lookup by IMDb ID (exact match) over fuzzy title search
    if info.get("imdb_id"):
        params = {"i": info["imdb_id"], "apikey": api_key, "plot": "short"}
    else:
        params = {"t": topic, "apikey": api_key, "plot": "short"}

    q    = urllib.parse.urlencode(params)
    data = _jget(f"https://www.omdbapi.com/?{q}", timeout=_TIMEOUT_OMDB)
    if not data or data.get("Response") != "True":
        log.debug("OMDb: no result for %r", topic)
        return False

    # ── Ratings ───────────────────────────────────────────────────────
    imdb_rat = data.get("imdbRating", "")
    if imdb_rat and imdb_rat != "N/A":
        info["imdb_rating"] = imdb_rat

    for rat in data.get("Ratings", []):
        if "Rotten Tomatoes" in rat.get("Source", ""):
            info["rt_score"] = rat["Value"]
            break

    # ── Store imdb_id if we didn't have one ───────────────────────────
    if not info.get("imdb_id") and data.get("imdbID"):
        info["imdb_id"] = data["imdbID"]

    # ── Structural fields — only fill when TMDb didn't already succeed ─
    if not tmdb_ok:
        rtype = data.get("Type", "").lower()

        genres_raw = data.get("Genre", "")
        genres     = [g.strip() for g in genres_raw.split(",") if g.strip()]

        # Series status heuristic from year string (e.g. "2019–2023" vs "2022–")
        year_str = data.get("Year", "")
        if rtype == "series":
            if "–" in year_str or "-" in year_str:
                end_part = year_str.replace("–", "-").split("-")[-1].strip()
                series_status = "Ended" if (end_part.isdigit() and len(end_part) == 4) else "Running"
            else:
                series_status = "Running"
        else:
            series_status = "Released"

        info.update({
            "title":         data.get("Title", topic),
            "year":          data.get("Year", "").split("–")[0].split("-")[0].strip(),
            "release_date":  data.get("Released", ""),
            "poster":        data.get("Poster", "") if data.get("Poster") not in ("N/A", "") else "",
            "runtime":       data.get("Runtime", "") if data.get("Runtime") != "N/A" else "",
            "overview":      data.get("Plot", "")   if data.get("Plot")    != "N/A" else "",
            "genres":        genres,
            "genre":         genres_raw if genres_raw != "N/A" else "",
            "media_type":    "TV Series" if rtype == "series" else ("Movie" if rtype == "movie" else ""),
            "total_seasons": (
                data.get("totalSeasons", "")
                if rtype == "series" and data.get("totalSeasons") not in ("N/A", "")
                else ""
            ),
            "series_status": series_status,
            # OMDb doesn't supply budget; box_office only for movies
            "box_office": (
                data.get("BoxOffice", "")
                if data.get("BoxOffice") not in ("N/A", "", None)
                else info.get("box_office", "")
            ),
        })

    log.debug("OMDb: populated ratings for %r", topic)
    return True


# ─────────────────────────────────────────────────────────────────────
# Source 3 — IMDb (light scrape for gaps not covered by APIs)
# ─────────────────────────────────────────────────────────────────────

def _fetch_imdb(info: Dict) -> bool:
    """
    Scrape the IMDb title page for fields still missing after TMDb + OMDb.

    Only fetches if:
        • We have an imdb_id (safe, canonical URL)
        • At least one target field is still empty

    Target fields filled here:
        imdb_rating, budget, box_office, runtime, genre, streaming_platforms

    Uses lightweight regex — no HTML parser dependency.
    Returns True if the page was fetched successfully.
    """
    imdb_id = info.get("imdb_id", "").strip()
    if not imdb_id:
        log.debug("IMDb scrape: no imdb_id — skipping")
        return False

    # Check if there's anything left to fill
    needs = (
        not info.get("imdb_rating")
        or not info.get("budget")
        or not info.get("box_office")
        or not info.get("runtime")
        or not info.get("genre")
    )
    if not needs:
        log.debug("IMDb scrape: all fields already populated — skipping")
        return False

    url = f"https://www.imdb.com/title/{imdb_id}/"
    raw = _get(url, timeout=_TIMEOUT_IMDB, headers={
        "User-Agent":      _UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept":          "text/html",
    })
    if not raw:
        return False

    try:
        html = raw.decode("utf-8", errors="replace")
    except Exception:
        return False

    fetched_anything = False

    # ── IMDb rating ───────────────────────────────────────────────────
    if not info.get("imdb_rating"):
        m = re.search(
            r'"ratingValue"\s*:\s*"?([\d.]+)"?|'
            r'<span[^>]*itemprop="ratingValue"[^>]*>([\d.]+)<',
            html,
        )
        if not m:
            # JSON-LD block
            m = re.search(r'"aggregateRating".*?"ratingValue"\s*:\s*([\d.]+)', html, re.S)
        if m:
            val = next(v for v in m.groups() if v)
            info["imdb_rating"] = val
            fetched_anything = True

    # ── Runtime ───────────────────────────────────────────────────────
    if not info.get("runtime"):
        m = re.search(r'"timeRequired"\s*:\s*"PT(\d+H)?(\d+M)?"|(\d+)\s*min(?:utes)?', html)
        if m:
            if m.group(3):
                info["runtime"] = f"{m.group(3)} min"
                fetched_anything = True
            else:
                hours = int(m.group(1)[:-1]) if m.group(1) else 0
                mins  = int(m.group(2)[:-1]) if m.group(2) else 0
                total = hours * 60 + mins
                if total:
                    info["runtime"] = f"{total} min"
                    fetched_anything = True

    # ── Genre ─────────────────────────────────────────────────────────
    if not info.get("genre"):
        genres = re.findall(r'"genre"\s*:\s*"([^"]+)"', html)
        if not genres:
            genres = re.findall(r'<a[^>]+href="/search/title[^>]+genre[^>]+>([^<]+)</a>', html)
        if genres:
            info["genres"] = genres[:5]
            info["genre"]  = ", ".join(genres[:5])
            fetched_anything = True

    # ── Budget & box office — from JSON-LD / tech-specs ───────────────
    if not info.get("budget"):
        m = re.search(r'"budget"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d,]+)"?', html, re.S)
        if not m:
            m = re.search(r'[Bb]udget[^$]*\$([\d,]+(?:\s*(?:million|billion))?)', html)
        if m:
            raw_val = m.group(1).replace(",", "").strip()
            # Handle "million" / "billion" suffix in text matches
            if "billion" in html[m.start():m.start()+50].lower():
                try:
                    info["budget"] = f"${float(raw_val)/1:.1f}B"
                    fetched_anything = True
                except ValueError:
                    pass
            elif "million" in html[m.start():m.start()+50].lower():
                try:
                    info["budget"] = f"${float(raw_val):.0f}M"
                    fetched_anything = True
                except ValueError:
                    pass
            else:
                try:
                    info["budget"] = _fmt_money(int(raw_val))
                    fetched_anything = True
                except ValueError:
                    pass

    if not info.get("box_office"):
        m = re.search(r'[Gg]ross[^$]*\$([\d,]+(?:\s*(?:million|billion))?)', html)
        if not m:
            m = re.search(r'[Cc]umulative[^$]*\$([\d,]+)', html)
        if m:
            raw_val = m.group(1).replace(",", "").strip()
            try:
                info["box_office"] = _fmt_money(int(raw_val))
                fetched_anything = True
            except ValueError:
                pass

    log.debug("IMDb scrape: fetched_anything=%s for %s", fetched_anything, imdb_id)
    return fetched_anything


# ─────────────────────────────────────────────────────────────────────
# Source 4 — Wikipedia (fallback)
# ─────────────────────────────────────────────────────────────────────

def _fetch_wikipedia(topic: str, info: Dict) -> bool:
    """
    Query the Wikipedia REST API for a summary when all API-key sources
    have failed or left critical fields empty.

    Fields filled: title, year, overview, media_type, genre (basic).
    Does NOT guess — only uses what Wikipedia's extract contains.

    Returns True if a Wikipedia article was found.
    """
    # Only use Wikipedia if structural fields are still empty
    needs = not info.get("overview") or not info.get("year")
    if not needs:
        log.debug("Wikipedia: not needed — skipping")
        return False

    q    = urllib.parse.quote(topic)
    url  = f"https://en.wikipedia.org/api/rest_v1/page/summary/{q}"
    data = _jget(url, timeout=_TIMEOUT_WIKI)

    if not data or data.get("type") == "disambiguation":
        # Try appending "(film)" or "(TV series)" for disambiguation
        for suffix in ["(film)", "(TV_series)", "(miniseries)"]:
            q2   = urllib.parse.quote(f"{topic} {suffix}")
            data = _jget(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{q2}",
                timeout=_TIMEOUT_WIKI,
            )
            if data and data.get("type") != "disambiguation":
                break
        else:
            log.debug("Wikipedia: disambiguation could not be resolved for %r", topic)
            return False

    if not data or not data.get("extract"):
        return False

    extract = data.get("extract", "")

    # Fill overview if still missing
    if not info.get("overview"):
        # Take the first 2 sentences of the extract
        sentences = re.split(r'(?<=[.!?])\s+', extract)
        info["overview"] = " ".join(sentences[:2])

    # Attempt to extract year from the extract text
    if not info.get("year"):
        m = re.search(r'\b(19\d{2}|20\d{2})\b', extract)
        if m:
            info["year"] = m.group(1)

    # Attempt to extract media_type hint
    if not info.get("media_type"):
        extract_l = extract.lower()
        if any(w in extract_l for w in ("television series", "tv series", "web series")):
            info["media_type"] = "TV Series"
        elif "miniseries" in extract_l or "mini-series" in extract_l:
            info["media_type"] = "TV Mini-Series"
        elif "documentary" in extract_l:
            info["media_type"] = "Documentary"
        elif any(w in extract_l for w in ("film", "movie", "motion picture")):
            info["media_type"] = "Movie"

    # Attempt to extract genre from the extract (very conservative)
    if not info.get("genre"):
        _GENRE_WORDS = [
            "action", "adventure", "animation", "biography", "comedy",
            "crime", "documentary", "drama", "fantasy", "horror",
            "musical", "mystery", "romance", "sci-fi", "science fiction",
            "sport", "thriller", "war", "western",
        ]
        found = [g.title() for g in _GENRE_WORDS if g in extract.lower()]
        if found:
            info["genres"] = found[:3]
            info["genre"]  = ", ".join(found[:3])

    # Wikipedia thumbnail as poster of last resort
    thumbnail = data.get("thumbnail", {})
    if not info.get("poster") and thumbnail.get("source"):
        info["poster"] = thumbnail["source"]

    log.debug("Wikipedia: filled fields for %r", topic)
    return True


# ─────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────

def fetch_movie_metadata(topic: str) -> Dict:
    """
    Fetch structured movie / TV metadata for *topic*.

    Waterfall:
        TMDb (primary) → OMDb (secondary) → IMDb scrape (tertiary)
        → Wikipedia (fallback)

    Each source fills only the fields it knows — no guessing.
    After all sources run, every field that is still empty is set to
    "Not Available" so the frontend always has a defined value.

    Returns a dict with these keys (matching the old _fetch_movie_info schema):
        title, year, release_date, poster,
        imdb_rating, rt_score,
        budget, box_office,
        runtime, genre, genres,
        media_type, total_seasons, series_status,
        streaming_platforms, overview,
        imdb_id  (internal; not displayed)
    """
    info = _empty_info(topic)

    # ── Source 1: TMDb ────────────────────────────────────────────────
    tmdb_ok = False
    try:
        tmdb_ok = _fetch_tmdb(topic, info)
    except Exception as exc:
        log.warning("TMDb fetch raised unexpectedly: %s", exc)

    # ── Source 2: OMDb ────────────────────────────────────────────────
    try:
        _fetch_omdb(topic, info, tmdb_ok=tmdb_ok)
    except Exception as exc:
        log.warning("OMDb fetch raised unexpectedly: %s", exc)

    # ── Source 3: IMDb scrape ─────────────────────────────────────────
    try:
        _fetch_imdb(info)
    except Exception as exc:
        log.warning("IMDb scrape raised unexpectedly: %s", exc)

    # ── Source 4: Wikipedia fallback ──────────────────────────────────
    try:
        _fetch_wikipedia(topic, info)
    except Exception as exc:
        log.warning("Wikipedia fetch raised unexpectedly: %s", exc)

    # ── Replace remaining empties with "Not Available" ─────────────────
    _apply_na(info)

    log.info(
        "Metadata ready for %r — type=%s year=%s imdb=%s poster=%s",
        topic,
        info.get("media_type"),
        info.get("year"),
        info.get("imdb_rating"),
        "yes" if info.get("poster") and info["poster"] != _NA else "no",
    )
    return info
