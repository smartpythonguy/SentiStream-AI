"""
SentiStream AI — report_visualizer.py
======================================
Generates pie and bar charts from sentiment analysis results.
Compatible with domain_router.py output format.

Usage (standalone):
    python report_visualizer.py

Usage (from domain_router.py):
    from report_visualizer import generate_sentiment_report
    generate_sentiment_report(positive=120, neutral=45, negative=35, topic="Finance")
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec


# ─────────────────────────────────────────────
#  COLOR PALETTE  (feel free to customize)
# ─────────────────────────────────────────────
COLORS = {
    "Positive": "#4CAF50",   # green
    "Neutral":  "#FFC107",   # amber
    "Negative": "#F44336",   # red
}

BACKGROUND = "#0F1117"   # dark canvas
TEXT_COLOR = "#E8EAF0"   # off-white labels
ACCENT     = "#7C83FD"   # purple accent for bar edges


# ─────────────────────────────────────────────
#  CONSOLE REPORT  (internal helper)
# ─────────────────────────────────────────────
def _print_console_report(positive: int, neutral: int, negative: int, topic: str) -> None:
    """
    Print a readable ASCII summary to the terminal.

    Args:
        positive : count of positive responses
        neutral  : count of neutral  responses
        negative : count of negative responses
        topic    : label shown in the header (e.g. 'Finance', 'Healthcare')
    """
    data      = {"Positive": positive, "Neutral": neutral, "Negative": negative}
    total     = sum(data.values())
    bar_width = 30   # characters for the ASCII progress bar

    if total == 0:
        print("[SentiStream] No data to display.")
        return

    print()
    print("=" * 50)
    print(f"  SentiStream AI  |  Topic: {topic}")
    print("=" * 50)

    for label in ["Positive", "Neutral", "Negative"]:
        count  = data[label]
        pct    = (count / total) * 100
        filled = int((pct / 100) * bar_width)
        bar    = "█" * filled + "░" * (bar_width - filled)
        print(f"  {label:<10} {bar}  {pct:5.1f}%  ({count})")

    print("-" * 50)
    print(f"  Total responses: {total}")
    print("=" * 50)
    print()


# ─────────────────────────────────────────────
#  PIE CHART  (internal helper)
# ─────────────────────────────────────────────
def _build_pie(ax, positive: int, neutral: int, negative: int, topic: str) -> None:
    """Draw a styled pie chart on the given Axes."""
    raw    = {"Positive": positive, "Neutral": neutral, "Negative": negative}
    labels = [k for k, v in raw.items() if v > 0]
    sizes  = [raw[k] for k in labels]
    colors = [COLORS[k] for k in labels]

    # explode the largest slice slightly for visual emphasis
    max_idx = sizes.index(max(sizes))
    explode = [0.04 if i == max_idx else 0 for i in range(len(sizes))]

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels       = labels,
        colors       = colors,
        explode      = explode,
        autopct      = "%1.1f%%",
        startangle   = 140,
        pctdistance  = 0.78,
        wedgeprops   = {"linewidth": 2, "edgecolor": BACKGROUND},
    )

    for t in texts:
        t.set_color(TEXT_COLOR)
        t.set_fontsize(11)
        t.set_fontweight("bold")

    for at in autotexts:
        at.set_color("#FFFFFF")
        at.set_fontsize(10)
        at.set_fontweight("bold")

    ax.set_title(
        f"Sentiment Distribution\n{topic}",
        color      = TEXT_COLOR,
        fontsize   = 13,
        fontweight = "bold",
        pad        = 14,
    )


# ─────────────────────────────────────────────
#  BAR CHART  (internal helper)
# ─────────────────────────────────────────────
def _build_bar(ax, positive: int, neutral: int, negative: int, topic: str) -> None:
    """Draw a styled horizontal bar chart on the given Axes."""
    data   = {"Positive": positive, "Neutral": neutral, "Negative": negative}
    labels = list(data.keys())
    values = list(data.values())
    colors = [COLORS[k] for k in labels]
    total  = sum(values) or 1

    bars = ax.barh(
        labels,
        values,
        color     = colors,
        edgecolor = ACCENT,
        linewidth = 1.2,
        height    = 0.55,
    )

    # value + percentage label to the right of each bar
    for bar, val in zip(bars, values):
        pct   = (val / total) * 100
        x_pos = bar.get_width() + max(values) * 0.02
        ax.text(
            x_pos,
            bar.get_y() + bar.get_height() / 2,
            f"{val}  ({pct:.1f}%)",
            va         = "center",
            ha         = "left",
            color      = TEXT_COLOR,
            fontsize   = 10,
            fontweight = "bold",
        )

    ax.set_xlabel("Response Count", color=TEXT_COLOR, fontsize=10)
    ax.set_title(
        f"Sentiment Counts — {topic}",
        color      = TEXT_COLOR,
        fontsize   = 13,
        fontweight = "bold",
        pad        = 12,
    )
    ax.tick_params(colors=TEXT_COLOR, labelsize=11)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    for spine in ["left", "bottom"]:
        ax.spines[spine].set_color("#3A3F5C")

    ax.set_facecolor("#1A1D2E")
    ax.xaxis.label.set_color(TEXT_COLOR)
    ax.yaxis.label.set_color(TEXT_COLOR)

    # extend x-axis so labels are never clipped
    ax.set_xlim(0, max(values) * 1.35)


# ─────────────────────────────────────────────
#  PUBLIC API — imported by domain_router.py
# ─────────────────────────────────────────────
def generate_sentiment_report(
    positive: int,
    neutral:  int,
    negative: int,
    topic:    str = "General",
) -> None:
    """
    Main entry point. Call this after your sentiment analysis is done.

    Args:
        positive : number of positive responses  (int)
        neutral  : number of neutral  responses  (int)
        negative : number of negative responses  (int)
        topic    : label for the detected domain (str), e.g. 'Finance'

    Example:
        from report_visualizer import generate_sentiment_report
        generate_sentiment_report(positive=120, neutral=45, negative=35, topic="Finance")
    """
    # ── Guard: nothing to plot if all counts are zero ──────────────────
    if positive == 0 and neutral == 0 and negative == 0:
        print("[SentiStream] ⚠  All sentiment counts are 0 — nothing to plot.")
        return

    # ── 1. Console summary ─────────────────────────────────────────────
    _print_console_report(positive, neutral, negative, topic)

    # ── 2. Build the figure ────────────────────────────────────────────
    fig = plt.figure(figsize=(13, 5.5), facecolor=BACKGROUND)
    fig.suptitle(
        "SentiStream AI  ·  Analysis Report",
        fontsize   = 16,
        fontweight = "bold",
        color      = TEXT_COLOR,
        y          = 1.01,
    )

    gs  = gridspec.GridSpec(1, 2, figure=fig, wspace=0.38)
    ax1 = fig.add_subplot(gs[0])   # pie chart
    ax2 = fig.add_subplot(gs[1])   # bar chart

    ax1.set_facecolor("#1A1D2E")
    ax2.set_facecolor("#1A1D2E")

    _build_pie(ax1, positive, neutral, negative, topic)
    _build_bar(ax2, positive, neutral, negative, topic)

    # ── 3. Shared legend at the bottom ─────────────────────────────────
    legend_patches = [
        mpatches.Patch(color=COLORS["Positive"], label="Positive"),
        mpatches.Patch(color=COLORS["Neutral"],  label="Neutral"),
        mpatches.Patch(color=COLORS["Negative"], label="Negative"),
    ]
    fig.legend(
        handles        = legend_patches,
        loc            = "lower center",
        ncol           = 3,
        frameon        = False,
        labelcolor     = TEXT_COLOR,
        fontsize       = 11,
        bbox_to_anchor = (0.5, -0.04),
    )

    plt.tight_layout()
    plt.show()
    print("[SentiStream] ✓ Charts displayed successfully.\n")


# ─────────────────────────────────────────────
#  QUICK DEMO  (run this file directly)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # Simulates the data that domain_router.py would pass in
    print("[SentiStream] Running standalone demo …")
    generate_sentiment_report(
        positive = 142,
        neutral  = 58,
        negative = 37,
        topic    = "Finance",
    )
