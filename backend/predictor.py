"""
backend/predictor.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Local Model Predictor (v2.0)

Replaces the HuggingFace RoBERTa pipeline with the locally trained
TF-IDF + Logistic Regression model loaded via ModelLoader.

• Loaded once at import time via @lru_cache singleton — zero cold-
  start cost on repeated predictions.
• predict()       → single text, returns label + probabilities dict
• predict_batch() → list of texts, batched through sklearn for speed
• Output schema is identical to the old HuggingFace predictor so
  domain_router.py and all callers require zero changes.

Label mapping (matches train_model.py):
    Positive | Negative | Neutral
"""

import logging
import re
from functools import lru_cache
from typing import Dict, List

from backend.model_loader import ModelLoader
from backend.cleaner import TextCleaner, download_nltk_resources

log = logging.getLogger("SentiStream.predictor")

# ── Label normalisation map ────────────────────────────────────────
# sklearn LabelEncoder sorts labels alphabetically, so classes are:
#   0 → Negative, 1 → Neutral, 2 → Positive
# These are the canonical display labels the frontend expects.
_CANONICAL = {"Positive": "Positive", "Negative": "Negative", "Neutral": "Neutral"}


@lru_cache(maxsize=1)
def _get_loader() -> ModelLoader:
    """Load the model exactly once per process lifetime."""
    loader = ModelLoader()
    # Eagerly trigger both loads so the first prediction is fast
    _ = loader.classifier
    _ = loader.vectorizer
    log.info(
        "Local sentiment model ready. Classes: %s",
        list(loader.label_encoder.classes_),
    )
    return loader


@lru_cache(maxsize=1)
def _get_cleaner() -> TextCleaner:
    """Return a shared TextCleaner instance (NLTK resources downloaded once)."""
    download_nltk_resources()
    return TextCleaner()


def _clean(text: str) -> str:
    """Lightweight fallback clean if TextCleaner is unavailable."""
    try:
        return _get_cleaner().clean(text)
    except Exception:
        return re.sub(r"[^\w\s]", " ", text.lower()).strip()


def _proba_dict(loader: ModelLoader, proba_row) -> Dict[str, float]:
    """
    Convert a sklearn predict_proba row into the probability dict the
    frontend expects:  {"Positive": 72.3, "Negative": 18.1, "Neutral": 9.6}
    Values are percentages (0–100), rounded to one decimal place.
    """
    classes = loader.label_encoder.classes_   # e.g. ['Negative', 'Neutral', 'Positive']
    return {
        _CANONICAL.get(cls, cls): round(float(p) * 100, 1)
        for cls, p in zip(classes, proba_row)
    }


class Predictor:
    """
    Drop-in replacement for the HuggingFace predictor.

    Public interface (unchanged):
        predict(text)        → {"label": str, "probabilities": dict, "cleaned_text": str}
        predict_batch(texts) → [{"label": str, "probabilities": dict}, ...]
    """

    def __init__(self):
        # Trigger eager load at construction time so the first API
        # request doesn't pay the disk-read cost.
        self._loader  = _get_loader()
        self._cleaner = _get_cleaner()

    # ── Single prediction ──────────────────────────────────────────

    def predict(self, text: str) -> Dict:
        """
        Predict the sentiment of a single text string.

        Returns:
            {
                "label":        "Positive" | "Negative" | "Neutral",
                "probabilities": {"Positive": float, "Negative": float, "Neutral": float},
                "cleaned_text": str   # cleaned version used for inference
            }
        """
        cleaned = _clean(text)
        if not cleaned.strip():
            return {
                "label":         "Neutral",
                "probabilities": {"Positive": 0.0, "Negative": 0.0, "Neutral": 100.0},
                "cleaned_text":  cleaned,
            }

        loader   = self._loader
        vec      = loader.vectorizer.transform([cleaned])
        proba    = loader.classifier.predict_proba(vec)[0]
        label_id = proba.argmax()
        label    = _CANONICAL.get(loader.label_encoder.classes_[label_id], "Neutral")

        return {
            "label":         label,
            "probabilities": _proba_dict(loader, proba),
            "cleaned_text":  cleaned,
        }

    # ── Batch prediction ───────────────────────────────────────────

    def predict_batch(self, texts: List[str]) -> List[Dict]:
        """
        Predict sentiment for a list of texts in one vectoriser pass.

        Returns a list of dicts with the same schema as predict(), but
        without "cleaned_text" (callers don't use it for batch results).

        Throughput: typically > 1 000 texts/second on CPU.
        """
        if not texts:
            return []

        loader  = self._loader
        cleaned = [_clean(t) for t in texts]

        # Indices of empty strings — fall back to Neutral
        empty_idx = {i for i, c in enumerate(cleaned) if not c.strip()}
        non_empty = [(i, c) for i, c in enumerate(cleaned) if i not in empty_idx]

        results: List[Dict] = [None] * len(texts)

        # Fill empties
        neutral_result = {
            "label":         "Neutral",
            "probabilities": {"Positive": 0.0, "Negative": 0.0, "Neutral": 100.0},
        }
        for i in empty_idx:
            results[i] = neutral_result.copy()

        # Batch transform non-empty texts
        if non_empty:
            idxs, clean_texts = zip(*non_empty)
            vec    = loader.vectorizer.transform(list(clean_texts))
            probas = loader.classifier.predict_proba(vec)

            for i, proba_row in zip(idxs, probas):
                label_id = proba_row.argmax()
                label    = _CANONICAL.get(loader.label_encoder.classes_[label_id], "Neutral")
                results[i] = {
                    "label":         label,
                    "probabilities": _proba_dict(loader, proba_row),
                }

        return results
