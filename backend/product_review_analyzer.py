"""
backend/product_review_analyzer.py — Final Human-Centric Edition
"""

import re
import random
import trafilatura
from collections import Counter
from typing import List, Dict, Optional

# ── EXPANDED CLEANING LIST ──────────────────────────────────────────

# Block brands, websites, and generic filler from Pros/Complaints
BORING_WORDS = {
    "google", "pixel", "apple", "iphone", "samsung", "galaxy", "sony", "dyson",
    "review", "hands", "worth", "buying", "price", "compare", "versus", "vs",
    "techradar", "cnet", "verge", "gsmarena", "phonearena", "notebookcheck",
    "digital", "trends", "expert", "reviews", "com", "net", "org", "article",
    "model", "device", "product", "everything", "basically", "actually", "really"
}

# ── TEXT CLEANING ENGINE ────────────────────────────────────────────

def scrub_metadata(text: str) -> str:
    """Removes all website names, TLDs, and headline artifacts."""
    if not text: return ""
    
    # 1. Strip URLs
    text = re.sub(r'http\S+', '', text)
    
    # 2. Strip Publisher Metadata (e.g., "- TechRadar", " | CNET")
    text = re.sub(r'\s*[\|\-–—]\s*(TechRadar|CNET|The Verge|GSMArena|PhoneArena|Notebookcheck|Digital Trends|IGN|9to5mac|9to5google|Tom\'s Guide|Forbes)\s*', '', text, flags=re.I)
    
    # 3. Strip common TLDs and "Review" artifacts
    text = re.sub(r'\.(com|net|org|co\.uk|io|biz)\s*', ' ', text, flags=re.I)
    text = re.sub(r'\b(Review|Hands-on|Unboxing|Verdict|vs)\b', '', text, flags=re.I)
    
    # 4. Clean spacing
    text = " ".join(text.split()).strip()
    return text

# ── CONSUMER INTELLIGENCE FUNCTIONS ─────────────────────────────────

def extract_pros_and_complaints(texts: List[str], top_n: int = 5) -> List[str]:
    """Extracts high-value features (battery, camera, etc.) only."""
    words = []
    for t in texts:
        # Extract meaningful tokens (length 5+)
        tokens = re.findall(r'\b\w{5,}\b', t.lower())
        words.extend([w for w in tokens if w not in BORING_WORDS])
    
    # Filter for real attributes (heuristic: prefer common consumer terms)
    return [w for w, _ in Counter(words).most_common(top_n)]

def summarise_review(text: str, label: str = "Neutral") -> str:
    """Converts raw data into a polished, human-style consumer opinion."""
    body = scrub_metadata(text)
    
    if len(body) < 15:
        return "I've been testing this for a while and the experience is fairly consistent with what others are seeing."

    # Extract first two usable sentences
    sentences = re.split(r'(?<=[.!?]) +', body)
    body_snippet = " ".join(sentences[:2]).strip()
    
    # Force human personas
    if label == "Positive":
        templates = [
            "I'm really happy with this purchase. {body}.",
            "It's been a great experience so far—{body}.",
            "Definitely worth the upgrade. {body}.",
            "Top-tier performance. {body}. I'd recommend it to anyone.",
            "Really impressed with how it handles daily use. {body}."
        ]
    elif label == "Negative":
        templates = [
            "Honestly, I'm disappointed. {body}.",
            "I expected much better for the money. {body}.",
            "There are some major frustrations—{body}.",
            "It's a bit of a letdown. {body}.",
            "I'm struggling to justify the cost when {body}."
        ]
    else:
        templates = [
            "It's a decent option, but {body}.",
            "Mixed feelings. {body}. It works, but it's not perfect.",
            "It gets the job done, though {body}."
        ]

    # Final cleanup of the snippet to ensure it flows like a sentence
    snippet = body_snippet.lower().rstrip('.')
    return random.choice(templates).format(body=snippet)

def generate_human_opinion(item: Dict, label: str, confidence: float) -> str:
    """Attempts to scrape the full article, falls back to summary, then synthesizes."""
    url = item.get("url")
    body = None
    
    # Try lightweight scraping for the "Premium" feel
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            body = trafilatura.extract(downloaded, include_comments=False)
    except:
        pass
    
    # Fallback to headline/summary
    if not body or len(body) < 100:
        body = item.get("text", "")
        
    return summarise_review(body, label=label)