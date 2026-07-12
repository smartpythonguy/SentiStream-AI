"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Clapperboard,
  Star,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Activity,
  Sparkles,
  Film,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Loader2,
  Users,
  Award,
  AlertCircle,
  BookOpen,
  Music,
  Video,
  CheckCircle2,
  XCircle,
  Baby,
  Eye,
  MessageSquare,
  Calendar,
  Clock,
  Tag,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface MovieSectionProps {
  topic: string;
  apiData: any;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  total: number;
  dominantSentiment: "positive" | "negative" | "neutral";
  verdictScore: number;
  verdictSummary: string;
  liveSentimentData: { positive: number; negative: number; neutral: number };
  positiveHeadlines: any[];
  negativeHeadlines: any[];
  neutralHeadlines: any[];
  detectedSources: { name: string; articleCount: number; homepageUrl: string }[];
  inferSource: (r: any) => string;
}

// ── Movie metadata fetched from API data ───────────────────────────────

interface MovieMeta {
  poster: string;
  year: string;
  imdbRating: string;
  rtScore: string;
  budget: string;
  boxOffice: string;
  releaseDate: string;
  runtime: string;
  genre: string;
  seriesCount: string;
  mediaType: string;      // "Movie" | "TV Series" | ""
  totalSeasons: string;   // e.g. "3" — series only
  seriesStatus: string;   // "Running" | "Completed" — series only
}

// ── Cinematic stat pill ────────────────────────────────────────────────

function CinemaStatPill({
  label,
  value,
  icon,
  accent,
  unavailable = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  unavailable?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-sm transition-opacity ${accent}`}
      style={{ opacity: unavailable ? 0.45 : 1 }}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[#c9a84c]/70 font-medium leading-none mb-0.5">
          {label}
        </p>
        <p
          className="text-sm font-bold leading-none truncate"
          style={{ color: unavailable ? "#f5e6c060" : "#f5e6c0" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Movie hero banner ──────────────────────────────────────────────────

function MovieHero({
  topic,
  meta,
  dominantSentiment,
  verdictScore,
  total,
  isSeries,
}: {
  topic: string;
  meta: MovieMeta;
  dominantSentiment: string;
  verdictScore: number;
  total: number;
  isSeries: boolean;
}) {
  const sentimentColor =
    dominantSentiment === "positive"
      ? "text-emerald-400"
      : dominantSentiment === "negative"
      ? "text-red-400"
      : "text-[#c9a84c]";

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden border border-[#8b1a1a]/40"
      style={{
        background:
          "linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 40%, #1c1008 100%)",
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* Cinematic film-grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }}
      />
      {/* Gold top border accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, #c9a84c, #8b1a1a, #c9a84c, transparent)",
        }}
      />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="shrink-0 flex justify-center md:justify-start">
            <div
              className="relative w-[120px] h-[180px] rounded-xl overflow-hidden border-2 shadow-2xl"
              style={{ borderColor: "#c9a84c40" }}
            >
              {meta.poster && meta.poster !== "N/A" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meta.poster}
                  alt={`${topic} poster`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #2d0f0f, #1c1008)" }}
                >
                  <Film className="w-10 h-10 text-[#c9a84c]/40" />
                </div>
              )}
              {/* Gold sheen */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, transparent 60%)",
                }}
              />
            </div>
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Clapperboard className="w-3.5 h-3.5 text-[#c9a84c]" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#c9a84c] font-semibold">
                Movies & TV Shows
              </span>
            </div>

            {/* Title */}
            <h2
              className="text-2xl md:text-3xl font-bold leading-tight mb-1"
              style={{ color: "#f5e6c0" }}
            >
              {topic}
              {meta.year && meta.year !== "N/A" && (
                <span className="text-base font-normal text-[#c9a84c]/60 ml-2">
                  ({meta.year})
                </span>
              )}
            </h2>

            {/* Dominant sentiment badge */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  dominantSentiment === "positive"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : dominantSentiment === "negative"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-[#c9a84c]/30 bg-[#c9a84c]/10 text-[#c9a84c]"
                }`}
              >
                <Activity className="w-3 h-3" />
                {dominantSentiment.charAt(0).toUpperCase() +
                  dominantSentiment.slice(1)}{" "}
                · {verdictScore}%
              </span>
            </div>

            {/* Stats row — always show all fields, "Not Available" for missing data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Type — Movie or TV Series */}
              <CinemaStatPill
                label="Type"
                value={meta.mediaType && meta.mediaType !== "N/A" ? meta.mediaType : "Movie"}
                icon={<Clapperboard className="w-3.5 h-3.5 text-[#c9a84c]" />}
                accent="border-[#c9a84c]/20 bg-[#c9a84c]/5"
                unavailable={false}
              />
              <CinemaStatPill
                label="Release Year"
                value={meta.year && meta.year !== "N/A" ? meta.year : "Not Available"}
                icon={<Calendar className="w-3.5 h-3.5 text-blue-400" />}
                accent="border-blue-500/20 bg-blue-500/5"
                unavailable={!meta.year || meta.year === "N/A"}
              />
              <CinemaStatPill
                label="IMDb Rating"
                value={meta.imdbRating && meta.imdbRating !== "N/A" ? `⭐ ${meta.imdbRating}/10` : "Not Available"}
                icon={<Star className="w-3.5 h-3.5 text-amber-400" />}
                accent="border-amber-500/20 bg-amber-500/5"
                unavailable={!meta.imdbRating || meta.imdbRating === "N/A"}
              />
              <CinemaStatPill
                label="Genre"
                value={meta.genre && meta.genre !== "N/A" ? meta.genre.split(",")[0].trim() : "Not Available"}
                icon={<Tag className="w-3.5 h-3.5 text-[#c9a84c]" />}
                accent="border-[#c9a84c]/20 bg-[#c9a84c]/5"
                unavailable={!meta.genre || meta.genre === "N/A"}
              />
              <CinemaStatPill
                label="Runtime"
                value={meta.runtime && meta.runtime !== "N/A" ? meta.runtime : "Not Available"}
                icon={<Clock className="w-3.5 h-3.5 text-purple-400" />}
                accent="border-purple-500/20 bg-purple-500/5"
                unavailable={!meta.runtime || meta.runtime === "N/A"}
              />
              <CinemaStatPill
                label="Budget"
                value={meta.budget && meta.budget !== "N/A" ? meta.budget : "Not Available"}
                icon={<DollarSign className="w-3.5 h-3.5 text-[#c9a84c]" />}
                accent="border-[#c9a84c]/20 bg-[#c9a84c]/5"
                unavailable={!meta.budget || meta.budget === "N/A"}
              />
              <CinemaStatPill
                label="Box Office"
                value={meta.boxOffice && meta.boxOffice !== "N/A" ? meta.boxOffice : "Not Available"}
                icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                accent="border-emerald-500/20 bg-emerald-500/5"
                unavailable={!meta.boxOffice || meta.boxOffice === "N/A"}
              />
              {/* Series-only: Total Seasons + Status; Movie: Total Parts */}
              {isSeries ? (
                <>
                  <CinemaStatPill
                    label="Total Seasons"
                    value={meta.totalSeasons && meta.totalSeasons !== "N/A" ? `${meta.totalSeasons} Season${parseInt(meta.totalSeasons) > 1 ? "s" : ""}` : "Not Available"}
                    icon={<Film className="w-3.5 h-3.5 text-[#c9a84c]" />}
                    accent="border-[#c9a84c]/20 bg-[#c9a84c]/5"
                    unavailable={!meta.totalSeasons || meta.totalSeasons === "N/A"}
                  />
                  <CinemaStatPill
                    label="Status"
                    value={meta.seriesStatus && meta.seriesStatus !== "N/A" ? meta.seriesStatus : "Not Available"}
                    icon={<Activity className="w-3.5 h-3.5 text-emerald-400" />}
                    accent={
                      meta.seriesStatus === "Running"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-[#c9a84c]/20 bg-[#c9a84c]/5"
                    }
                    unavailable={!meta.seriesStatus || meta.seriesStatus === "N/A"}
                  />
                </>
              ) : (
                <CinemaStatPill
                  label="Total Parts"
                  value={meta.seriesCount && meta.seriesCount !== "N/A" ? meta.seriesCount : "Not Available"}
                  icon={<Film className="w-3.5 h-3.5 text-[#c9a84c]" />}
                  accent="border-[#c9a84c]/20 bg-[#c9a84c]/5"
                  unavailable={!meta.seriesCount || meta.seriesCount === "N/A"}
                />
              )}
              <CinemaStatPill
                label="Reviews Analysed"
                value={`${total} reviews`}
                icon={<Activity className="w-3.5 h-3.5 text-[#8b1a1a]" />}
                accent="border-[#8b1a1a]/30 bg-[#8b1a1a]/10"
                unavailable={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gold gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, #c9a84c40, transparent)",
        }}
      />
    </motion.div>
  );
}

// ── AI Movie Overview (Google AI Overview style) ───────────────────────

interface MovieAIOverviewProps {
  topic: string;
  aiSummary: string;
  pros: string[];
  cons: string[];
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  total: number;
  dominantSentiment: string;
}

// ── AI Overview structured response type ──────────────────────────────
interface MovieOverviewData {
  overview: string;         // full 4–6 sentence paragraph
  worthWatching: string;    // direct one-line recommendation
  whoShouldWatch: string;   // who should watch
  isUpcoming: boolean;
  previousParts: string[];
  upcomingNote?: string;
  // Legacy fields kept for fallback compatibility
  recommendation?: string;
  story?: string;
  acting?: string;
  direction?: string;
  visuals?: string;
  music?: string;
  pacing?: string;
  audienceOpinion?: string;
  criticsOpinion?: string;
  finalVerdict?: string;
}

function MovieAIOverview({
  topic,
  aiSummary,
  pros,
  cons,
  positiveCount,
  negativeCount,
  neutralCount,
  total,
  dominantSentiment,
}: MovieAIOverviewProps) {
  const [overview, setOverview] = useState<MovieOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const posPct = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
    const negPct = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
    const neuPct = total > 0 ? Math.round((neutralCount  / total) * 100) : 0;

    const praised = pros.slice(0, 3).join(", ") || "";
    const criticised = cons.slice(0, 2).join(", ") || "";
    const prompt = `Write a 4–5 sentence human overview of "${topic}" that reads like a recommendation from a knowledgeable friend — not an analytics report, not a review score summary.

Context clues (use only what's relevant, never cite numbers or percentages):
- What audiences loved: ${praised || "not specified"}
- What audiences disliked: ${criticised || "not specified"}
- Background/plot: ${aiSummary || "use your own knowledge"}

Cover naturally in ONE flowing paragraph:
1. What it's about and what kind of experience it is
2. Why people enjoy it (tone, standout elements)
3. Any notable weakness, briefly
4. Who should watch it
5. A direct "worth watching" verdict

RULES: No bullet points. No numbers or review counts. No "X% of reviewers". No analytics language. Write like you're texting a friend. Address the reader as "you".
If it's a sequel, briefly mention the series. If unreleased, say so warmly.

Return ONLY valid JSON (no markdown, no backticks):
{"overview":"full 4–5 sentence paragraph","worthWatching":"one direct verdict line","whoShouldWatch":"one line","isUpcoming":false,"previousParts":[],"upcomingNote":""}`;

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const text = (data.content || []).map((b: any) => b.text || "").join("").trim();
        try {
          const clean = text.replace(/```json|```/g, "").trim();
          setOverview(JSON.parse(clean));
        } catch {
          // Fallback: treat raw text as the overview paragraph
          setOverview({
            overview: text || aiSummary || "",
            worthWatching: "", whoShouldWatch: "",
            isUpcoming: false, previousParts: [], upcomingNote: "",
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setOverview(aiSummary ? {
          overview: aiSummary,
          worthWatching: "", whoShouldWatch: "",
          isUpcoming: false, previousParts: [], upcomingNote: "",
        } : null);
        setError("Could not generate AI overview.");
        setLoading(false);
      });
  }, [topic, aiSummary, pros, cons, positiveCount, negativeCount, neutralCount, total, dominantSentiment]);

  if (!loading && !overview && !error) return null;

  // No legacy section grid needed — overview is now a single paragraph

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden border"
      style={{
        borderColor: "#c9a84c30",
        background: "linear-gradient(135deg, #1a0a0a 0%, #1c1008 100%)",
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Gold top rule */}
      <div className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c60, transparent)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ background: "linear-gradient(135deg, #8b1a1a20, #c9a84c20)" }}>
            <Sparkles className="w-3.5 h-3.5 text-[#c9a84c]" />
          </div>
          <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">
            AI Movie Overview
          </span>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
            style={{ borderColor: "#8b1a1a40", color: "#c9a84c80", background: "#8b1a1a10" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#c9a84c" }} />
            Live Analysis
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#c9a84c]/60" />
            <span className="text-sm text-[#f5e6c0]/40">Writing your movie overview…</span>
          </div>
        ) : overview ? (
          <div className="space-y-4">

            {/* Upcoming badge + previous parts */}
            {overview.isUpcoming && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                  style={{ borderColor: "#c9a84c40", background: "#c9a84c12", color: "#c9a84c" }}>
                  <Calendar className="w-3 h-3" />
                  Upcoming Release
                </span>
                {overview.previousParts && overview.previousParts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#f5e6c0]/40 uppercase tracking-widest">Previous:</span>
                    {overview.previousParts.map((part, i) => (
                      <a
                        key={i}
                        href={`https://www.google.com/search?q=${encodeURIComponent(part + " movie")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all duration-150 hover:opacity-80 active:scale-95"
                        style={{ borderColor: "#8b1a1a50", background: "#8b1a1a20", color: "#f5e6c0aa" }}
                      >
                        <Film className="w-2.5 h-2.5" />
                        {part}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {overview.isUpcoming && overview.upcomingNote && (
              <div className="px-4 py-3 rounded-xl border text-sm italic"
                style={{ borderColor: "#c9a84c20", background: "#c9a84c08", color: "#f5e6c0aa" }}>
                🎬 {overview.upcomingNote}
              </div>
            )}

            {/* Main conversational paragraph */}
            {(overview.overview || overview.recommendation) && (
              <div className="px-4 py-4 rounded-xl border"
                style={{ borderColor: "#c9a84c20", background: "#c9a84c06" }}>
                <p className="text-sm leading-relaxed" style={{ color: "#f5e6c0dd", lineHeight: "1.75" }}>
                  {overview.overview || overview.recommendation}
                </p>
              </div>
            )}

            {/* Worth Watching + Who Should Watch — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {overview.worthWatching && (
                <div className="flex gap-3 p-4 rounded-xl border items-start"
                  style={{ borderColor: "#4ade8025", background: "#4ade8008" }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-semibold mb-1">Worth Watching?</p>
                    <p className="text-sm font-semibold" style={{ color: "#4ade80cc" }}>{overview.worthWatching}</p>
                  </div>
                </div>
              )}
              {overview.whoShouldWatch && (
                <div className="flex gap-3 p-4 rounded-xl border items-start"
                  style={{ borderColor: "#c9a84c25", background: "#c9a84c08" }}>
                  <Users className="w-4 h-4 text-[#c9a84c] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#c9a84c]/60 font-semibold mb-1">Who Should Watch</p>
                    <p className="text-sm font-medium" style={{ color: "#f5e6c0cc" }}>{overview.whoShouldWatch}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : error ? (
          <p className="text-sm py-2" style={{ color: "#f5e6c0/40" }}>{aiSummary || error}</p>
        ) : null}
      </div>
    </motion.div>
  );
}

// ── Movie Insights Panel ───────────────────────────────────────────────

interface MovieInsight {
  audienceOpinion: string;
  criticsOpinion: string;
  bestPerformances: string;
  weakPoints: string;
  storyScreenplay: string;
  musicBgm: string;
  direction: string;
  recommendation: string;
  familyFriendly: boolean | null;
  worthWatching: boolean | null;
}

function InsightRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex gap-3 p-3.5 rounded-xl border"
      style={{ borderColor: "#c9a84c15", background: "#c9a84c05" }}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[#c9a84c]/60 font-semibold mb-1">
          {label}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "#f5e6c0cc" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function VerdictBadge({
  label,
  value,
  icon,
}: {
  label: string;
  value: boolean | null;
  icon: React.ReactNode;
}) {
  const isYes = value === true;
  const isNo = value === false;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{
        borderColor: isYes ? "#4ade8030" : isNo ? "#f8717130" : "#c9a84c20",
        background: isYes ? "#4ade8008" : isNo ? "#f8717108" : "#c9a84c08",
      }}
    >
      {icon}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#c9a84c]/60 font-semibold leading-none mb-1">
          {label}
        </p>
        <p
          className="text-sm font-bold"
          style={{
            color: isYes ? "#4ade80" : isNo ? "#f87171" : "#c9a84c",
          }}
        >
          {value === null ? "Varies" : value ? "Yes" : "No"}
        </p>
      </div>
    </div>
  );
}

function MovieInsightsPanel({
  topic,
  aiSummary,
  pros,
  cons,
  positiveCount,
  negativeCount,
  neutralCount,
  total,
  dominantSentiment,
}: MovieAIOverviewProps) {
  const [insights, setInsights] = useState<MovieInsight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (total === 0) return;
    setLoading(true);

    const posPct = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
    const negPct = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
    const neuPct = total > 0 ? Math.round((neutralCount / total) * 100) : 0;

    const prompt = `You are a film critic AI. Based on the review data below for "${topic}", generate a structured JSON response with these exact keys. Keep each field to 1–2 concise sentences.

Review data:
- Positive: ${positiveCount} (${posPct}%), Negative: ${negativeCount} (${negPct}%), Neutral: ${neutralCount} (${neuPct}%)
- Overall: ${dominantSentiment}
- Summary: ${aiSummary}
- Loved: ${pros.join(", ") || "not specified"}
- Disliked: ${cons.join(", ") || "not specified"}

Return ONLY valid JSON (no markdown, no backticks):
{
  "audienceOpinion": "...",
  "criticsOpinion": "...",
  "bestPerformances": "...",
  "weakPoints": "...",
  "storyScreenplay": "...",
  "musicBgm": "...",
  "direction": "...",
  "recommendation": "...",
  "familyFriendly": true or false or null,
  "worthWatching": true or false or null
}`;

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const text = (data.content || []).map((b: any) => b.text || "").join("").trim();
        try {
          const clean = text.replace(/```json|```/g, "").trim();
          setInsights(JSON.parse(clean));
        } catch {
          // Silently ignore parse errors
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [topic, aiSummary, pros, cons, positiveCount, negativeCount, neutralCount, total, dominantSentiment]);

  if (!loading && !insights) return null;

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden border"
      style={{ borderColor: "#c9a84c25", background: "linear-gradient(135deg, #1a0a0a, #1c1008)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18 }}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, #c9a84c50, transparent)" }} />

      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ background: "linear-gradient(135deg, #8b1a1a20, #c9a84c20)" }}>
            <Film className="w-3.5 h-3.5 text-[#c9a84c]" />
          </div>
          <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">
            Movie Insights
          </span>
        </div>

        {loading || !insights ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-[#c9a84c]/60" />
            <span className="text-sm text-[#f5e6c0]/40">Generating insights…</span>
          </div>
        ) : (
          <>
            {/* Verdict badges */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <VerdictBadge
                label="Family Friendly"
                value={insights.familyFriendly}
                icon={<Baby className="w-4 h-4 text-[#c9a84c]/70" />}
              />
              <VerdictBadge
                label="Worth Watching"
                value={insights.worthWatching}
                icon={<Eye className="w-4 h-4 text-[#c9a84c]/70" />}
              />
            </div>

            {/* Insight rows */}
            <div className="space-y-2">
              <InsightRow
                icon={<Users className="w-4 h-4 text-emerald-400/70" />}
                label="Audience Opinion"
                value={insights.audienceOpinion}
              />
              <InsightRow
                icon={<Award className="w-4 h-4 text-amber-400/70" />}
                label="Critics Opinion"
                value={insights.criticsOpinion}
              />
              <InsightRow
                icon={<Star className="w-4 h-4 text-amber-400/70" />}
                label="Best Performances"
                value={insights.bestPerformances}
              />
              <InsightRow
                icon={<AlertCircle className="w-4 h-4 text-red-400/70" />}
                label="Weak Points"
                value={insights.weakPoints}
              />
              <InsightRow
                icon={<BookOpen className="w-4 h-4 text-[#c9a84c]/70" />}
                label="Story & Screenplay"
                value={insights.storyScreenplay}
              />
              <InsightRow
                icon={<Music className="w-4 h-4 text-purple-400/70" />}
                label="Music & BGM"
                value={insights.musicBgm}
              />
              <InsightRow
                icon={<Video className="w-4 h-4 text-blue-400/70" />}
                label="Direction"
                value={insights.direction}
              />
              <InsightRow
                icon={<MessageSquare className="w-4 h-4 text-[#c9a84c]/70" />}
                label="Recommendation"
                value={insights.recommendation}
              />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Four stat cards ────────────────────────────────────────────────────

function MovieStatCards({
  positiveCount,
  negativeCount,
  neutralCount,
  total,
  liveSentimentData,
}: {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  total: number;
  liveSentimentData: { positive: number; negative: number; neutral: number };
}) {
  // Compute percentages directly from actual counts (dynamic, per-movie)
  const posPct  = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
  const negPct  = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
  const neuPct  = total > 0 ? Math.round((neutralCount  / total) * 100) : 0;

  // Cinematic dark-theme palette for each card
  const cards = [
    {
      label: "Positive",
      value: positiveCount,
      pct: posPct,
      icon: <ThumbsUp className="w-5 h-5" style={{ color: "#4ade80" }} />,
      borderColor: "#166534",
      bgColor: "linear-gradient(135deg, #052e16 0%, #0a3d1f 100%)",
      valueColor: "#4ade80",
      pctColor: "#16a34a99",
      subLabel: "positive",
    },
    {
      label: "Negative",
      value: negativeCount,
      pct: negPct,
      icon: <ThumbsDown className="w-5 h-5" style={{ color: "#f87171" }} />,
      borderColor: "#7f1d1d",
      bgColor: "linear-gradient(135deg, #2d0a0a 0%, #450f0f 100%)",
      valueColor: "#f87171",
      pctColor: "#dc262699",
      subLabel: "negative",
    },
    {
      label: "Neutral",
      value: neutralCount,
      pct: neuPct,
      icon: <Minus className="w-5 h-5" style={{ color: "#a8a29e" }} />,
      borderColor: "#44403c",
      bgColor: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
      valueColor: "#a8a29e",
      pctColor: "#78716c99",
      subLabel: "neutral",
    },
    {
      label: "Total Analysed",
      value: total,
      pct: null,
      icon: <Activity className="w-5 h-5" style={{ color: "#c9a84c" }} />,
      borderColor: "#78350f",
      bgColor: "linear-gradient(135deg, #1c0f03 0%, #2d1a06 100%)",
      valueColor: "#c9a84c",
      pctColor: "#92400e99",
      subLabel: "reviews",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, pct, icon, borderColor, bgColor, valueColor, pctColor, subLabel }, idx) => (
        <motion.div
          key={label}
          className="rounded-2xl border p-4 flex flex-col items-center gap-2 backdrop-blur-sm"
          style={{ borderColor, background: bgColor }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 + idx * 0.06 }}
        >
          {icon}
          <p className="text-[11px] uppercase tracking-widest text-[#f5e6c0]/35 font-medium leading-none text-center">
            {label}
          </p>
          <p className="text-3xl font-bold leading-none" style={{ color: valueColor }}>{value}</p>
          <p className="text-xs font-medium" style={{ color: pctColor }}>
            {pct !== null ? `${pct}%` : subLabel}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Headline cards ─────────────────────────────────────────────────────

function CinemaHeadlineCard({
  reviewText,
  headline,
  source,
  confidence,
  url,
  sentiment,
}: {
  reviewText: string;
  headline: string;
  source: string;
  confidence: number;
  url: string;
  sentiment: "positive" | "negative" | "neutral";
}) {
  const accentColor =
    sentiment === "positive"
      ? "#4ade80"
      : sentiment === "negative"
      ? "#f87171"
      : "#c9a84c";

  // Prefer real review text; fall back to headline
  const displayText = reviewText && reviewText.trim().length > 10 ? reviewText : headline;
  // Truncate long review text to ~200 chars for card readability
  const truncated = displayText.length > 200 ? displayText.slice(0, 200).trimEnd() + "…" : displayText;

  const Wrapper = url && url !== "#"
    ? ({ children }: { children: React.ReactNode }) => (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border p-3.5 transition-all duration-200 hover:scale-[1.01]"
          style={{ borderColor: `${accentColor}20`, background: `linear-gradient(135deg, ${accentColor}06, transparent)` }}>
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="rounded-xl border p-3.5" style={{ borderColor: `${accentColor}20`, background: `linear-gradient(135deg, ${accentColor}06, transparent)` }}>
          {children}
        </div>
      );

  return (
    <Wrapper>
      {/* Review snippet */}
      <p className="text-sm leading-snug mb-2 italic" style={{ color: "#f5e6c0cc" }}>
        "{truncated}"
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#f5e6c0]/40 truncate">{source || "Audience"}</span>
        {confidence > 0 && (
          <span
            className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: accentColor, background: `${accentColor}15` }}
          >
            {confidence}% conf
          </span>
        )}
      </div>
    </Wrapper>
  );
}

function CinemaHeadlineGroup({
  title,
  headlines,
  sentiment,
  inferSource,
}: {
  title: string;
  headlines: any[];
  sentiment: "positive" | "negative" | "neutral";
  inferSource: (r: any) => string;
}) {
  if (headlines.length === 0) return null;

  const accentColor =
    sentiment === "positive"
      ? "#4ade80"
      : sentiment === "negative"
      ? "#f87171"
      : "#c9a84c";

  const Icon =
    sentiment === "positive"
      ? ThumbsUp
      : sentiment === "negative"
      ? ThumbsDown
      : Minus;

  return (
    <div
      className="rounded-2xl border p-4 backdrop-blur-sm"
      style={{ borderColor: `${accentColor}20`, background: "#1a0a0a" }}
    >
      <h3
        className="text-sm font-semibold mb-3 flex items-center gap-2"
        style={{ color: accentColor }}
      >
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      <div className="space-y-2">
        {headlines.map((h: any, i: number) => (
          <CinemaHeadlineCard
            key={i}
            reviewText={h._text || h.text || ""}
            headline={h.headline || ""}
            source={inferSource(h)}
            confidence={h.confidence || 0}
            url={h.link || h.url || "#"}
            sentiment={sentiment}
          />
        ))}
      </div>
    </div>
  );
}

// ── Curated movie source homepage map ─────────────────────────────────
const _MOVIE_SOURCE_URLS: Record<string, string> = {
  "IMDb":                   "https://www.imdb.com",
  "Rotten Tomatoes":        "https://www.rottentomatoes.com",
  "Letterboxd":             "https://letterboxd.com",
  "Metacritic":             "https://www.metacritic.com",
  "TMDb":                   "https://www.themoviedb.org",
  "Wikipedia":              "https://www.wikipedia.org",
  "Google Reviews":         "https://www.google.com",
  "RogerEbert.com":         "https://www.rogerebert.com",
  "Empire":                 "https://www.empireonline.com",
  "Variety":                "https://variety.com",
  "The Hollywood Reporter": "https://www.hollywoodreporter.com",
  "IndieWire":              "https://www.indiewire.com",
  "Collider":               "https://collider.com",
  "IGN":                    "https://www.ign.com",
};

function resolveMovieHomepage(name: string, homepageUrl?: string): string {
  if (_MOVIE_SOURCE_URLS[name]) return _MOVIE_SOURCE_URLS[name];
  if (homepageUrl && homepageUrl !== "") return homepageUrl;
  if (name.includes(".")) return `https://${name}`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.${slug}.com`;
}

// ── All movie review platforms catalogue ──────────────────────────────
const ALL_MOVIE_PLATFORMS: {
  name: string;
  homepage: string;
  color: string;
  badge: string;
}[] = [
  { name: "IMDb",                   homepage: "https://www.imdb.com",              color: "#F5C518", badge: "IMDb" },
  { name: "Rotten Tomatoes",        homepage: "https://www.rottentomatoes.com",    color: "#FA320A", badge: "RT" },
  { name: "Metacritic",             homepage: "https://www.metacritic.com",        color: "#FFCC34", badge: "MC" },
  { name: "Letterboxd",             homepage: "https://letterboxd.com",            color: "#00C030", badge: "LB" },
  { name: "TMDb",                   homepage: "https://www.themoviedb.org",        color: "#01B4E4", badge: "TMDb" },
  { name: "Google Reviews",         homepage: "https://www.google.com",            color: "#4285F4", badge: "G" },
  { name: "Wikipedia",              homepage: "https://www.wikipedia.org",         color: "#A7A9AC", badge: "W" },
  { name: "RogerEbert.com",         homepage: "https://www.rogerebert.com",        color: "#E63946", badge: "RE" },
  { name: "Variety",                homepage: "https://variety.com",               color: "#8B1A1A", badge: "Va" },
  { name: "The Hollywood Reporter", homepage: "https://www.hollywoodreporter.com", color: "#D4A017", badge: "THR" },
  { name: "IndieWire",              homepage: "https://www.indiewire.com",         color: "#1A1A2E", badge: "IW" },
  { name: "Collider",               homepage: "https://collider.com",              color: "#E63946", badge: "Co" },
  { name: "Empire",                 homepage: "https://www.empireonline.com",      color: "#C9A84C", badge: "Em" },
  { name: "IGN",                    homepage: "https://www.ign.com",               color: "#E31E25", badge: "IGN" },
];

// ── Sources row ────────────────────────────────────────────────────────

function MovieSourcesRow({
  sources,
}: {
  sources: { name: string; articleCount: number; homepageUrl: string }[];
}) {
  // Build a map of detected source counts
  const detectedMap: Record<string, number> = {};
  (sources || []).forEach((s) => {
    if (s.name && s.name !== "Unknown Source") {
      detectedMap[s.name] = s.articleCount;
    }
  });

  function faviconUrl(homepage: string) {
    try {
      const { hostname } = new URL(homepage);
      return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    } catch { return ""; }
  }

  // Always show all platforms; highlight ones that were actually used
  const platforms = ALL_MOVIE_PLATFORMS.map((p) => ({
    ...p,
    count: detectedMap[p.name] ?? 0,
    used: p.name in detectedMap,
  }));
  // Sort: used platforms first, then the rest
  platforms.sort((a, b) => {
    if (a.used && !b.used) return -1;
    if (!a.used && b.used) return 1;
    return b.count - a.count;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.28 }}
    >
      <h3 className="text-xs uppercase tracking-widest text-[#c9a84c]/60 font-semibold mb-3 flex items-center gap-2">
        <Film className="w-3.5 h-3.5" />
        Review Sources
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {platforms.map((src, idx) => {
          const favicon = faviconUrl(src.homepage);
          return (
            <motion.div
              key={src.name}
              className="flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200"
              style={{
                borderColor: src.used ? `${src.color}40` : "#c9a84c12",
                background: src.used ? `${src.color}08` : "#1a0a0a",
                opacity: src.used ? 1 : 0.55,
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: src.used ? 1 : 0.55, y: 0 }}
              transition={{ duration: 0.25, delay: 0.3 + idx * 0.04 }}
            >
              {/* Logo + count row */}
              <div className="flex items-center justify-between">
                <div
                  className="w-9 h-9 rounded-lg border flex items-center justify-center overflow-hidden shrink-0"
                  style={{ borderColor: src.used ? `${src.color}30` : "#c9a84c15", background: "#0d0505" }}
                >
                  {favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={favicon} alt={src.name} width={22} height={22} className="object-contain"
                      onError={(e) => {
                        const t = e.currentTarget as HTMLImageElement;
                        t.style.display = "none";
                        const p = t.parentElement;
                        if (p) p.innerHTML = `<span style="font-size:9px;font-weight:900;color:${src.color}">${src.badge}</span>`;
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "9px", fontWeight: 900, color: src.color }}>{src.badge}</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold" style={{ color: src.used ? `${src.color}cc` : "#c9a84c40" }}>
                  {src.used ? `${src.count} ${src.count === 1 ? "review" : "reviews"}` : "—"}
                </span>
              </div>

              {/* Name */}
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: src.used ? "#f5e6c0cc" : "#f5e6c055" }}
              >
                {src.name}
              </p>

              {/* Visit button */}
              <a
                href={src.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{
                  borderColor: src.used ? `${src.color}30` : "#c9a84c18",
                  color: src.used ? src.color : "#c9a84c50",
                  background: src.used ? `${src.color}10` : "transparent",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Visit
              </a>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Main MovieSection component ────────────────────────────────────────

export function MovieSection({
  topic,
  apiData,
  positiveCount,
  negativeCount,
  neutralCount,
  total,
  dominantSentiment,
  verdictScore,
  verdictSummary,
  liveSentimentData,
  positiveHeadlines,
  negativeHeadlines,
  neutralHeadlines,
  detectedSources,
  inferSource,
}: MovieSectionProps) {
  // Extract movie metadata from apiData
  const movieInfo = apiData?.movie_info || {};
  // Prefer backend-supplied detected_sources (movie review sources) over prop
  const effectiveSources: { name: string; articleCount: number; homepageUrl: string }[] =
    (apiData?.detected_sources && apiData.detected_sources.length > 0)
      ? apiData.detected_sources
      : detectedSources;
  // Detect series count from topic name (e.g. "Pushpa 2" → 2 parts so far)
  const detectedSeriesCount = (() => {
    const t = (apiData?.topic || "").toLowerCase();
    const match = t.match(/\b(\d+)\b/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 2 && n <= 20) return `${n} Parts`;
    }
    return "";
  })();

  const meta: MovieMeta = {
    poster:        movieInfo.poster         || apiData?.poster         || "",
    year:          movieInfo.year           || apiData?.year           || "",
    imdbRating:    movieInfo.imdb_rating    || apiData?.imdb_rating    || "",
    rtScore:       movieInfo.rt_score       || apiData?.rt_score       || "",
    budget:        movieInfo.budget         || apiData?.budget         || "",
    boxOffice:     movieInfo.box_office     || apiData?.box_office     || "",
    releaseDate:   movieInfo.release_date   || apiData?.release_date   || "",
    runtime:       movieInfo.runtime        || apiData?.runtime        || "",
    genre:         movieInfo.genre          || apiData?.genre          || "",
    seriesCount:   movieInfo.series_count   || apiData?.series_count   || detectedSeriesCount,
    mediaType:     movieInfo.media_type     || apiData?.media_type     || "",
    totalSeasons:  movieInfo.total_seasons  || apiData?.total_seasons  || "",
    seriesStatus:  movieInfo.series_status  || apiData?.series_status  || "",
  };

  const isSeries = meta.mediaType === "TV Series" || meta.mediaType === "TV Mini-Series";

  return (
    <div
      className="space-y-5 mb-8 rounded-3xl p-4 md:p-6"
      style={{
        background: "linear-gradient(160deg, #120606 0%, #1a0a0a 40%, #160b04 70%, #0f0a02 100%)",
        border: "1px solid #c9a84c18",
        boxShadow: "0 0 80px rgba(139,26,26,0.08), 0 0 40px rgba(201,168,76,0.04)",
      }}
    >
      {/* Subtle grain overlay for the whole dashboard */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />
      {/* 1 — Movie Hero (poster + title + metadata) */}
      <MovieHero
        topic={topic}
        meta={meta}
        dominantSentiment={dominantSentiment}
        verdictScore={verdictScore}
        total={total}
        isSeries={isSeries}
      />

      {/* 2 — Four sentiment stat cards (ABOVE AI overview, cinematic palette) */}
      <MovieStatCards
        positiveCount={positiveCount}
        negativeCount={negativeCount}
        neutralCount={neutralCount}
        total={total}
        liveSentimentData={liveSentimentData}
      />

      {/* 3 — AI Movie Overview */}
      <MovieAIOverview
        topic={topic}
        aiSummary={verdictSummary}
        pros={apiData?.pros || []}
        cons={apiData?.cons || []}
        positiveCount={positiveCount}
        negativeCount={negativeCount}
        neutralCount={neutralCount}
        total={total}
        dominantSentiment={dominantSentiment}
      />

      {/* 4 — Movie Insights */}
      <MovieInsightsPanel
        topic={topic}
        aiSummary={verdictSummary}
        pros={apiData?.pros || []}
        cons={apiData?.cons || []}
        positiveCount={positiveCount}
        negativeCount={negativeCount}
        neutralCount={neutralCount}
        total={total}
        dominantSentiment={dominantSentiment}
      />

      {/* 5 — Reviews (by sentiment) */}
      {(positiveHeadlines.length > 0 ||
        negativeHeadlines.length > 0 ||
        neutralHeadlines.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.22 }}
        >
          <h3 className="text-xs uppercase tracking-widest text-[#c9a84c]/60 font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Audience Reviews
          </h3>
          <div
            className={`grid gap-4 ${
              [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(
                (a) => a.length > 0
              ).length === 1
                ? "grid-cols-1 max-w-xl"
                : [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(
                    (a) => a.length > 0
                  ).length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-3"
            }`}
          >
            {positiveHeadlines.length > 0 && (
              <CinemaHeadlineGroup
                title="Positive Reviews"
                headlines={positiveHeadlines}
                sentiment="positive"
                inferSource={inferSource}
              />
            )}
            {negativeHeadlines.length > 0 && (
              <CinemaHeadlineGroup
                title="Negative Reviews"
                headlines={negativeHeadlines}
                sentiment="negative"
                inferSource={inferSource}
              />
            )}
            {neutralHeadlines.length > 0 && (
              <CinemaHeadlineGroup
                title="Neutral Reviews"
                headlines={neutralHeadlines}
                sentiment="neutral"
                inferSource={inferSource}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* 5 — Sources */}
      <MovieSourcesRow sources={effectiveSources} />
    </div>
  );
}
