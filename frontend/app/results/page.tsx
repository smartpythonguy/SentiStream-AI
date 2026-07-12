"use client";

import { useEffect } from "react";
import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DashboardNavbar } from "@/components/dashboard-navbar";
import { FloatingOrbs } from "@/components/floating-orbs";
import { SentimentPieChart } from "@/components/sentiment-pie-chart";
import { VerdictCard } from "@/components/verdict-card";
import { SentimentSection } from "@/components/sentiment-section";
import { HeadlineCard } from "@/components/headline-card";
import { ResourcesSection } from "@/components/resources-section";
import { MovieSection } from "@/components/movie-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  Share2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Check,
  Copy,
  Loader2,
  Newspaper,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  AlertTriangle,
  Building2,
  Sparkles,
  Clapperboard,
  Star,
  MessageSquare,
  Users,
  MapPin,
  Calendar,
  Briefcase,
  UserCheck,
  UserX,
  DollarSign,
  ExternalLink,
  Globe,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  UtensilsCrossed,
  ChefHat,
  Flame,
  Clock,
  Utensils,
  BadgeCheck,
  Coffee,
} from "lucide-react";

// ─────────────────────────────────────────────
// Aggregator hostnames — never shown as source
// ─────────────────────────────────────────────
const BLOCKED_HOSTNAMES = new Set([
  "news.google.com",
  "google.com",
  "google.co.uk",
  "amp.google.com",
  "feedburner.com",
  "feed.feedburner.com",
]);

const KNOWN_SOURCES: Record<string, string> = {
  "cnn.com":            "CNN",
  "bbc.co.uk":          "BBC",
  "bbc.com":            "BBC",
  "reuters.com":        "Reuters",
  "aljazeera.com":      "Al Jazeera",
  "theguardian.com":    "The Guardian",
  "nytimes.com":        "New York Times",
  "washingtonpost.com": "Washington Post",
  "apnews.com":         "AP News",
  "bloomberg.com":      "Bloomberg",
  "foxnews.com":        "Fox News",
  "nbcnews.com":        "NBC News",
  "abcnews.go.com":     "ABC News",
  "politico.com":       "Politico",
  "axios.com":          "Axios",
  "theverge.com":       "The Verge",
  "ft.com":             "Financial Times",
  "wsj.com":            "Wall Street Journal",
  "cnbc.com":           "CNBC",
  "npr.org":            "NPR",
  "techcrunch.com":     "TechCrunch",
  "wired.com":          "Wired",
  "fortune.com":        "Fortune",
  "businessinsider.com":"Business Insider",
  "forbes.com":         "Forbes",
};

function inferSource(r: any): string {
  if (r.source && r.source !== "Unknown Source" && r.source.trim() !== "") {
    const src = r.source.trim();
    if (src.toLowerCase().includes("google")) return "";
    return src;
  }
  const url: string = r.link || r.url || "";
  if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      if (BLOCKED_HOSTNAMES.has(hostname)) return "";
      for (const [key, label] of Object.entries(KNOWN_SOURCES)) {
        if (url.includes(key)) return label;
      }
      if (hostname) return hostname;
    } catch { /* ignore */ }
  }
  return "";
}

// ─────────────────────────────────────────────
// Narrative helper
// ─────────────────────────────────────────────
function getNarrative(
  apiData: any,
  sentiment: "positive" | "negative" | "neutral",
  headlines: any[]
): string {
  const backendNarrative: string | undefined = apiData?.news_narratives?.[sentiment];
  if (backendNarrative && backendNarrative.trim().length > 0) return backendNarrative;
  if (!headlines.length) return "No significant coverage found.";
  const texts: string[] = headlines.map((h: any) => h.headline).filter(Boolean);
  const n = texts.length;
  const label = sentiment === "positive" ? "positive" : sentiment === "negative" ? "critical" : "neutral";
  const first = texts[0].length > 90 ? texts[0].slice(0, 90) + "…" : texts[0];
  const tail = n > 1 ? ` Also: ${texts.slice(1, 3).map(t => t.length > 60 ? t.slice(0, 60) + "…" : t).join("; ")}.` : "";
  return `${n} ${label} headline${n > 1 ? "s" : ""} found. ${first}.${tail}`;
}

// ─────────────────────────────────────────────
// Coverage trend bar
// ─────────────────────────────────────────────
function CoverageTrend({ positiveCount, negativeCount, neutralCount, total }: {
  positiveCount: number; negativeCount: number; neutralCount: number; total: number;
}) {
  if (total === 0) return null;
  const bars = [
    { label: "Positive", count: positiveCount, color: "bg-green-500", textColor: "text-green-500" },
    { label: "Negative", count: negativeCount, color: "bg-red-500",   textColor: "text-red-500" },
    { label: "Neutral",  count: neutralCount,  color: "bg-slate-400", textColor: "text-slate-400" },
  ];
  const maxCount = Math.max(positiveCount, negativeCount, neutralCount, 1);
  return (
    <motion.div
      className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 mt-6"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
    >
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        Coverage Trend
      </h3>
      <div className="space-y-3">
        {bars.map(({ label, count, color, textColor }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`text-xs font-medium w-16 shrink-0 ${textColor}`}>{label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${color}`}
                initial={{ width: "0%" }}
                animate={{ width: `${(count / maxCount) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Headline group
// ─────────────────────────────────────────────
interface HeadlineGroupProps {
  icon: React.ReactNode;
  title: string;
  emptyLabel: string;
  headlines: any[];
  sentiment: "positive" | "negative" | "neutral";
}

function HeadlineGroup({ icon, title, emptyLabel, headlines, sentiment }: HeadlineGroupProps) {
  if (headlines.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 flex flex-col items-center justify-center min-h-[120px]">
        <div className="opacity-30 mb-2">{icon}</div>
        <p className="text-sm text-muted-foreground text-center">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">{icon}{title}</h3>
      <div className="space-y-3">
        {headlines.map((headline: any, index: number) => (
          <HeadlineCard
            key={index}
            title={headline.headline}
            source={inferSource(headline)}
            date={headline.confidence ? `${headline.confidence}% confidence` : ""}
            url={headline.link || headline.url || "#"}
            sentiment={sentiment}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Companies-specific driver panel
// ─────────────────────────────────────────────
function CompaniesDriverPanel({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Positive Drivers */}
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Positive Drivers
        </h3>
        <div className="space-y-2">
          {pros.length > 0 ? (
            pros.map((driver: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <ThumbsUp className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm text-foreground leading-snug">{driver}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No positive drivers found.</p>
          )}
        </div>
      </div>

      {/* Negative Drivers */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-500" />
          Negative Drivers
        </h3>
        <div className="space-y-2">
          {cons.length > 0 ? (
            cons.map((driver: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <ThumbsDown className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <span className="text-sm text-foreground leading-snug">{driver}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No negative drivers found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Companies AI Summary panel
// ─────────────────────────────────────────────
function CompaniesAISummary({ topic, summary }: { topic: string; summary: string }) {
  if (!summary) return null;
  return (
    <motion.div
      className="rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-6"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
    >
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        AI Summary — {topic}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Restaurant AI Overview (Google Maps style)
// ─────────────────────────────────────────────
interface RestaurantAIOverviewProps {
  topic: string;
  aiSummary: string;
  pros: string[];
  cons: string[];
  popularDishes: string[];
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  total: number;
  dominantSentiment: string;
}

function RestaurantAIOverview({
  topic, aiSummary, pros, cons, popularDishes,
  positiveCount, negativeCount, neutralCount, total, dominantSentiment,
}: RestaurantAIOverviewProps) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aiSummary && total === 0) return;
    setLoading(true);
    setError(null);

    const posPct = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
    const negPct = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
    const neuPct = total > 0 ? Math.round((neutralCount  / total) * 100) : 0;

    const prompt = `You are a restaurant intelligence system. Based ONLY on customer review data below, generate a structured JSON overview for "${topic}".

Customer review data:
- Total reviews: ${total}
- Positive: ${positiveCount} (${posPct}%)
- Negative: ${negativeCount} (${negPct}%)
- Neutral: ${neutralCount} (${neuPct}%)
- Summary from ABOM analysis: ${aiSummary}
- Top praises (aspects): ${pros.join(", ") || "none detected"}
- Top complaints (aspects): ${cons.join(", ") || "none detected"}
- Popular dishes mentioned: ${popularDishes.join(", ") || "none detected"}

Return ONLY a valid JSON object (no markdown, no backticks) with exactly these keys:
{
  "overall_satisfaction": "1-2 sentences about overall customer satisfaction based on review ratios",
  "food_quality": "1-2 sentences about food quality based on review data",
  "taste": "1-2 sentences about taste based on review data",
  "service": "1-2 sentences about service based on review data",
  "pricing": "1-2 sentences about pricing based on review data",
  "ambience": "1-2 sentences about ambience based on review data",
  "waiting_time": "1-2 sentences about waiting time based on review data",
  "value_for_money": "1-2 sentences about value for money based on review data",
  "best_dishes": "List the specific popular dishes if known, otherwise say which types are praised",
  "who_should_visit": "1-2 sentences about the ideal visitor profile",
  "final_recommendation": "2-3 sentences final verdict for potential visitors"
}

CRITICAL RULES:
- Never mention news, articles, headlines, or reports
- Only speak from a customer/diner perspective
- Ground every insight in the actual review data provided
- If data for a specific aspect is insufficient, say so honestly
- Keep each field concise and factual`;

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const raw = (data.content || []).map((b: any) => b.text || "").join("");
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        setOverview(parsed);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not generate AI overview.");
        setLoading(false);
      });
  }, [topic, aiSummary, pros, cons, popularDishes, positiveCount, negativeCount, neutralCount, total]);

  const sentimentColor =
    dominantSentiment === "positive" ? "text-green-500 bg-green-500/10 border-green-500/30"
    : dominantSentiment === "negative" ? "text-red-500 bg-red-500/10 border-red-500/30"
    : "text-slate-400 bg-slate-400/10 border-slate-400/30";

  const overviewItems: { key: keyof typeof overview; label: string; icon: React.ReactNode }[] = [
    { key: "overall_satisfaction", label: "Overall Customer Satisfaction", icon: <Star className="w-4 h-4 text-orange-400" /> },
    { key: "food_quality",         label: "Food Quality",                  icon: <ChefHat className="w-4 h-4 text-orange-400" /> },
    { key: "taste",                label: "Taste",                         icon: <Utensils className="w-4 h-4 text-orange-400" /> },
    { key: "service",              label: "Service",                       icon: <UserCheck className="w-4 h-4 text-orange-400" /> },
    { key: "pricing",              label: "Pricing",                       icon: <DollarSign className="w-4 h-4 text-orange-400" /> },
    { key: "ambience",             label: "Ambience",                      icon: <Coffee className="w-4 h-4 text-orange-400" /> },
    { key: "waiting_time",         label: "Waiting Time",                  icon: <Clock className="w-4 h-4 text-orange-400" /> },
    { key: "value_for_money",      label: "Value for Money",               icon: <BadgeCheck className="w-4 h-4 text-orange-400" /> },
    { key: "best_dishes",          label: "Best Dishes",                   icon: <Flame className="w-4 h-4 text-orange-400" /> },
    { key: "who_should_visit",     label: "Who Should Visit",              icon: <Users className="w-4 h-4 text-orange-400" /> },
    { key: "final_recommendation", label: "Final Recommendation",          icon: <MapPin className="w-4 h-4 text-orange-400" /> },
  ];

  return (
    <motion.div
      className="rounded-2xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-sm p-6"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold text-foreground">AI Overview</h2>
          <span className="text-sm text-muted-foreground">— {topic}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${sentimentColor}`}>
            <Activity className="w-3 h-3" />
            {dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1)} · {total > 0 ? Math.round((
              dominantSentiment === "positive" ? positiveCount
              : dominantSentiment === "negative" ? negativeCount
              : neutralCount
            ) / total * 100) : 0}%
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <Zap className="w-3 h-3" />
            AI Generated
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          <span className="text-sm text-muted-foreground">Generating AI overview from customer reviews…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          {error}
          {/* Fallback: show raw aiSummary */}
          {aiSummary && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>}
        </div>
      ) : overview ? (
        <div className="space-y-3">
          {/* Top 3 rows always full-width */}
          {overviewItems.slice(0, 1).map(({ key, label, icon }) => {
            const val = overview[key as string];
            if (!val) return null;
            return (
              <div key={key} className="flex gap-2.5 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-sm text-foreground leading-snug">{val}</p>
                </div>
              </div>
            );
          })}
          {/* Middle 8 items in a 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {overviewItems.slice(1, 9).map(({ key, label, icon }) => {
              const val = overview[key as string];
              if (!val) return null;
              return (
                <div key={key} className="flex gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-xs text-foreground leading-snug line-clamp-2">{val}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Final Recommendation — full width, slightly highlighted */}
          {overviewItems.slice(9).map(({ key, label, icon }) => {
            const val = overview[key as string];
            if (!val) return null;
            const isFinal = key === "final_recommendation";
            return (
              <div key={key} className={`flex gap-2.5 p-3 rounded-xl border ${isFinal ? "bg-orange-500/8 border-orange-500/20" : "bg-muted/20 border-border/30"}`}>
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className={`text-sm text-foreground leading-snug ${isFinal ? "font-medium" : ""}`}>{val}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback if API not available yet — show plain summary */
        aiSummary ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No review data available to generate an overview.</p>
        )
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Restaurant review platform sources
// ─────────────────────────────────────────────

/** Platform metadata — logos, colours, and known homepage URLs. */
const REVIEW_PLATFORMS: Record<string, {
  displayName: string;
  color: string;          // Tailwind border/bg accent colour
  textColor: string;      // Tailwind text colour for the badge
  homepage: string;       // fallback URL if the API doesn't supply one
  logo: React.ReactNode;  // inline SVG / emoji logo
}> = {
  // Match values that the backend restaurant_fetcher sets as review["source"]
  google: {
    displayName: "Google Reviews",
    color:       "border-blue-500/30 bg-blue-500/5",
    textColor:   "text-blue-500",
    homepage:    "https://maps.google.com",
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  justdial: {
    displayName: "JustDial",
    color:       "border-orange-500/30 bg-orange-500/5",
    textColor:   "text-orange-500",
    homepage:    "https://www.justdial.com",
    logo: (
      <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">JD</span>
      </div>
    ),
  },
  tripadvisor: {
    displayName: "TripAdvisor",
    color:       "border-green-500/30 bg-green-500/5",
    textColor:   "text-green-600",
    homepage:    "https://www.tripadvisor.com",
    logo: (
      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
        <span className="text-white text-xs font-black leading-none">TA</span>
      </div>
    ),
  },
  zomato: {
    displayName: "Zomato",
    color:       "border-red-500/30 bg-red-500/5",
    textColor:   "text-red-500",
    homepage:    "https://www.zomato.com",
    logo: (
      <div className="w-7 h-7 rounded-md bg-red-500 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">Z</span>
      </div>
    ),
  },
  swiggy: {
    displayName: "Swiggy",
    color:       "border-orange-400/30 bg-orange-400/5",
    textColor:   "text-orange-400",
    homepage:    "https://www.swiggy.com",
    logo: (
      <div className="w-7 h-7 rounded-md bg-orange-400 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">SW</span>
      </div>
    ),
  },
  yelp: {
    displayName: "Yelp",
    color:       "border-rose-500/30 bg-rose-500/5",
    textColor:   "text-rose-500",
    homepage:    "https://www.yelp.com",
    logo: (
      <div className="w-7 h-7 rounded-md bg-rose-500 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">Y</span>
      </div>
    ),
  },
  magicpin: {
    displayName: "Magicpin",
    color:       "border-pink-500/30 bg-pink-500/5",
    textColor:   "text-pink-500",
    homepage:    "https://magicpin.in",
    logo: (
      <div className="w-7 h-7 rounded-md bg-pink-500 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">MP</span>
      </div>
    ),
  },
  eazydiner: {
    displayName: "EazyDiner",
    color:       "border-amber-500/30 bg-amber-500/5",
    textColor:   "text-amber-500",
    homepage:    "https://www.eazydiner.com",
    logo: (
      <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
        <span className="text-white font-black text-xs leading-none">ED</span>
      </div>
    ),
  },
};

/** Normalise a raw source string from the backend → platform key. */
function normalizePlatformKey(raw: string): string | null {
  const s = raw.toLowerCase().trim();
  if (s.includes("google"))      return "google";
  if (s.includes("justdial"))    return "justdial";
  if (s.includes("tripadvisor")) return "tripadvisor";
  if (s.includes("zomato"))      return "zomato";
  if (s.includes("swiggy"))      return "swiggy";
  if (s.includes("yelp"))        return "yelp";
  if (s.includes("magicpin"))    return "magicpin";
  if (s.includes("eazydiner") || s.includes("eazy diner")) return "eazydiner";
  return null;
}

interface RestaurantPlatformCard {
  key: string;
  reviewCount: number;
  /** Derived average rating 1–5 from HF confidence scores (positive → high) */
  avgRating: number | null;
  visitUrl: string;
}

interface RestaurantSourcesSectionProps {
  results: any[];       // raw API results for the restaurant
  placeInfo: any;       // place_info object from backend
}

function RestaurantSourcesSection({ results, placeInfo }: RestaurantSourcesSectionProps) {
  // ── Aggregate reviews per platform ──────────────────────────────────────────
  const platformMap: Record<string, { reviews: any[]; urls: string[] }> = {};

  results.forEach((r) => {
    const raw = r.source || "";
    const key = normalizePlatformKey(raw);
    if (!key) return;
    if (!platformMap[key]) platformMap[key] = { reviews: [], urls: [] };
    platformMap[key].reviews.push(r);
    const url = r.url || r.link || "";
    if (url) platformMap[key].urls.push(url);
  });

  // Google is always present when place_info exists, even if no reviews carry "google"
  // because place_info comes from Google Places API.
  if (placeInfo && !platformMap["google"]) {
    platformMap["google"] = { reviews: [], urls: [] };
  }

  const cards: RestaurantPlatformCard[] = Object.entries(platformMap).map(([key, { reviews, urls }]) => {
    // Derive a proxy star rating from HF confidence + sentiment polarity:
    //   Positive review at 90% conf  → contributes ~4.5 stars
    //   Negative review at 90% conf  → contributes ~1.0 stars
    //   Neutral                      → contributes ~3.0 stars
    let ratingSum = 0;
    let ratingCount = 0;
    reviews.forEach((r) => {
      const conf = (r.confidence ?? 50) / 100; // 0-1
      const sentiment = (r.sentiment || "").toLowerCase();
      let stars: number;
      if      (sentiment === "positive") stars = 3.0 + conf * 2.0;   // 3.0 – 5.0
      else if (sentiment === "negative") stars = 3.0 - conf * 2.0;   // 1.0 – 3.0
      else                               stars = 3.0;
      ratingSum += stars;
      ratingCount++;
    });

    // For Google, supplement with place_info.rating if available
    const googleRating = key === "google" && placeInfo?.rating
      ? parseFloat(placeInfo.rating)
      : null;

    const derivedRating = ratingCount > 0 ? ratingSum / ratingCount : null;
    const avgRating = googleRating ?? derivedRating;

    // Best URL to link to
    const platform = REVIEW_PLATFORMS[key];
    let visitUrl = platform?.homepage || "#";
    if (key === "google" && placeInfo?.maps_url) visitUrl = placeInfo.maps_url;
    else if (urls[0]) {
      try { visitUrl = new URL(urls[0]).origin; } catch { visitUrl = platform?.homepage || "#"; }
    }

    return { key, reviewCount: reviews.length, avgRating, visitUrl };
  });

  // Sort: Google first, then by review count desc
  cards.sort((a, b) => {
    if (a.key === "google") return -1;
    if (b.key === "google") return 1;
    return b.reviewCount - a.reviewCount;
  });

  if (cards.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.22 }}
    >
      <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4 text-orange-500" />
        Sources Used
      </h2>

      {/* Compact horizontal list — one row per source */}
      <div className="flex flex-col gap-2">
        {cards.map(({ key, reviewCount, avgRating, visitUrl }) => {
          const platform = REVIEW_PLATFORMS[key];
          if (!platform) return null;
          const rounded = avgRating !== null ? Math.round(avgRating * 10) / 10 : null;

          return (
            <motion.div
              key={key}
              className={`rounded-xl border backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 ${platform.color}`}
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
            >
              {/* Logo */}
              <div className="shrink-0">{platform.logo}</div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{platform.displayName}</p>
                <p className={`text-xs ${platform.textColor}`}>Review Platform</p>
              </div>

              {/* Review count */}
              <div className="text-center shrink-0">
                <p className="text-base font-bold text-foreground leading-none">{reviewCount > 0 ? reviewCount : "—"}</p>
                <p className="text-[10px] text-muted-foreground">reviews</p>
              </div>

              {/* Star rating */}
              {rounded !== null && (
                <div className="flex items-center gap-1 shrink-0">
                  <Star className={`w-3.5 h-3.5 fill-current ${platform.textColor}`} />
                  <span className="text-sm font-bold text-foreground">{rounded.toFixed(1)}</span>
                </div>
              )}

              {/* Visit button */}
              <a
                href={visitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 hover:opacity-90 active:scale-95 ${platform.color} ${platform.textColor}`}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
                Visit
              </a>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Overall sentiment badge for Companies
// ─────────────────────────────────────────────
function OverallSentimentBadge({ sentiment, pct }: { sentiment: string; pct: number }) {
  const color =
    sentiment === "positive" ? "text-green-500 bg-green-500/10 border-green-500/20"
    : sentiment === "negative" ? "text-red-500 bg-red-500/10 border-red-500/20"
    : "text-slate-400 bg-slate-400/10 border-slate-400/20";
  const label = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${color}`}>
      <Activity className="w-4 h-4" />
      Overall Sentiment: {label} ({pct}%)
    </div>
  );
}

// ─────────────────────────────────────────────
// Main results page
// ─────────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const topic    = searchParams.get("topic")    || "Sample Topic";
  const category = searchParams.get("category") || "products";

  // Category flags
  const isNews       = category === "news";
  const isCompany    = category === "companies";
  const isRestaurant = category === "restaurants";
  const isMovies     = category === "movies";
  const isNewsLike   = isNews || isCompany || isMovies; // all use news_narratives + headline groups
  const isProduct    = !isNewsLike && !isRestaurant;

  // Category label shown in header / export
  const categoryLabel =
    isNews       ? "News & Politics"
    : isCompany  ? "Companies"
    : isRestaurant ? "Restaurants"
    : isMovies   ? "Movies & TV Shows"
    : "Products & Brands";

  // Backend `domain` query param
  const domain =
    isNews       ? "news"
    : isCompany  ? "companies"
    : isRestaurant ? "restaurants"
    : isMovies   ? "movies"
    : "products";

  const [apiData,         setApiData]         = useState<any>(null);
  const [fetchError,      setFetchError]       = useState<string | null>(null);
  const [isLoading,       setIsLoading]        = useState(true);
  const [isRefreshing,    setIsRefreshing]     = useState(false);
  const [showShareDialog, setShowShareDialog]  = useState(false);
  const [copied,          setCopied]           = useState(false);
  const [isExporting,     setIsExporting]      = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null);
      setIsLoading(true);

      const apiUrl = `http://127.0.0.1:8000/analyze?domain=${domain}&topic=${encodeURIComponent(topic)}`;
      console.log("[SentiStream] Fetching:", apiUrl);

      const res = await fetch(apiUrl);
      console.log("[SentiStream] Status:", res.status, res.statusText);

      if (!res.ok) {
        let bodyText = "";
        try { bodyText = await res.text(); } catch { /* ignore */ }
        console.error("[SentiStream] Error body:", bodyText);
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("[SentiStream] Response:", data);

      setApiData(data.result ?? data);
      setIsLoading(false);
    } catch (err) {
      console.error("[SentiStream] Fetch failed:", err);
      setFetchError((err as Error)?.message || "Failed to fetch");
      setIsLoading(false);
      setApiData({ results: [], ai_summary: "Unable to load analysis.", domain: "Error", topic });
    }
  }, [topic, domain]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data ────────────────────────────────────────────────
  const realResults: any[] = apiData?.results || [];

  const positiveResults = realResults.filter((r) => r.sentiment?.toLowerCase() === "positive");
  const negativeResults = realResults.filter((r) => r.sentiment?.toLowerCase() === "negative");
  const neutralResults  = realResults.filter((r) => r.sentiment?.toLowerCase() === "neutral");

  const positiveCount = positiveResults.length;
  const negativeCount = negativeResults.length;
  const neutralCount  = neutralResults.length;
  const total         = positiveCount + negativeCount + neutralCount;

  const positiveHeadlines = positiveResults.slice(0, 3);
  const negativeHeadlines = negativeResults.slice(0, 3);
  const neutralHeadlines  = neutralResults.slice(0, 3);

  const liveSentimentData = {
    positive: total ? Math.round((positiveCount / total) * 100) : 0,
    negative: total ? Math.round((negativeCount / total) * 100) : 0,
    neutral:  total ? Math.round((neutralCount  / total) * 100) : 0,
  };

  // Dominant sentiment
  const backendDominant = apiData?.dominant_sentiment?.toLowerCase();
  const dominantSentiment: "positive" | "negative" | "neutral" = (() => {
    if (backendDominant === "positive" || backendDominant === "negative" || backendDominant === "neutral")
      return backendDominant;
    if (positiveCount === negativeCount && negativeCount === neutralCount) return "neutral";
    if (positiveCount >= negativeCount && positiveCount >= neutralCount) return "positive";
    if (negativeCount >= positiveCount && negativeCount >= neutralCount) return "negative";
    return "neutral";
  })();

  const verdictScore =
    dominantSentiment === "positive" ? liveSentimentData.positive
    : dominantSentiment === "negative" ? liveSentimentData.negative
    : liveSentimentData.neutral;

  const verdictSummary: string = apiData?.ai_summary || "";

  // News-like narratives (news + companies)
  const positiveNarrative = isNewsLike ? getNarrative(apiData, "positive", positiveResults) : "";
  const negativeNarrative = isNewsLike ? getNarrative(apiData, "negative", negativeResults) : "";
  const neutralNarrative  = isNewsLike ? getNarrative(apiData, "neutral",  neutralResults)  : "";

  // Source groups (news + companies + movies + restaurants + products)
  const sourceGroups: Record<string, any[]> = {};
  if (isNewsLike || isRestaurant || isProduct) {
    realResults.forEach((r) => {
      const src = inferSource(r);
      if (!src) return;
      if (!sourceGroups[src]) sourceGroups[src] = [];
      sourceGroups[src].push(r);
    });
  }
  const detectedSources = Object.entries(sourceGroups).map(([name, items]) => {
    const firstUrl: string = (items[0] as any)?.url || (items[0] as any)?.link || "";
    let homepageUrl = "";
    try { if (firstUrl) homepageUrl = new URL(firstUrl).origin; } catch { /* ignore */ }
    return { name, articleCount: items.length, homepageUrl };
  });

  const toItems = (arr: any[]) =>
    arr.map((r) => ({ text: r.headline, source: inferSource(r), date: r.confidence ? `${r.confidence}% confidence` : "" }));

  // ── Actions ────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setIsLoading(true);
    fetchData().then(() => setTimeout(() => { setIsRefreshing(false); router.refresh(); }, 500));
  }, [router, fetchData]);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const label = dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1);
    const shareText = `SentiStream AI: ${topic} — ${verdictScore}% ${label} Sentiment`;
    if (navigator.share) {
      try { await navigator.share({ title: `Sentiment: ${topic}`, text: shareText, url: shareUrl }); }
      catch (err) { if ((err as Error).name !== "AbortError") setShowShareDialog(true); }
    } else {
      setShowShareDialog(true);
    }
  }, [topic, dominantSentiment, verdictScore]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (err) { console.error("Copy failed:", err); }
  }, []);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    const allPositive = realResults.filter((r) => r.sentiment === "Positive");
    const allNegative = realResults.filter((r) => r.sentiment === "Negative");
    const allNeutral  = realResults.filter((r) => r.sentiment === "Neutral");

    const companiesSection = isCompany ? `
POSITIVE DRIVERS
----------------
${(apiData?.pros || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n") || "None"}

NEGATIVE DRIVERS
----------------
${(apiData?.cons || []).map((c: string, i: number) => `${i + 1}. ${c}`).join("\n") || "None"}
` : isMovies ? `
POSITIVE REACTIONS
------------------
${(apiData?.pros || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n") || "None"}

NEGATIVE REACTIONS
------------------
${(apiData?.cons || []).map((c: string, i: number) => `${i + 1}. ${c}`).join("\n") || "None"}
` : "";

    const report = `
SENTISTREAM AI — SENTIMENT ANALYSIS REPORT
===========================================

Topic:     ${topic}
Category:  ${categoryLabel}
Generated: ${new Date().toLocaleString()}

OVERALL SENTIMENT
-----------------
${dominantSentiment.toUpperCase()} (${verdictScore}%)

SENTIMENT DISTRIBUTION
----------------------
Positive: ${liveSentimentData.positive}%
Negative: ${liveSentimentData.negative}%
Neutral:  ${liveSentimentData.neutral}%

AI SUMMARY
----------
${verdictSummary}
${companiesSection}
TOP POSITIVE MENTIONS
---------------------
${allPositive.slice(0, 3).map((r, i) => `${i + 1}. "${r.headline}"\n   Confidence: ${r.confidence}%`).join("\n\n")}

TOP NEGATIVE MENTIONS
---------------------
${allNegative.slice(0, 3).map((r, i) => `${i + 1}. "${r.headline}"\n   Confidence: ${r.confidence}%`).join("\n\n")}

NEUTRAL MENTIONS
----------------
${allNeutral.slice(0, 3).map((r, i) => `${i + 1}. "${r.headline}"\n   Confidence: ${r.confidence}%`).join("\n\n")}

---
Report generated by SentiStream AI
    `.trim();

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentistream-${category}-${topic.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setIsExporting(false), 1000);
  }, [topic, category, categoryLabel, isCompany, isMovies, isRestaurant, verdictSummary, liveSentimentData, realResults, apiData, dominantSentiment, verdictScore]);

  // ── Loading screen ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Analysing sentiment…</p>
          <p className="text-sm text-muted-foreground mt-1">
            Fetching live data for <span className="text-primary font-medium">{topic}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FloatingOrbs />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <DashboardNavbar />

        <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">

          {/* ── Error banner ── */}
          {fetchError && (
            <motion.div
              className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            >
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Failed to load analysis data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {fetchError}. Check the backend is running at http://127.0.0.1:8000 and see the browser console for details.
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Retry
              </Button>
            </motion.div>
          )}

          {/* ── Page header ── */}
          <motion.div
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          >
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-150"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center gap-3 flex-wrap">
                {isCompany    && <Building2 className="w-7 h-7 text-purple-500 shrink-0" />}
                {isMovies     && <Clapperboard className="w-7 h-7 text-red-500 shrink-0" />}
                {isRestaurant && <UtensilsCrossed className="w-7 h-7 text-orange-500 shrink-0" />}
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  Sentiment Analysis:{" "}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {apiData?.topic || topic}
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <p className="text-muted-foreground">Category: {apiData?.domain || categoryLabel}</p>
                {(isCompany || isMovies || isRestaurant) && (
                  <OverallSentimentBadge sentiment={dominantSentiment} pct={verdictScore} />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-all duration-150" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing…" : "Refresh"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-all duration-150" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                Share
              </Button>
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 active:scale-95 transition-all duration-150" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? "Exporting…" : "Export"}
              </Button>
            </div>
          </motion.div>

          {/* ── Main grid: Pie + Insight card (hidden for movies — MovieSection owns everything) ── */}
          {!isMovies && <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
            key={isRefreshing ? "refreshing" : "stable"}
            initial={isRefreshing ? { opacity: 0.5 } : { opacity: 1 }}
            animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          >
            {/* Pie chart */}
            <motion.div
              className="lg:col-span-1 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-md p-6 shadow-xl"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Sentiment Distribution</h2>
              <SentimentPieChart data={liveSentimentData} dominantSentiment={dominantSentiment} dominantPct={verdictScore} />
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Positive ({liveSentimentData.positive}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">Negative ({liveSentimentData.negative}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <span className="text-sm text-muted-foreground">Neutral ({liveSentimentData.neutral}%)</span>
                </div>
              </div>
            </motion.div>

            {/* Right panel */}
            <div className="lg:col-span-2">
              {isNewsLike ? (
                /* News & Companies — AI Insight card with stat tiles + narratives */
                <motion.div
                  className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-md p-6 shadow-xl h-full"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      {isCompany
                        ? <Building2 className="w-5 h-5 text-purple-500" />
                        : isMovies
                        ? <Clapperboard className="w-5 h-5 text-red-500" />
                        : <Newspaper className="w-5 h-5 text-primary" />}
                      <h2 className="text-lg font-semibold text-foreground">
                        {isCompany ? "AI Company Insight" : isMovies ? "AI Movie & TV Insight" : "AI News Insight"}
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      <Zap className="w-3 h-3" />
                      AI Live Analysis
                    </span>
                  </div>

                  {/* Stat tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center sm:col-span-1">
                      <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-0.5">Overall</p>
                      <p className={`text-sm font-semibold capitalize ${
                        dominantSentiment === "positive" ? "text-green-500"
                        : dominantSentiment === "negative" ? "text-red-500"
                        : "text-slate-400"
                      }`}>
                        {dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center sm:col-span-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Analyzed</p>
                      <p className="text-lg font-bold text-foreground">{total}</p>
                      <p className="text-xs text-muted-foreground">{isCompany ? "articles" : isMovies ? "reviews" : "headlines"}</p>
                    </div>
                    <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-center sm:col-span-1">
                      <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-500" />
                      <p className="text-xs text-muted-foreground mb-0.5">Positive</p>
                      <p className="text-lg font-bold text-green-500">{positiveCount}</p>
                    </div>
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center sm:col-span-1">
                      <TrendingDown className="w-4 h-4 mx-auto mb-1 text-red-500" />
                      <p className="text-xs text-muted-foreground mb-0.5">Negative</p>
                      <p className="text-lg font-bold text-red-500">{negativeCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-400/10 border border-slate-400/20 p-3 text-center sm:col-span-1">
                      <Minus className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                      <p className="text-xs text-muted-foreground mb-0.5">Neutral</p>
                      <p className="text-lg font-bold text-slate-400">{neutralCount}</p>
                    </div>
                  </div>

                  {/* Narratives — labelled "Positive/Negative Drivers" for Companies */}
                  <div className="space-y-3">
                    {(
                      [
                        {
                          key: "positive" as const,
                          label: isCompany ? "Positive Drivers" : isMovies ? "Positive Reactions" : "Positive Narrative",
                          text: positiveNarrative,
                          count: positiveCount,
                          colorClass: "bg-green-500/5 border-green-500/20",
                          textClass: "text-green-500",
                        },
                        {
                          key: "negative" as const,
                          label: isCompany ? "Negative Drivers" : isMovies ? "Negative Reactions" : "Negative Narrative",
                          text: negativeNarrative,
                          count: negativeCount,
                          colorClass: "bg-red-500/5 border-red-500/20",
                          textClass: "text-red-500",
                        },
                        {
                          key: "neutral" as const,
                          label: "Neutral Narrative",
                          text: neutralNarrative,
                          count: neutralCount,
                          colorClass: "bg-slate-400/5 border-slate-400/20",
                          textClass: "text-slate-400",
                        },
                      ] as const
                    )
                      .slice()
                      .sort((a, b) => {
                        if (a.key === dominantSentiment) return -1;
                        if (b.key === dominantSentiment) return 1;
                        return b.count - a.count;
                      })
                      .map(({ label, text, colorClass, textClass }) => (
                        <div key={label} className={`rounded-xl p-3 border ${colorClass}`}>
                          <p className={`text-xs font-semibold mb-1 ${textClass}`}>{label}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                        </div>
                      ))
                    }
                  </div>
                </motion.div>
              ) : isRestaurant ? (
                /* Restaurants — 4 sentiment stat cards only; AI Overview is in the section below */
                <motion.div
                  className="grid grid-cols-2 gap-3 content-start"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
                >
                  <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-4 flex flex-col items-center justify-center gap-1">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <p className="text-xs text-muted-foreground font-medium">Positive</p>
                    <p className="text-3xl font-bold text-green-500 leading-none">{positiveCount}</p>
                    <p className="text-xs text-green-500/70">{liveSentimentData.positive}%</p>
                  </div>
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex flex-col items-center justify-center gap-1">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <p className="text-xs text-muted-foreground font-medium">Negative</p>
                    <p className="text-3xl font-bold text-red-500 leading-none">{negativeCount}</p>
                    <p className="text-xs text-red-500/70">{liveSentimentData.negative}%</p>
                  </div>
                  <div className="rounded-2xl bg-slate-400/10 border border-slate-400/20 p-4 flex flex-col items-center justify-center gap-1">
                    <Minus className="w-5 h-5 text-slate-400" />
                    <p className="text-xs text-muted-foreground font-medium">Neutral</p>
                    <p className="text-3xl font-bold text-slate-400 leading-none">{neutralCount}</p>
                    <p className="text-xs text-slate-400/70">{liveSentimentData.neutral}%</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 border border-border/40 p-4 flex flex-col items-center justify-center gap-1">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">Total Reviews</p>
                    <p className="text-3xl font-bold text-foreground leading-none">{total}</p>
                    <p className="text-xs text-muted-foreground/70">analysed</p>
                  </div>
                </motion.div>
              ) : (
                /* Products — VerdictCard */
                <VerdictCard sentiment={dominantSentiment} score={verdictScore} summary={verdictSummary} />
              )}
            </div>
          </motion.div>}

          {/* ── Coverage Trend (not for restaurants or movies — they have their own layout) ── */}
          {total > 0 && !isRestaurant && !isMovies && (
            <CoverageTrend positiveCount={positiveCount} negativeCount={negativeCount} neutralCount={neutralCount} total={total} />
          )}

          {/* ── Sentiment summary sections (not for restaurants or movies) ── */}
          {!isRestaurant && !isMovies && <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-6"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
          >
            {(
              [
                { type: "positive" as const, items: toItems(positiveHeadlines), count: positiveCount },
                { type: "negative" as const, items: toItems(negativeHeadlines), count: negativeCount },
                { type: "neutral"  as const, items: toItems(neutralHeadlines),  count: neutralCount  },
              ]
                .slice()
                .sort((a, b) => {
                  if (a.type === dominantSentiment) return -1;
                  if (b.type === dominantSentiment) return 1;
                  return b.count - a.count;
                })
            ).map(({ type, items, count }) => (
              <SentimentSection key={type} type={type} items={items} count={count} />
            ))}
          </motion.div>}

          {/* ── Movies & TV Shows Dashboard ── */}
          {isMovies && (
            <MovieSection
              topic={apiData?.topic || topic}
              apiData={apiData}
              positiveCount={positiveCount}
              negativeCount={negativeCount}
              neutralCount={neutralCount}
              total={total}
              dominantSentiment={dominantSentiment}
              verdictScore={verdictScore}
              verdictSummary={verdictSummary}
              liveSentimentData={liveSentimentData}
              positiveHeadlines={positiveHeadlines}
              negativeHeadlines={negativeHeadlines}
              neutralHeadlines={neutralHeadlines}
              detectedSources={detectedSources}
              inferSource={inferSource}
            />
          )}

          {/* ── Companies: Intelligence Dashboard ── */}
          {isCompany && (
            <div className="space-y-8 mb-8">

              {/* Row 0: Overall AI Verdict + Sentiment Distribution (kept as requested) */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Overall AI Verdict
                </h2>
                <div className={`rounded-2xl border p-6 backdrop-blur-sm ${
                  dominantSentiment === "positive"
                    ? "border-green-500/30 bg-green-500/5"
                    : dominantSentiment === "negative"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-slate-400/30 bg-slate-400/5"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={`flex items-center justify-center w-16 h-16 rounded-2xl shrink-0 ${
                      dominantSentiment === "positive" ? "bg-green-500/15"
                      : dominantSentiment === "negative" ? "bg-red-500/15"
                      : "bg-slate-400/15"
                    }`}>
                      {dominantSentiment === "positive"
                        ? <TrendingUp className="w-8 h-8 text-green-500" />
                        : dominantSentiment === "negative"
                        ? <TrendingDown className="w-8 h-8 text-red-500" />
                        : <Minus className="w-8 h-8 text-slate-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`text-2xl font-bold capitalize ${
                          dominantSentiment === "positive" ? "text-green-500"
                          : dominantSentiment === "negative" ? "text-red-500"
                          : "text-slate-400"
                        }`}>
                          {dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                          dominantSentiment === "positive" ? "text-green-500 bg-green-500/10 border-green-500/20"
                          : dominantSentiment === "negative" ? "text-red-500 bg-red-500/10 border-red-500/20"
                          : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                        }`}>
                          {verdictScore}% dominant
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {verdictSummary || `Public sentiment for ${topic} is currently ${dominantSentiment}, based on ${total} analysed articles.`}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Row 1: Company Profile + Company Snapshot */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Company Profile */}
                <motion.div
                  className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
                >
                  <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-500" />
                    Company Profile
                  </h2>
                  {/* Logo + name */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent((apiData?.topic || topic).toLowerCase().replace(/\s+/g, ""))}.com`}
                        alt={`${topic} logo`}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const parent = e.currentTarget.parentElement as HTMLElement;
                          if (parent) parent.innerHTML = `<span class="text-2xl font-bold text-purple-500">${(apiData?.topic || topic).charAt(0).toUpperCase()}</span>`;
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{apiData?.topic || topic}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {(apiData?.company_intelligence?.key_themes as string[] || []).slice(0, 2).join(" · ") || "Company Intelligence"}
                      </p>
                    </div>
                  </div>
                  {/* Profile fields */}
                  <div className="space-y-3">
                    {[
                      {
                        icon: <Briefcase className="w-4 h-4 text-purple-500" />,
                        label: "Industry",
                        value: (() => {
                          const themes: string[] = apiData?.company_intelligence?.key_themes || [];
                          if (themes.some((t: string) => t.includes("product & innovation"))) return "Technology";
                          if (themes.some((t: string) => t.includes("stock & valuation"))) return "Finance / Technology";
                          if (themes.some((t: string) => t.includes("revenue & earnings"))) return "Enterprise";
                          return "Technology & Innovation";
                        })(),
                      },
                      {
                        icon: <Globe className="w-4 h-4 text-purple-500" />,
                        label: "Coverage",
                        value: `${total} article${total !== 1 ? "s" : ""} analysed`,
                      },
                      {
                        icon: <Activity className="w-4 h-4 text-purple-500" />,
                        label: "Overall Sentiment",
                        value: dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1) + ` (${verdictScore}%)`,
                      },
                      {
                        icon: <BarChart3 className="w-4 h-4 text-purple-500" />,
                        label: "Key Topics",
                        value: (apiData?.company_intelligence?.key_themes as string[] || []).slice(0, 3).join(", ") || "Analysing…",
                      },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                        <div className="mt-0.5 shrink-0">{icon}</div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground font-medium">{label}</p>
                          <p className="text-sm text-foreground font-medium mt-0.5 leading-snug">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Company Snapshot */}
                <motion.div
                  className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    Company Snapshot
                  </h2>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-4 text-center">
                      <Newspaper className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                      <p className="text-2xl font-bold text-foreground">{total}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Articles Analysed</p>
                    </div>
                    <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
                      <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-green-500" />
                      <p className="text-2xl font-bold text-green-500">{positiveCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Positive ({liveSentimentData.positive}%)</p>
                    </div>
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                      <TrendingDown className="w-5 h-5 mx-auto mb-1.5 text-red-500" />
                      <p className="text-2xl font-bold text-red-500">{negativeCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Negative ({liveSentimentData.negative}%)</p>
                    </div>
                    <div className="rounded-xl bg-slate-400/10 border border-slate-400/20 p-4 text-center">
                      <Minus className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
                      <p className="text-2xl font-bold text-slate-400">{neutralCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Neutral ({liveSentimentData.neutral}%)</p>
                    </div>
                  </div>
                  {/* Workforce signals */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Workforce Signals</p>
                  <div className="space-y-2">
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      apiData?.company_intelligence?.layoff_signal
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}>
                      {apiData?.company_intelligence?.layoff_signal
                        ? <UserX className="w-4 h-4 text-red-500 shrink-0" />
                        : <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Recent Layoffs</p>
                        <p className={`text-sm font-semibold ${apiData?.company_intelligence?.layoff_signal ? "text-red-500" : "text-green-500"}`}>
                          {apiData?.company_intelligence?.layoff_signal ? "Layoff activity detected" : "No layoffs detected"}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      apiData?.company_intelligence?.hiring_signal
                        ? "border-green-500/20 bg-green-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}>
                      {apiData?.company_intelligence?.hiring_signal
                        ? <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                        : <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Hiring Status</p>
                        <p className={`text-sm font-semibold ${apiData?.company_intelligence?.hiring_signal ? "text-green-500" : "text-muted-foreground"}`}>
                          {apiData?.company_intelligence?.hiring_signal ? "Actively hiring" : "No active hiring signals"}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Row 2: Public Opinion — 4 quadrants */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Public Opinion
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Positive Drivers */}
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-5">
                    <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Positive Drivers
                    </h3>
                    <div className="space-y-2">
                      {(apiData?.company_intelligence?.positive_drivers as string[] || []).length > 0 ? (
                        (apiData.company_intelligence.positive_drivers as string[]).map((d: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                            <ThumbsUp className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                            <span className="text-sm text-foreground leading-snug capitalize">{d}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No positive signals in recent coverage.</p>
                      )}
                    </div>
                  </div>
                  {/* Negative Drivers */}
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-5">
                    <h3 className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Negative Drivers
                    </h3>
                    <div className="space-y-2">
                      {(apiData?.company_intelligence?.negative_drivers as string[] || []).length > 0 ? (
                        (apiData.company_intelligence.negative_drivers as string[]).map((d: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                            <ThumbsDown className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            <span className="text-sm text-foreground leading-snug capitalize">{d}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No negative signals in recent coverage.</p>
                      )}
                    </div>
                  </div>
                  {/* What Employees Say */}
                  <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" />
                      What Employees Say
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {apiData?.company_intelligence?.employee_sentiment || "Analysing employee coverage…"}
                    </p>
                  </div>
                  {/* What Customers Say */}
                  <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      What Customers Say
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {apiData?.company_intelligence?.customer_sentiment || "Analysing customer coverage…"}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Row 3: Latest Company News */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-purple-500" />
                  Latest Company News
                </h2>
                <div className={`grid gap-6 ${
                  [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 1
                    ? "grid-cols-1 max-w-xl"
                    : [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-3"
                }`}>
                  {positiveHeadlines.length > 0 && (
                    <HeadlineGroup icon={<TrendingUp className="w-5 h-5 text-green-500" />} title="Positive Coverage" emptyLabel="No Positive Coverage Found" headlines={positiveHeadlines} sentiment="positive" />
                  )}
                  {negativeHeadlines.length > 0 && (
                    <HeadlineGroup icon={<TrendingDown className="w-5 h-5 text-red-500" />} title="Negative Coverage" emptyLabel="No Negative Coverage Found" headlines={negativeHeadlines} sentiment="negative" />
                  )}
                  {neutralHeadlines.length > 0 && (
                    <HeadlineGroup icon={<Minus className="w-5 h-5 text-slate-400" />} title="Neutral Coverage" emptyLabel="No Neutral Coverage Found" headlines={neutralHeadlines} sentiment="neutral" />
                  )}
                  {positiveHeadlines.length === 0 && negativeHeadlines.length === 0 && neutralHeadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full">No news articles available.</p>
                  )}
                </div>
              </motion.div>

              {/* Row 4: Sources Used */}
              <ResourcesSection sources={detectedSources} />
            </div>
          )}

          {/* ── News: Headlines ── */}
          {isNews && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
              <div className={`grid gap-6 ${
                [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 1
                  ? "grid-cols-1 max-w-xl"
                  : [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-3"
              }`}>
                {positiveHeadlines.length > 0 && (
                  <HeadlineGroup icon={<ThumbsUp className="w-5 h-5 text-green-500" />} title="Top Positive Headlines" emptyLabel="No Positive Coverage Found" headlines={positiveHeadlines} sentiment="positive" />
                )}
                {negativeHeadlines.length > 0 && (
                  <HeadlineGroup icon={<ThumbsDown className="w-5 h-5 text-red-500" />} title="Top Negative Headlines" emptyLabel="No Negative Coverage Found" headlines={negativeHeadlines} sentiment="negative" />
                )}
                {neutralHeadlines.length > 0 && (
                  <HeadlineGroup icon={<Minus className="w-5 h-5 text-slate-400" />} title="Top Neutral Headlines" emptyLabel="No Neutral Coverage Found" headlines={neutralHeadlines} sentiment="neutral" />
                )}
                {positiveHeadlines.length === 0 && negativeHeadlines.length === 0 && neutralHeadlines.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">No headlines available.</p>
                )}
              </div>
              <ResourcesSection sources={detectedSources} />
            </motion.div>
          )}

          {/* ── Products: Dedicated Dashboard ── */}
          {isProduct && (
            <div className="space-y-6 mb-8">

              {/* 1 — Pros & Cons */}
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
              >
                {/* Pros */}
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-green-500" />
                    Top Pros
                  </h3>
                  <div className="space-y-2">
                    {(apiData?.pros || []).length > 0 ? (
                      (apiData.pros as string[]).map((pro: string, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                          <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground leading-snug capitalize">{pro}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No positive signals found.</p>
                    )}
                  </div>
                </div>

                {/* Cons */}
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5 text-red-500" />
                    Top Cons
                  </h3>
                  <div className="space-y-2">
                    {(apiData?.cons || []).length > 0 ? (
                      (apiData.cons as string[]).map((con: string, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                          <Minus className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground leading-snug capitalize">{con}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No negative signals found.</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* 2 — Customer Summary */}
              {(apiData?.customer_summary || apiData?.ai_summary) && (
                <motion.div
                  className="rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-6"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Customer Summary
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {apiData?.customer_summary || apiData?.ai_summary}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      dominantSentiment === "positive" ? "text-green-500 bg-green-500/10 border-green-500/20"
                      : dominantSentiment === "negative" ? "text-red-500 bg-red-500/10 border-red-500/20"
                      : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                    }`}>
                      <Activity className="w-3 h-3" />
                      {dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1)} · {verdictScore}%
                    </span>
                    <span className="text-xs text-muted-foreground">{total} reviews analysed</span>
                  </div>
                </motion.div>
              )}

              {/* 3 — Top Reviews */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Top Reviews
                </h2>
                <div className={`grid gap-6 ${
                  [positiveHeadlines, negativeHeadlines].filter(a => a.length > 0).length === 1
                    ? "grid-cols-1 max-w-xl"
                    : "grid-cols-1 md:grid-cols-2"
                }`}>
                  {positiveHeadlines.length > 0 && (
                    <HeadlineGroup
                      icon={<ThumbsUp className="w-5 h-5 text-green-500" />}
                      title="Positive Reviews"
                      emptyLabel="No Positive Reviews Found"
                      headlines={positiveHeadlines}
                      sentiment="positive"
                    />
                  )}
                  {negativeHeadlines.length > 0 && (
                    <HeadlineGroup
                      icon={<ThumbsDown className="w-5 h-5 text-red-500" />}
                      title="Negative Reviews"
                      emptyLabel="No Negative Reviews Found"
                      headlines={negativeHeadlines}
                      sentiment="negative"
                    />
                  )}
                  {positiveHeadlines.length === 0 && negativeHeadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full">No reviews available.</p>
                  )}
                </div>
              </motion.div>

              {/* 4 — Sources */}
              {detectedSources.length > 0 && (
                <ResourcesSection sources={detectedSources} />
              )}

              {/* 5 — Analysis Statistics */}
              <motion.div
                className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}
              >
                <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Analysis Statistics
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Analysed", value: total,         sub: "reviews",                          icon: <Activity className="w-4 h-4 text-muted-foreground" />, color: "border-border/30 bg-muted/20" },
                    { label: "Positive",        value: positiveCount, sub: `${liveSentimentData.positive}%`,  icon: <TrendingUp className="w-4 h-4 text-green-500" />,      color: "border-green-500/20 bg-green-500/5" },
                    { label: "Negative",        value: negativeCount, sub: `${liveSentimentData.negative}%`,  icon: <TrendingDown className="w-4 h-4 text-red-500" />,      color: "border-red-500/20 bg-red-500/5" },
                    { label: "Sources",         value: detectedSources.length, sub: "detected",              icon: <Globe className="w-4 h-4 text-muted-foreground" />,    color: "border-border/30 bg-muted/20" },
                  ].map(({ label, value, sub, icon, color }) => (
                    <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                      <div className="flex justify-center mb-2">{icon}</div>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
                {/* Breakdown bars */}
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Positive", pct: liveSentimentData.positive, color: "bg-green-500", text: "text-green-500" },
                    { label: "Negative", pct: liveSentimentData.negative, color: "bg-red-500",   text: "text-red-500"  },
                  ].map(({ label, pct, color, text }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-16 shrink-0 ${text}`}>{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${color}`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          )}

          {/* ── Restaurants: Dedicated Dashboard ── */}
          {isRestaurant && (
            <div className="space-y-5 mb-8">

              {/* 1 — AI Overview (compact, directly below the 4 cards) */}
              <RestaurantAIOverview
                topic={apiData?.topic || topic}
                aiSummary={verdictSummary}
                pros={apiData?.pros || []}
                cons={apiData?.cons || []}
                popularDishes={apiData?.popular_dishes || []}
                positiveCount={positiveCount}
                negativeCount={negativeCount}
                neutralCount={neutralCount}
                total={total}
                dominantSentiment={dominantSentiment}
              />

              {/* 2 — Analysis Statistics (four count cards only, no progress bars) */}
              <motion.div
                className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
              >
                <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  Analysis Statistics
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Analysed", value: total,         sub: "reviews",                        icon: <Activity className="w-4 h-4 text-muted-foreground" />, color: "border-border/30 bg-muted/20" },
                    { label: "Positive",        value: positiveCount, sub: `${liveSentimentData.positive}%`, icon: <TrendingUp className="w-4 h-4 text-green-500" />,      color: "border-green-500/20 bg-green-500/5" },
                    { label: "Negative",        value: negativeCount, sub: `${liveSentimentData.negative}%`, icon: <TrendingDown className="w-4 h-4 text-red-500" />,      color: "border-red-500/20 bg-red-500/5" },
                    { label: "Neutral",         value: neutralCount,  sub: `${liveSentimentData.neutral}%`,  icon: <Minus className="w-4 h-4 text-slate-400" />,           color: "border-slate-400/20 bg-slate-400/5" },
                  ].map(({ label, value, sub, icon, color }) => (
                    <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                      <div className="flex justify-center mb-1.5">{icon}</div>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* 3 — Customer Reviews (unchanged) */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  Customer Reviews
                </h2>
                <div className={`grid gap-4 ${
                  [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 1
                    ? "grid-cols-1 max-w-xl"
                    : [positiveHeadlines, negativeHeadlines, neutralHeadlines].filter(a => a.length > 0).length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-3"
                }`}>
                  {positiveHeadlines.length > 0 && (
                    <HeadlineGroup icon={<ThumbsUp className="w-5 h-5 text-green-500" />} title="Positive Reviews" emptyLabel="No Positive Reviews Found" headlines={positiveHeadlines} sentiment="positive" />
                  )}
                  {negativeHeadlines.length > 0 && (
                    <HeadlineGroup icon={<ThumbsDown className="w-5 h-5 text-red-500" />} title="Negative Reviews" emptyLabel="No Negative Reviews Found" headlines={negativeHeadlines} sentiment="negative" />
                  )}
                  {neutralHeadlines.length > 0 && (
                    <HeadlineGroup icon={<Minus className="w-5 h-5 text-slate-400" />} title="Neutral Reviews" emptyLabel="No Neutral Reviews Found" headlines={neutralHeadlines} sentiment="neutral" />
                  )}
                  {positiveHeadlines.length === 0 && negativeHeadlines.length === 0 && neutralHeadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full">No reviews available.</p>
                  )}
                </div>
              </motion.div>

              {/* 4 — Top Praises & Top Complaints (compact pill chips) */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top Praises */}
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-green-500" />
                      Top Praises
                    </h3>
                    {(apiData?.pros || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(apiData.pros as string[]).map((pro: string, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 capitalize">
                            <Star className="w-3 h-3" />{pro}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No positive signals found.</p>
                    )}
                  </div>
                  {/* Top Complaints */}
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4 text-red-500" />
                      Top Complaints
                    </h3>
                    {(apiData?.cons || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(apiData.cons as string[]).map((con: string, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 capitalize">
                            <Minus className="w-3 h-3" />{con}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No negative signals found.</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* 5 — Sources Used (compact horizontal cards, actual sources only) */}
              <RestaurantSourcesSection
                results={realResults}
                placeInfo={apiData?.place_info ?? null}
              />

            </div>
          )}
        </main>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Share Analysis
            </DialogTitle>
            <DialogDescription>Share this sentiment analysis with others</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-sm font-medium text-foreground mb-2">Analysis Link</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={typeof window !== "undefined" ? window.location.href : ""}
                  className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                <Button size="sm" onClick={handleCopy} className="gap-2 active:scale-95 transition-all duration-150">
                  {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{topic}</strong> — {verdictScore}% {dominantSentiment.charAt(0).toUpperCase() + dominantSentiment.slice(1)} Sentiment
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-lg text-muted-foreground">Loading analysis…</span>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
