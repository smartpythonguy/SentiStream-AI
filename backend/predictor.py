"""
backend/predictor.py
Sentiment prediction using a Hugging Face transformer model.

Model: cardiffnlp/twitter-roberta-base-sentiment-latest
  — Outputs: Positive | Negative | Neutral (exact label strings)
  — Fine-tuned on ~124M tweets; handles short headline/review text well
  — Downloaded once on first use, then cached by HF Hub locally

Public API is identical to the old TF-IDF version:
    predictor = Predictor()
    result    = predictor.predict("This product is amazing!")
    # → { "label": "Positive", "probabilities": {...}, "cleaned_text": "..." }
"""

import logging
import threading
from typing import List

log = logging.getLogger("SentiStream.predictor")

# ── Model config ──────────────────────────────────────────────────────
_MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"

_LABEL_MAP = {
    "positive":  "Positive",
    "negative":  "Negative",
    "neutral":   "Neutral",
    "label_0":   "Negative",
    "label_1":   "Neutral",
    "label_2":   "Positive",
}

# ── True singleton — one pipeline for the entire process ──────────────
# Using a module-level variable + lock instead of lru_cache to guarantee
# a single instance even if _get_pipeline() is somehow imported from
# multiple module paths (e.g. domain_router importing a different copy).
_PIPELINE = None
_PIPELINE_LOCK = threading.Lock()


def _normalise(raw: str) -> str:
    """Canonical label: 'Positive' | 'Negative' | 'Neutral'."""
    return _LABEL_MAP.get(raw.lower(), "Neutral")


def _resolve_device() -> int:
    """
    Return the transformers pipeline device integer.
      0   → first CUDA GPU
     -1   → CPU

    Explicitly NEVER returns a torch.device("meta") — meta tensors are
    only for model analysis/tracing and will crash at inference time.
    """
    try:
        import torch
        if torch.cuda.is_available():
            log.info("CUDA available — loading model on GPU 0")
            return 0
    except Exception:
        pass
    log.info("No CUDA — loading model on CPU")
    return -1          # transformers pipeline API: -1 == CPU


def _get_pipeline():
    """
    Return the HF pipeline singleton, building it once on first call.

    Thread-safe: uses a module-level lock so concurrent requests during
    cold-start don't race to build multiple pipelines.

    IMPORTANT: we pass an explicit integer `device` and never use
    `device_map` — device_map="auto" on machines with no GPU can route
    to the "meta" device in newer versions of transformers/accelerate,
    which produces placeholder tensors that crash on .item() calls.
    """
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE

    with _PIPELINE_LOCK:
        # Double-checked locking — another thread may have built it
        # while we were waiting for the lock.
        if _PIPELINE is not None:
            return _PIPELINE

        from transformers import (
            AutoTokenizer,
            AutoModelForSequenceClassification,
            pipeline,
        )
        import torch

        device_int = _resolve_device()

        log.info("Loading tokenizer: %s", _MODEL_NAME)
        tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)

        log.info("Loading model: %s", _MODEL_NAME)
        # Load onto CPU first — safe regardless of environment.
        model = AutoModelForSequenceClassification.from_pretrained(
            _MODEL_NAME,
            # Explicitly NO device_map — avoids accelerate routing to meta.
        )

        # Move to the target device after loading.
        target = torch.device("cuda:0") if device_int == 0 else torch.device("cpu")
        model = model.to(target)
        model.eval()

        log.info("Building pipeline on device=%s", target)
        _PIPELINE = pipeline(
            "text-classification",
            model=model,
            tokenizer=tokenizer,
            top_k=None,       # return all class scores, not just top-1
            truncation=True,
            max_length=512,
            device=device_int,
            # NO device_map here — ever.
        )

        log.info("Pipeline ready.")
        return _PIPELINE


class Predictor:
    """
    Wrapper around the HF transformer pipeline for real-time inference.

    All instances share the same underlying pipeline singleton so the
    model is only loaded into memory once, no matter how many Predictor
    objects are created across the codebase.
    """

    def __init__(self, loader=None, cleaner=None):
        """
        Args:
            loader  : Ignored — kept for API compatibility.
            cleaner : Optional TextCleaner; only used to populate
                      cleaned_text in the result dict.
        """
        self._cleaner = cleaner

    # ── Internal ──────────────────────────────────────────────────────

    def _pipe(self):
        """Always returns the process-global pipeline singleton."""
        return _get_pipeline()

    def _scores_to_dict(self, scores: List[dict]) -> dict:
        """
        Convert [{"label": "Positive", "score": 0.87}, ...] →
        {"Positive": 87.0, "Negative": 8.5, "Neutral": 4.5}
        """
        result = {"Positive": 0.0, "Negative": 0.0, "Neutral": 0.0}
        for s in scores:
            label = _normalise(s["label"])
            result[label] = round(float(s["score"]) * 100, 1)
        return result

    # ── Public API ────────────────────────────────────────────────────

    def predict(self, text: str, pre_cleaned: bool = False) -> dict:
        """
        Predict sentiment for a single string.

        Returns:
            dict with keys: label, probabilities, cleaned_text
        """
        if not text or not text.strip():
            return {
                "label":         "Neutral",
                "probabilities": {"Neutral": 100.0, "Positive": 0.0, "Negative": 0.0},
                "cleaned_text":  "",
            }

        cleaned = self._cleaner.clean(text) if self._cleaner else text
        scores  = self._pipe()(text)[0]          # pipeline returns List[List[dict]]
        probs   = self._scores_to_dict(scores)
        label   = max(probs, key=probs.__getitem__)

        return {
            "label":         label,
            "probabilities": probs,
            "cleaned_text":  cleaned,
        }

    def predict_batch(self, texts: List[str], pre_cleaned: bool = False) -> List[dict]:
        """
        Predict sentiment for a list of strings using native HF batching.

        Returns:
            List of dicts — same format as predict().
        """
        if not texts:
            return []

        empty_result = {
            "label":         "Neutral",
            "probabilities": {"Neutral": 100.0, "Positive": 0.0, "Negative": 0.0},
            "cleaned_text":  "",
        }

        indices_to_run = [i for i, t in enumerate(texts) if t and t.strip()]
        if not indices_to_run:
            return [dict(empty_result) for _ in texts]

        texts_to_run  = [texts[i] for i in indices_to_run]
        batch_scores  = self._pipe()(texts_to_run)   # List[List[dict]] when top_k=None

        results: List[dict] = [dict(empty_result) for _ in texts]
        for pos, idx in enumerate(indices_to_run):
            probs  = self._scores_to_dict(batch_scores[pos])
            label  = max(probs, key=probs.__getitem__)
            cleaned = self._cleaner.clean(texts[idx]) if self._cleaner else texts[idx]
            results[idx] = {
                "label":         label,
                "probabilities": probs,
                "cleaned_text":  cleaned,
            }

        return results
