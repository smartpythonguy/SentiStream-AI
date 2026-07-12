"""
backend/cleaner.py
NLTK-based text preprocessing pipeline — handles both Amazon reviews
and Reddit posts (u/user mentions, r/sub links, markdown, etc.).
"""

import re
import logging
import pandas as pd

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer

log = logging.getLogger("SentiStream.cleaner")


def download_nltk_resources() -> None:
    """Download required NLTK data on first run."""
    needed = [
        ("tokenizers/punkt",     "punkt"),
        ("tokenizers/punkt_tab", "punkt_tab"),
        ("corpora/stopwords",    "stopwords"),
        ("corpora/wordnet",      "wordnet"),
    ]
    for path, pkg in needed:
        try:
            nltk.data.find(path)
        except LookupError:
            log.info("Downloading NLTK resource: %s", pkg)
            nltk.download(pkg, quiet=True)


class TextCleaner:
    """
    Clean raw text through a 10-step NLTK pipeline.

    Handles standard review text AND Reddit-specific noise:
      - u/username and r/subreddit mentions
      - Markdown formatting (**bold**, *italic*, > quotes, # headers)
      - Reddit flairs [OC], [Question], (crosspost)
      - URLs, HTML entities, punctuation, digits
    """

    def __init__(self):
        download_nltk_resources()
        self.stop_words = set(stopwords.words("english"))
        self.lemmatizer = WordNetLemmatizer()

        # Pre-compiled regex for speed
        self._reddit_user  = re.compile(r"u/\w+")
        self._reddit_sub   = re.compile(r"r/\w+")
        self._flair        = re.compile(r"\[.*?\]|\(.*?\)")
        self._url          = re.compile(r"https?://\S+|www\.\S+")
        self._html_entity  = re.compile(r"&\w+;|&#\d+;")
        self._html_tag     = re.compile(r"<[^>]+>")
        self._markdown     = re.compile(r"[*_~`#>|\\]")
        self._non_alpha    = re.compile(r"[^a-z\s]")
        self._spaces       = re.compile(r"\s{2,}")

    def clean(self, text: str) -> str:
        """Full 10-step cleaning pipeline on a single string."""
        if not isinstance(text, str) or not text.strip():
            return ""

        text = text.lower()                             # 1. lowercase
        text = self._reddit_user.sub(" ", text)         # 2. u/user
        text = self._reddit_sub.sub(" ", text)          # 2. r/sub
        text = self._flair.sub(" ", text)               # 2. [flair]
        text = self._url.sub(" ", text)                 # 3. URLs
        text = self._html_entity.sub(" ", text)         # 4. HTML entities
        text = self._html_tag.sub(" ", text)            # 4. HTML tags
        text = self._markdown.sub(" ", text)            # 5. markdown
        text = self._non_alpha.sub(" ", text)           # 6. non-alpha
        text = self._spaces.sub(" ", text).strip()

        if not text:
            return ""

        tokens = word_tokenize(text)                    # 7. tokenize
        tokens = [                                      # 8+9. stopwords + lemma
            self.lemmatizer.lemmatize(t)
            for t in tokens
            if t not in self.stop_words and len(t) > 2
        ]
        return " ".join(tokens)                         # 10. rejoin

    def clean_list(self, texts: list) -> list:
        """Clean a Python list of strings."""
        return [self.clean(t) for t in texts]

    def clean_series(self, series: pd.Series) -> pd.Series:
        """Clean an entire pandas Series column."""
        return series.apply(self.clean)
