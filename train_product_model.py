"""
train_product_model.py
─────────────────────────────────────────────────────────────────
SentiStream AI — Product Sentiment Model Trainer

Trains a sentiment classifier on Amazon product reviews and saves
the model + vectorizer to disk for use by master_analyzer.py.

Dataset  : amazon_dataset.csv
Text col : Text          (full review text)
Label col: Score         (1–5 star rating → converted to sentiment)

    ⭐⭐⭐⭐⭐  4 – 5  →  Positive
    ⭐⭐⭐     3      →  Neutral
    ⭐⭐       1 – 2  →  Negative

Output files (saved to project root):
    product_model.pkl       — trained LogisticRegression + LabelEncoder
    product_vectorizer.pkl  — fitted TfidfVectorizer

Usage:
    python train_product_model.py
    python train_product_model.py --csv amazon_dataset.csv --rows 100000
"""

import os
import sys
import pickle
import logging
import argparse
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

# ── Make sure the backend package is importable ───────────────────
# Works whether you run from the project root or from a sub-folder.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.cleaner import TextCleaner, download_nltk_resources

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model            import LogisticRegression
from sklearn.model_selection         import train_test_split
from sklearn.metrics                 import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder

# ── Logging setup ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("SentiStream.product_train")


# ══════════════════════════════════════════════════════════════════
#  CONSTANTS — column names from your amazon_dataset.csv
# ══════════════════════════════════════════════════════════════════

TEXT_COL  = "Text"    # full review text
SCORE_COL = "Score"   # 1-5 star rating


# ══════════════════════════════════════════════════════════════════
#  STAR RATING → SENTIMENT LABEL
# ══════════════════════════════════════════════════════════════════

def score_to_label(score) -> str:
    """
    Convert a 1–5 star Amazon rating into a sentiment label.

        4 or 5  →  Positive
        3       →  Neutral
        1 or 2  →  Negative

    Any value that cannot be parsed falls back to "Neutral".

    Args:
        score : Raw value from the Score column (int, float, or str).

    Returns:
        One of "Positive", "Neutral", or "Negative".
    """
    try:
        s = float(score)
    except (ValueError, TypeError):
        return "Neutral"   # safe fallback for missing / malformed values

    if s >= 4:
        return "Positive"
    elif s == 3:
        return "Neutral"
    else:
        return "Negative"


# ══════════════════════════════════════════════════════════════════
#  MAIN TRAINING PIPELINE
# ══════════════════════════════════════════════════════════════════

def train(
    csv_path:   str   = "amazon_dataset.csv",
    text_col:   str   = TEXT_COL,
    score_col:  str   = SCORE_COL,
    max_rows:   int   = None,
    test_size:  float = 0.20,
    model_path: str   = "product_model.pkl",
    vec_path:   str   = "product_vectorizer.pkl",
) -> None:
    """
    End-to-end training pipeline:

        Step 1  — Download NLTK resources (tokeniser, stopwords, etc.)
        Step 2  — Load amazon_dataset.csv
        Step 3  — Convert Score (1–5) → sentiment label
        Step 4  — Clean review text with NLTK-based TextCleaner
        Step 5  — Split into train / test sets
        Step 6  — Fit TF-IDF vectorizer
        Step 7  — Train Logistic Regression classifier
        Step 8  — Evaluate and print metrics
        Step 9  — Save model + vectorizer to disk

    Args:
        csv_path   : Path to the Amazon reviews CSV file.
        text_col   : Column containing review text  (default: "Text").
        score_col  : Column containing star rating  (default: "Score").
        max_rows   : Limit rows for quick testing   (None = all rows).
        test_size  : Fraction held out for eval     (default: 20 %).
        model_path : Where to save the trained model pickle.
        vec_path   : Where to save the fitted vectorizer pickle.
    """

    print("""
╔══════════════════════════════════════════════════════════════╗
║      SentiStream AI — Product Sentiment Model Training       ║
╚══════════════════════════════════════════════════════════════╝
""")

    # ── Step 1: NLTK resources ────────────────────────────────────
    print("  [1/9]  Downloading NLTK resources …")
    download_nltk_resources()

    # ── Step 2: Load CSV ──────────────────────────────────────────
    print(f"  [2/9]  Loading dataset: {csv_path}")

    if not os.path.exists(csv_path):
        print(f"\n  ❌  File not found: '{csv_path}'")
        print(f"  Make sure amazon_dataset.csv is in the project folder,")
        print(f"  or pass a different path with --csv <path>\n")
        sys.exit(1)

    df = pd.read_csv(csv_path, nrows=max_rows)
    log.info("Loaded %d rows from %s", len(df), csv_path)

    # Verify the columns we need actually exist
    for col in [text_col, score_col]:
        if col not in df.columns:
            print(f"\n  ❌  Column '{col}' not found in CSV.")
            print(f"  Columns found: {list(df.columns)}\n")
            sys.exit(1)

    # ── Step 3: Score → Label ─────────────────────────────────────
    print("  [3/9]  Converting star ratings to sentiment labels …")

    df["label"] = df[score_col].apply(score_to_label)
    df["text"]  = df[text_col].astype(str)
    df = df[["text", "label"]].dropna().reset_index(drop=True)

    dist = df["label"].value_counts()
    log.info(
        "Label distribution — Positive: %d  |  Neutral: %d  |  Negative: %d",
        dist.get("Positive", 0),
        dist.get("Neutral",  0),
        dist.get("Negative", 0),
    )

    if len(df) == 0:
        print("\n  ❌  No usable rows after label conversion. Check your CSV.\n")
        sys.exit(1)

    # ── Step 4: Clean text ────────────────────────────────────────
    print("  [4/9]  Cleaning review text (NLTK tokenise / lemmatise) …")
    print("         (this may take a minute for large datasets)")

    cleaner     = TextCleaner()
    df["clean"] = cleaner.clean_series(df["text"])

    # Drop rows that became empty after cleaning
    df = df[df["clean"].str.strip() != ""].reset_index(drop=True)
    log.info("%d rows remaining after text cleaning.", len(df))

    # ── Step 5: Train / test split ────────────────────────────────
    print("  [5/9]  Splitting data into train / test sets …")

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            df["clean"],
            df["label"],
            test_size=test_size,
            random_state=42,
            stratify=df["label"],   # keeps label ratios equal in both splits
        )
    except ValueError as exc:
        log.warning("Stratified split failed (%s) — using random split instead.", exc)
        X_train, X_test, y_train, y_test = train_test_split(
            df["clean"], df["label"],
            test_size=test_size,
            random_state=42,
        )

    log.info("Train set: %d rows  |  Test set: %d rows", len(X_train), len(X_test))

    # ── Step 6: TF-IDF vectorisation ──────────────────────────────
    print("  [6/9]  Fitting TF-IDF vectorizer …")

    vectorizer = TfidfVectorizer(
        max_features=15_000,  # keep the 15 000 most informative terms
        ngram_range=(1, 2),   # use single words AND two-word phrases
        sublinear_tf=True,    # apply log(1 + tf) — reduces impact of very
                              # common words like "the", "is", etc.
        min_df=2,             # ignore terms that appear in only one review
    )

    X_tr = vectorizer.fit_transform(X_train)   # learn vocab + transform
    X_te = vectorizer.transform(X_test)        # transform only (no leakage)

    log.info("Vocabulary size: %d unique features", len(vectorizer.vocabulary_))

    # ── Step 7: Train Logistic Regression ─────────────────────────
    print("  [7/9]  Training Logistic Regression classifier …")
    print("         (solver: lbfgs, max_iter: 1000)")

    # LabelEncoder converts string labels → integers for sklearn
    encoder = LabelEncoder()
    y_tr    = encoder.fit_transform(y_train)
    y_te    = encoder.transform(y_test)

    clf = LogisticRegression(
        C=1.0,           # regularisation — 1.0 is a solid starting point
        max_iter=1000,   # enough iterations to reliably converge
        solver="lbfgs",  # best general-purpose solver for multi-class text
    )
    clf.fit(X_tr, y_tr)

    log.info("Training complete.  Classes: %s", list(encoder.classes_))

    # ── Step 8: Evaluate ──────────────────────────────────────────
    print("  [8/9]  Evaluating on test set …")

    y_pred        = clf.predict(X_te)
    y_pred_labels = encoder.inverse_transform(y_pred)
    y_true_labels = y_test.values

    acc    = accuracy_score(y_true_labels, y_pred_labels)
    report = classification_report(y_true_labels, y_pred_labels, zero_division=0)
    matrix = confusion_matrix(
        y_true_labels,
        y_pred_labels,
        labels=list(encoder.classes_),   # consistent row/col order
    )

    print("\n" + "═" * 58)
    print("  📊  Training Results")
    print("═" * 58)
    print(f"  Accuracy : {acc * 100:.2f}%")
    print(f"\n  Per-class Report:\n{report}")
    print(f"  Confusion Matrix  (rows = true label, cols = predicted):")
    print(f"  Label order: {list(encoder.classes_)}")
    print(f"\n{matrix}")
    print("═" * 58)

    # ── Step 9: Save ──────────────────────────────────────────────
    print(f"\n  [9/9]  Saving model and vectorizer …")

    with open(model_path, "wb") as f:
        pickle.dump({"model": clf, "encoder": encoder}, f)
    log.info("Model saved      →  %s", model_path)

    with open(vec_path, "wb") as f:
        pickle.dump(vectorizer, f)
    log.info("Vectorizer saved →  %s", vec_path)

    print(f"""
  ✅  Training complete!

  Files saved:
      {model_path}
      {vec_path}

  Next step — run the analyzer:
      python -m backend.master_analyzer
""")


# ══════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SentiStream AI — Train product sentiment model on Amazon reviews."
    )
    parser.add_argument(
        "--csv",   default="amazon_dataset.csv",
        help="Path to the Amazon reviews CSV  (default: amazon_dataset.csv)",
    )
    parser.add_argument(
        "--text",  default=TEXT_COL,
        help=f"Column name for review text    (default: {TEXT_COL})",
    )
    parser.add_argument(
        "--score", default=SCORE_COL,
        help=f"Column name for star ratings   (default: {SCORE_COL})",
    )
    parser.add_argument(
        "--rows",  type=int, default=None,
        help="Max rows to load — handy for quick tests  (default: all)",
    )
    parser.add_argument(
        "--test",  type=float, default=0.20,
        help="Fraction of data held out for evaluation  (default: 0.20)",
    )
    parser.add_argument(
        "--model", default="product_model.pkl",
        help="Output path for the trained model         (default: product_model.pkl)",
    )
    parser.add_argument(
        "--vec",   default="product_vectorizer.pkl",
        help="Output path for the vectorizer            (default: product_vectorizer.pkl)",
    )
    args = parser.parse_args()

    train(
        csv_path   = args.csv,
        text_col   = args.text,
        score_col  = args.score,
        max_rows   = args.rows,
        test_size  = args.test,
        model_path = args.model,
        vec_path   = args.vec,
    )
