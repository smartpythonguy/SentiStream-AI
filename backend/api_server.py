from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.domain_router import analyze_topic

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static fallback trending topics per domain ────────────────────────────────
_TRENDING_FALLBACKS: dict[str, list[str]] = {
    "news":        ["Trump", "Russia-Ukraine", "India-Pakistan", "Climate Policy", "Gaza", "AI Regulation"],
    "products":    ["iPhone 16", "Samsung S25", "Pixel 9a", "Tesla Model Y", "PS5", "Vision Pro"],
    "restaurants": ["McDonald's", "Starbucks", "Domino's", "Subway", "KFC", "Zomato"],
    "movies":      ["Pushpa 2", "Squid Game", "Wednesday", "Stranger Things", "Deadpool 3", "Dune Part 2"],
}

@app.get("/")
def home():
    return {"message": "SentiStream AI API Running"}

@app.get("/analyze")
def analyze(domain: str, topic: str):
    result = analyze_topic(domain, topic)
    return {
        "status": "success",
        "result": result
    }

@app.get("/trending")
def trending(domain: str = "news"):
    """
    Return trending topics for the given domain.
    Falls back to curated static lists when live data is unavailable.
    The frontend calls /api/trending?domain=<domain> which Next.js
    proxies to this endpoint (configure in next.config.mjs rewrites).
    """
    topics = _TRENDING_FALLBACKS.get(domain, _TRENDING_FALLBACKS["news"])
    return {"status": "success", "domain": domain, "topics": topics}