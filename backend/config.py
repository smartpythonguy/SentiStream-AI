"""
backend/config.py
Central configuration for SentiStream AI Backend.
"""

import os
import logging
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=_env_path)
except ImportError:
    pass

log = logging.getLogger("SentiStream.config")


class Config:
    REDDIT_CLIENT_ID:     str = os.getenv("REDDIT_CLIENT_ID",     "")
    REDDIT_CLIENT_SECRET: str = os.getenv("REDDIT_CLIENT_SECRET", "")
    REDDIT_USER_AGENT:    str = os.getenv("REDDIT_USER_AGENT",    "SentiStreamAI/1.0")

    REDDIT_POST_LIMIT:         int = 50
    REDDIT_COMMENTS_PER_POST:  int = 5
    REDDIT_SORT:               str = "relevance"
    REDDIT_TIME_FILTER:        str = "month"

    MODEL_PATH:      str = "sentiment_model.pkl"
    VECTORIZER_PATH: str = "vectorizer.pkl"

    TOP_KEYWORDS:    int = 10
    SAMPLE_OPINIONS: int = 3
    MIN_KEYWORD_LEN: int = 4
    LOG_LEVEL:       str = "INFO"

    def validate_reddit_creds(self) -> bool:
        placeholders = {"", "your_client_id_here", "your_client_secret_here"}
        ok = (self.REDDIT_CLIENT_ID not in placeholders
              and self.REDDIT_CLIENT_SECRET not in placeholders)
        if not ok:
            log.warning("Reddit credentials not configured. Copy .env.example → .env")
        return ok


cfg = Config()
