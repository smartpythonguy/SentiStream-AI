"""
backend/model_loader.py
Loads the trained TF-IDF vectorizer and Logistic Regression model
from disk. Provides a ModelLoader class that caches the loaded
objects so they are only read from disk once per session.
"""

import pickle
import logging
from pathlib import Path

log = logging.getLogger("SentiStream.model_loader")


class ModelLoader:
    """
    Load and cache the trained model + vectorizer from .pkl files.

    The objects are loaded once on first access and reused for
    every subsequent prediction (no disk I/O on repeated calls).

    Usage:
        loader    = ModelLoader()
        model     = loader.model       # SentimentModel instance
        vectorizer = loader.vectorizer # TfidfVectorizer instance
    """

    def __init__(
        self,
        model_path:      str = "sentiment_model.pkl",
        vectorizer_path: str = "vectorizer.pkl",
    ):
        self._model_path      = Path(model_path)
        self._vectorizer_path = Path(vectorizer_path)
        self._model           = None   # loaded on first access
        self._vectorizer      = None

    # ── Internal loaders ─────────────────────────────────────────

    def _load_model(self):
        """Load sentiment_model.pkl and return the bundle dict."""
        if not self._model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {self._model_path}\n"
                "Run train_model.py first to generate the model."
            )
        log.info("Loading model from %s …", self._model_path)
        with open(self._model_path, "rb") as f:
            return pickle.load(f)

    def _load_vectorizer(self):
        """Load vectorizer.pkl and return the TfidfVectorizer."""
        if not self._vectorizer_path.exists():
            raise FileNotFoundError(
                f"Vectorizer file not found: {self._vectorizer_path}\n"
                "Run train_model.py first to generate the vectorizer."
            )
        log.info("Loading vectorizer from %s …", self._vectorizer_path)
        with open(self._vectorizer_path, "rb") as f:
            return pickle.load(f)

    # ── Public properties ─────────────────────────────────────────

    @property
    def model(self):
        """Return the loaded model bundle (cached after first load)."""
        if self._model is None:
            self._model = self._load_model()
        return self._model

    @property
    def vectorizer(self):
        """Return the loaded TfidfVectorizer (cached after first load)."""
        if self._vectorizer is None:
            self._vectorizer = self._load_vectorizer()
        return self._vectorizer

    @property
    def classifier(self):
        """Return the LogisticRegression estimator from the bundle."""
        return self.model["model"]

    @property
    def label_encoder(self):
        """Return the LabelEncoder from the bundle."""
        return self.model["encoder"]

    def is_ready(self) -> bool:
        """Return True if both .pkl files exist and can be loaded."""
        try:
            _ = self.classifier
            _ = self.vectorizer
            return True
        except Exception as exc:
            log.warning("Model not ready: %s", exc)
            return False
