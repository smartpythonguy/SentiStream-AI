"""
streamlit_app.py  (FUTURE FRONTEND — optional)
─────────────────────────────────────────────────────────────────
A minimal Streamlit frontend that uses the SentiStream backend.
The entire analysis logic lives in backend/ — this file only
handles UI rendering.

To run:
    pip install streamlit
    streamlit run streamlit_app.py

This file is intentionally minimal so the backend logic stays
clean and reusable in any other frontend (FastAPI, Flask, etc.).
"""

# ── Uncomment when you are ready to add a frontend ────────────────
#
# import streamlit as st
# import sys, os
# sys.path.insert(0, os.path.dirname(__file__))
# from backend.analyzer import SentimentAnalyzer
#
# @st.cache_resource
# def load_analyzer():
#     return SentimentAnalyzer(use_mock=False)
#
# def main():
#     st.set_page_config(page_title="SentiStream AI", page_icon="🤖")
#     st.title("🤖 SentiStream AI")
#     st.caption("Real-time Reddit sentiment analysis")
#
#     analyzer = load_analyzer()
#
#     query = st.text_input("Enter a topic or keyword:", placeholder="e.g. electric vehicles")
#     limit = st.slider("Max Reddit posts to fetch", 10, 100, 50)
#
#     if st.button("Analyse Sentiment") and query:
#         with st.spinner(f"Fetching Reddit posts for '{query}' …"):
#             report = analyzer.analyze(query, limit=limit)
#
#         if "error" in report:
#             st.error(report["error"])
#             return
#
#         pcts = report["percentages"]
#
#         st.subheader(f"Overall Verdict: {report['verdict']}")
#         st.write(f"Based on **{report['total']}** Reddit posts and comments")
#
#         col1, col2, col3 = st.columns(3)
#         col1.metric("✅ Positive", f"{pcts['Positive']}%")
#         col2.metric("➖ Neutral",  f"{pcts['Neutral']}%")
#         col3.metric("❌ Negative", f"{pcts['Negative']}%")
#
#         if report.get("all_keywords"):
#             st.write("**Top Keywords:**", ", ".join(report["all_keywords"]))
#
#         for label in ("Positive", "Negative"):
#             opinions = report["top_opinions"].get(label, [])
#             if opinions:
#                 st.subheader(f"{'✅' if label == 'Positive' else '❌'} {label} Opinions")
#                 for op in opinions:
#                     with st.expander(f"↑{op['score']}  r/{op['subreddit']}"):
#                         st.write(op["text"])
#                         if op.get("url"):
#                             st.markdown(f"[View on Reddit]({op['url']})")
#
# if __name__ == "__main__":
#     main()

# ── Placeholder message when run directly ─────────────────────────
print("""
streamlit_app.py is a Streamlit frontend stub.

To activate it:
    1. Uncomment all the code above
    2. pip install streamlit
    3. streamlit run streamlit_app.py
""")
