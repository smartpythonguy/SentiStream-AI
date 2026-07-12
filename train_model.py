"""
train_model.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Twitter Entity Sentiment Edition

Run this ONCE to train the sentiment model on your Twitter Entity
Sentiment CSV and save sentiment_model.pkl + vectorizer.pkl to disk.

After training, the main app (main.py) loads these files for
real-time analysis without retraining each time.

Dataset format  (NO header row):
    col 0  tweet_id   → Numeric tweet identifier
    col 1  entity     → Named entity the tweet is about
    col 2  sentiment  → Positive | Negative | Neutral | Irrelevant
    col 3  text       → The tweet content  (Irrelevant rows are skipped)

Usage:
    python train_model.py
    python train_model.py --csv my_tweets.csv --rows 50000
"""

import os
import sys
import pickle
import logging
import argparse
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

# Add project root to path so 'backend' package is importable
sys.path.insert(0, os.path.dirname(__file__))

from backend.cleaner import TextCleaner, download_nltk_resources

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model            import LogisticRegression
from sklearn.model_selection         import train_test_split
from sklearn.metrics                 import (
    accuracy_score, classification_report, confusion_matrix,
)
from sklearn.preprocessing           import LabelEncoder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("SentiStream.train")


# ──────────────────────────────────────────────────────────────────
# Valid sentiment labels (anything else is dropped)
# ──────────────────────────────────────────────────────────────────
VALID_LABELS = {"Positive", "Negative", "Neutral"}


# ──────────────────────────────────────────────────────────────────
# Main training function
# ──────────────────────────────────────────────────────────────────
def train(
    csv_path:   str   = "dataset.csv",
    text_col:   str   = "text",
    label_col:  str   = "sentiment",
    max_rows:   int   = None,
    test_size:  float = 0.20,
    model_path: str   = "sentiment_model.pkl",
    vec_path:   str   = "vectorizer.pkl",
) -> None:
    """
    Full training pipeline:
        1. Download NLTK resources
        2. Load CSV
        3. Drop 'Irrelevant' rows, keep Positive / Negative / Neutral
        4. Clean text with NLTK-based TextCleaner
        5. TF-IDF vectorize  (unigrams + bigrams, 15 000 features)
        6. Train Logistic Regression
        7. Evaluate on held-out test split
        8. Save model + vectorizer

    Args:
        csv_path   : Path to your Twitter Entity Sentiment CSV.
        text_col   : Column name for tweet text  (default: "text").
        label_col  : Column name for sentiment   (default: "sentiment").
        max_rows   : Cap rows for quick testing  (None = all rows).
        test_size  : Fraction held out for eval  (default: 20 %).
        model_path : Output path for trained model pickle.
        vec_path   : Output path for fitted vectorizer pickle.
    """

    print("""
╔══════════════════════════════════════════════════════════════╗
║      SentiStream AI — Twitter Entity Sentiment Training      ║
╚══════════════════════════════════════════════════════════════╝
""")

    # ── Step 1: NLTK resources ────────────────────────────────────
    download_nltk_resources()

    # ── Step 2: Load CSV ──────────────────────────────────────────
    if not os.path.exists(csv_path):
        print(f"\n  ❌  Dataset not found: '{csv_path}'")
        print(f"  Place your Twitter Entity Sentiment CSV here and")
        print(f"  name it 'dataset.csv', or pass --csv <path>\n")
        sys.exit(1)

    log.info("Loading %s (no header row) …", csv_path)
    df = pd.read_csv(
        csv_path,
        header=None,                                          # file has no header row
        names=["tweet_id", "entity", "sentiment", "text"],   # assign column names
        nrows=max_rows,
    )
    log.info("Loaded %d rows.", len(df))

    # ── Check required columns ────────────────────────────────────
    for col in [text_col, label_col]:
        if col not in df.columns:
            print(f"\n  ❌  Column '{col}' not found after loading.")
            print(f"  Columns available: {list(df.columns)}\n")
            sys.exit(1)

    # ── Step 3: Filter labels ─────────────────────────────────────
    total_before = len(df)

    # Normalise capitalisation so "irrelevant" / "IRRELEVANT" are caught too
    df[label_col] = df[label_col].astype(str).str.strip().str.capitalize()

    # Drop "Irrelevant" and anything not in our three valid labels
    df = df[df[label_col].isin(VALID_LABELS)].copy()
    df = df[[text_col, label_col]].rename(
        columns={text_col: "text", label_col: "label"}
    )
    df = df.dropna().reset_index(drop=True)

    dropped = total_before - len(df)
    log.info(
        "Dropped %d rows (Irrelevant / NaN). Remaining: %d",
        dropped, len(df),
    )

    if len(df) == 0:
        print("\n  ❌  No usable rows remain after filtering. Check your dataset.\n")
        sys.exit(1)

    dist = df["label"].value_counts()
    log.info(
        "Label distribution — Positive: %d  Neutral: %d  Negative: %d",
        dist.get("Positive", 0),
        dist.get("Neutral",  0),
        dist.get("Negative", 0),
    )

    # ── Step 4: Clean text with NLTK ─────────────────────────────
    log.info("Cleaning text (NLTK tokenise, stopwords, lemmatise) …")
    cleaner       = TextCleaner()
    df["clean"]   = cleaner.clean_series(df["text"])
    df = df[df["clean"].str.strip() != ""].reset_index(drop=True)
    log.info("%d rows remaining after text cleaning.", len(df))

    # ── Step 5: Train / test split ────────────────────────────────
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            df["clean"], df["label"],
            test_size=test_size,
            random_state=42,
            stratify=df["label"],
        )
    except ValueError as exc:
        log.warning("Stratified split failed (%s) — falling back to random split.", exc)
        X_train, X_test, y_train, y_test = train_test_split(
            df["clean"], df["label"],
            test_size=test_size,
            random_state=42,
        )

    log.info("Train: %d  |  Test: %d", len(X_train), len(X_test))

    # ── Step 6: TF-IDF vectorisation ──────────────────────────────
    log.info("Fitting TF-IDF vectorizer (unigrams + bigrams, max 15 000 features) …")
    vectorizer = TfidfVectorizer(
        max_features=15_000,   # cap vocabulary for speed and generalisation
        ngram_range=(1, 2),    # unigrams + bigrams capture phrase sentiment
        sublinear_tf=True,     # log-scale term frequencies, reduces skew
        min_df=2,              # drop terms that appear in only one document
    )
    X_tr = vectorizer.fit_transform(X_train)
    X_te = vectorizer.transform(X_test)
    log.info("Vocabulary size: %d features", len(vectorizer.vocabulary_))

    # ── Step 7: Train Logistic Regression ─────────────────────────
    encoder = LabelEncoder()
    y_tr    = encoder.fit_transform(y_train)
    y_te    = encoder.transform(y_test)

    log.info("Training Logistic Regression …")
    clf = LogisticRegression(
        C=1.0,          # regularisation strength (higher = less regularisation)
        max_iter=1000,  # enough iterations for convergence
        solver="lbfgs", # efficient for multi-class problems
    )
    clf.fit(X_tr, y_tr)
    log.info("Training complete.  Classes: %s", list(encoder.classes_))

    # ── Step 8: Evaluate ──────────────────────────────────────────
    y_pred        = clf.predict(X_te)
    y_pred_labels = encoder.inverse_transform(y_pred)
    y_true_labels = y_test.values

    acc    = accuracy_score(y_true_labels, y_pred_labels)
    report = classification_report(
        y_true_labels, y_pred_labels, zero_division=0
    )
    matrix = confusion_matrix(
        y_true_labels, y_pred_labels, labels=list(encoder.classes_)
    )

    print("\n" + "═" * 58)
    print("  📊  Training Results")
    print("═" * 58)
    print(f"  Accuracy : {acc * 100:.2f}%")
    print(f"\n  Per-class Report:\n{report}")
    print(f"  Confusion Matrix  (rows = true, cols = predicted):")
    print(f"  Labels : {list(encoder.classes_)}")
    print(f"{matrix}")
    print("═" * 58)

    # ── Step 9: Save model + vectorizer ───────────────────────────
    with open(model_path, "wb") as f:
        pickle.dump({"model": clf, "encoder": encoder}, f)
    log.info("Model saved → %s", model_path)

    with open(vec_path, "wb") as f:
        pickle.dump(vectorizer, f)
    log.info("Vectorizer saved → %s", vec_path)

    print(f"""
  ✅  Training complete!
  Files saved:
      {model_path}
      {vec_path}

  Next step:
      python main.py
""")


# ──────────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train SentiStream AI on a Twitter Entity Sentiment CSV."
    )
    parser.add_argument(
        "--csv",   default="dataset.csv",
        help="Path to the sentiment CSV (default: dataset.csv)",
    )
    parser.add_argument(
        "--text",  default="text",
        help="Column name for tweet text (default: text)",
    )
    parser.add_argument(
        "--label", default="sentiment",
        help="Column name for sentiment labels (default: sentiment)",
    )
    parser.add_argument(
        "--rows",  type=int, default=None,
        help="Max rows to load — useful for quick testing (default: all)",
    )
    parser.add_argument(
        "--test",  type=float, default=0.20,
        help="Fraction of data held out for evaluation (default: 0.20)",
    )
    args = parser.parse_args()

    train(
        csv_path  = args.csv,
        text_col  = args.text,
        label_col = args.label,
        max_rows  = args.rows,
        test_size = args.test,
    )
