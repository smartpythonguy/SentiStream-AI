"use client";

import { motion } from "framer-motion";
import {
  Utensils,
  ThumbsUp,
  ThumbsDown,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ExternalLink,
  User,
  Clock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/* ────────────────────────────────────────────────────────────────
   Types — mirror the shape returned by backend.domain_router.analyze_topic
   for domain="restaurants"
   ──────────────────────────────────────────────────────────────── */

interface ReviewResult {
  headline: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  confidence: number;
  source: string;
  url: string;
  // Optional real-review fields (present when the source exposes them).
  snippet?: string;   // original review body
  author?: string;    // reviewer name
  rating?: number | null;
  date?: string;      // e.g. "2 months ago"
}

interface PlaceInfo {
  name?: string;
  rating?: number | null;
  total_reviews?: number | null;
  price_level?: string;
  cuisine?: string[];
  address?: string;
  website?: string;
  maps_url?: string;
}

export interface RestaurantAnalysis {
  status: "success" | "error";
  domain: string;
  topic: string;
  results: ReviewResult[];
  dominant_sentiment: "Positive" | "Negative" | "Neutral";
  dominant_pct: number;
  pros: string[];   // "Top Praises"
  cons: string[];   // "Top Complaints"
  ai_summary: string;
  top_reviews: ReviewResult[];
  popular_dishes?: string[];
  place_info?: PlaceInfo;
}

interface RestaurantSectionProps {
  data: RestaurantAnalysis;
}

/* ────────────────────────────────────────────────────────────────
   Shared sentiment styling — matches verdict-card.tsx / sentiment-section.tsx
   ──────────────────────────────────────────────────────────────── */

const COLORS = {
  Positive: "#22c55e",
  Negative: "#ef4444",
  Neutral:  "#94a3b8",
};

const sentimentConfig = {
  Positive: {
    icon: TrendingUp,
    label: "Positive Sentiment",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowColor: "shadow-green-500/20",
  },
  Negative: {
    icon: TrendingDown,
    label: "Negative Sentiment",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    glowColor: "shadow-red-500/20",
  },
  Neutral: {
    icon: Minus,
    label: "Neutral Sentiment",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    glowColor: "shadow-slate-500/20",
  },
} as const;

const reviewBorder = {
  Positive: "border-l-green-500",
  Negative: "border-l-red-500",
  Neutral:  "border-l-slate-400",
} as const;

/* ────────────────────────────────────────────────────────────────
   Sentiment stats — always computed from the collected reviews, so the
   percentages shown are never hardcoded or backend-fixed.
   ──────────────────────────────────────────────────────────────── */

type Sentiment = "Positive" | "Negative" | "Neutral";

function sentimentStats(results: ReviewResult[]) {
  const counts: Record<Sentiment, number> = { Positive: 0, Negative: 0, Neutral: 0 };
  for (const r of results) {
    if (r.sentiment in counts) counts[r.sentiment]++;
  }
  const total = results.length;
  let dominant: Sentiment = "Neutral";
  (["Positive", "Negative", "Neutral"] as const).forEach((k) => {
    if (counts[k] > counts[dominant]) dominant = k;
  });
  const pct = total > 0 ? Math.round((counts[dominant] / total) * 100) : 0;
  const posPct = total > 0 ? Math.round((counts.Positive / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((counts.Negative / total) * 100) : 0;
  return { counts, total, dominant, pct, posPct, negPct };
}

/* ────────────────────────────────────────────────────────────────
   Grounded "AI Restaurant Overview" — built entirely from real,
   review-derived signals (sentiment split, praises/complaints, popular
   dishes, price band). Reads like a Google Maps overview, never a news
   article, and cites no raw counts. Falls back to the backend summary
   only when there is not enough structured data to compose one.
   ──────────────────────────────────────────────────────────────── */

function friendlyAspect(label: string): string {
  const l = (label || "").toLowerCase();
  if (l.includes("food")) return "the food";
  if (l.includes("taste") || l.includes("flavour") || l.includes("flavor")) return "the flavours";
  if (l.includes("service")) return "the service";
  if (l.includes("staff")) return "the staff";
  if (l.includes("ambien") || l.includes("atmosphere") || l.includes("decor")) return "the ambience";
  if (l.includes("clean") || l.includes("hygien")) return "cleanliness";
  if (l.includes("wait")) return "wait times";
  if (l.includes("pric") || l.includes("value") || l.includes("money") || l.includes("worth")) return "value for money";
  if (l.includes("parking")) return "parking";
  if (l.includes("portion")) return "portion sizes";
  return l;
}

function joinList(items: string[]): string {
  const a = items.filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
}

function buildOverview(data: RestaurantAnalysis): string {
  const name = data.topic;
  const { total, dominant, posPct, negPct } = sentimentStats(data.results);
  if (total === 0) return data.ai_summary || "";

  const prosPhrases = Array.from(new Set((data.pros || []).map(friendlyAspect))).filter(Boolean);
  const consPhrases = Array.from(new Set((data.cons || []).map(friendlyAspect))).filter(Boolean);
  const dishes = (data.popular_dishes || []).filter(Boolean);
  const price =
    data.place_info?.price_level && data.place_info.price_level !== "N/A"
      ? data.place_info.price_level
      : "";
  const cuisine = (data.place_info?.cuisine || [])[0] || "";

  const sentences: string[] = [];

  // 1 — overall satisfaction (qualitative, no raw numbers)
  if (posPct >= 70) sentences.push(`Diners are overwhelmingly positive about ${name}.`);
  else if (dominant === "Positive") sentences.push(`Most people come away happy with ${name}.`);
  else if (dominant === "Negative" && negPct >= 45) sentences.push(`Reviews for ${name} lean more critical than not.`);
  else sentences.push(`Opinions on ${name} are genuinely mixed.`);

  // 2 — strengths (food / taste / service / ambience / value …)
  if (prosPhrases.length) {
    sentences.push(`People especially praise ${joinList(prosPhrases.slice(0, 3))}.`);
  }

  // 3 — weaknesses (service / wait times / pricing …)
  if (consPhrases.length) {
    sentences.push(`The most common gripes centre on ${joinList(consPhrases.slice(0, 2))}.`);
  }

  // 4 — best dishes
  if (dishes.length) {
    sentences.push(`Regulars single out the ${joinList(dishes.slice(0, 3))} as standouts.`);
  }

  // 5 — pricing / value context
  if (price) {
    sentences.push(`It sits in the ${price.toLowerCase()} bracket.`);
  }

  // 6 — recommendation + who should visit
  if (dominant === "Positive") {
    sentences.push(
      cuisine
        ? `Worth a visit if you're after ${cuisine.toLowerCase()} — a dependable pick for a casual meal out.`
        : `Worth a visit for a dependable, satisfying meal.`
    );
  } else if (dominant === "Negative") {
    sentences.push(`Go in with tempered expectations, or save it for a quick bite rather than a special occasion.`);
  } else {
    sentences.push(`Fine for a low-key, casual meal — just don't expect it to wow you.`);
  }

  return sentences.join(" ");
}

/* ────────────────────────────────────────────────────────────────
   Verdict card — reused pattern from verdict-card.tsx, driven by the
   client-computed sentiment split (never a hardcoded percentage).
   ──────────────────────────────────────────────────────────────── */

function RestaurantVerdictCard({ data }: { data: RestaurantAnalysis }) {
  const stats = sentimentStats(data.results);
  const dominant = stats.total > 0 ? stats.dominant : data.dominant_sentiment;
  const pct = stats.total > 0 ? stats.pct : data.dominant_pct;
  const config = sentimentConfig[dominant];
  const Icon = config.icon;
  const overview = buildOverview(data) || data.ai_summary;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl border ${config.borderColor} ${config.bgColor} p-6 backdrop-blur-md shadow-xl ${config.glowColor}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-xl ${config.bgColor}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall Verdict</p>
            <p className={`text-xl font-bold ${config.color}`}>
              {config.label}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-bold text-foreground">
            {pct}
          </span>
          <span className="text-2xl text-muted-foreground">%</span>
          <Sparkles className="w-5 h-5 text-accent ml-2" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI Restaurant Overview
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          {overview}
        </p>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Sentiment distribution pie — same visual language as sentiment-pie-chart.tsx
   ──────────────────────────────────────────────────────────────── */

function RestaurantPieChart({ data }: { data: RestaurantAnalysis }) {
  const stats = sentimentStats(data.results);
  const dominant = stats.total > 0 ? stats.dominant : data.dominant_sentiment;
  const pct = stats.total > 0 ? stats.pct : data.dominant_pct;

  const chartData = [
    { name: "Positive", value: stats.counts.Positive, color: COLORS.Positive },
    { name: "Negative", value: stats.counts.Negative, color: COLORS.Negative },
    { name: "Neutral",  value: stats.counts.Neutral,  color: COLORS.Neutral  },
  ];

  const config = sentimentConfig[dominant];

  return (
    <motion.div
      className="relative h-72 w-full"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            animationBegin={0}
            animationDuration={1000}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "12px",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
            }}
            formatter={(value: number) => [`${value}`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className={`text-3xl font-bold ${config.color}`}>
            {pct}%
          </p>
          <p className="text-sm text-muted-foreground">
            {dominant}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Top Praises / Top Complaints — derived from pros/cons (restaurant
   theme clusters: food quality, service, ambience, value, hygiene, etc.)
   ──────────────────────────────────────────────────────────────── */

function PraiseComplaintList({
  title,
  items,
  type,
}: {
  title: string;
  items: string[];
  type: "praise" | "complaint";
}) {
  const isPraise = type === "praise";
  const Icon = isPraise ? ThumbsUp : ThumbsDown;
  const colorClass = isPraise ? "text-green-500" : "text-red-500";
  const bgClass = isPraise ? "bg-green-500/10" : "bg-red-500/10";
  const borderClass = isPraise ? "border-green-500/20" : "border-red-500/20";
  const dotClass = isPraise ? "bg-green-500" : "bg-red-500";

  return (
    <motion.div
      className={`rounded-2xl border ${borderClass} bg-card/50 backdrop-blur-sm p-5 hover:shadow-lg transition-shadow duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${bgClass}`}>
          <Icon className={`w-4 h-4 ${colorClass}`} />
        </div>
        <span className={`font-semibold ${colorClass}`}>{title}</span>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <motion.div
              key={index}
              className="relative pl-4 border-l-2 border-border/50"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div
                className={`absolute left-[-5px] top-2 w-2 h-2 rounded-full ${dotClass}`}
              />
              <p className="text-sm text-foreground leading-relaxed capitalize">
                {item}
              </p>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not enough {isPraise ? "positive" : "negative"} reviews to identify
          a clear pattern yet.
        </p>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Popular dishes — real dish mentions extracted from the review bodies.
   Hidden entirely when none were detected (never fabricated).
   ──────────────────────────────────────────────────────────────── */

function PopularDishes({ dishes }: { dishes: string[] }) {
  if (!dishes || dishes.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">Popular Dishes</p>
      <div className="flex flex-wrap gap-2">
        {dishes.map((d, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-foreground capitalize"
          >
            <Utensils className="w-3 h-3 text-accent" />
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Sources — every real source actually used, with its review count.
   Sources with no data simply never appear (nothing is placeholdered).
   ──────────────────────────────────────────────────────────────── */

function RestaurantSources({ results }: { results: ReviewResult[] }) {
  const counts: Record<string, number> = {};
  for (const r of results) {
    const s = (r.source || "").trim();
    if (s) counts[s] = (counts[s] || 0) + 1;
  }
  const sources = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sources.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map(([name, count]) => (
          <span
            key={name}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs"
          >
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-medium text-foreground">{name}</span>
            <span className="text-muted-foreground">
              {count} {count === 1 ? "review" : "reviews"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Top Reviews — individual review cards, styled like headline-card.tsx.
   Shows the real review snippet plus source / author / rating / date
   whenever the source provided them.
   ──────────────────────────────────────────────────────────────── */

function ReviewCard({ review, index }: { review: ReviewResult; index: number }) {
  const border = reviewBorder[review.sentiment];
  const snippet = (review.snippet && review.snippet.trim()) || review.headline;
  const hasRating = typeof review.rating === "number" && (review.rating as number) > 0;

  return (
    <motion.a
      href={review.url || "#"}
      target={review.url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={`block rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 border-l-4 ${border} hover:bg-card/80 hover:shadow-lg transition-all duration-300 group ${
        review.url ? "" : "cursor-default"
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={review.url ? { scale: 1.02 } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">
              {review.sentiment} · {review.confidence}% confidence
            </span>
            {hasRating && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                <Star className="w-3.5 h-3.5" />
                {(review.rating as number).toFixed(1)}
              </span>
            )}
          </div>

          <p className="text-sm text-foreground leading-snug mb-2 line-clamp-4 italic group-hover:text-primary transition-colors">
            &ldquo;{snippet}&rdquo;
          </p>

          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="font-medium">{review.source}</span>
            {review.author && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" />
                {review.author}
              </span>
            )}
            {review.date && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {review.date}
              </span>
            )}
          </div>
        </div>
        {review.url && (
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
        )}
      </div>
    </motion.a>
  );
}

/* ────────────────────────────────────────────────────────────────
   Main export
   ──────────────────────────────────────────────────────────────── */

export function RestaurantSection({ data }: RestaurantSectionProps) {
  if (data.status !== "success") {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-muted-foreground">
          No reviews found for this restaurant. Try checking the spelling or
          searching a more well-known location nearby.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="p-2 rounded-xl bg-primary/10">
          <Utensils className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Restaurant Analysis</p>
          <h2 className="text-xl font-bold text-foreground">{data.topic}</h2>
        </div>
      </motion.div>

      {/* Verdict + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RestaurantVerdictCard data={data} />
        <div className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <p className="text-sm font-semibold text-foreground mb-2">
            Sentiment Breakdown
          </p>
          <RestaurantPieChart data={data} />
        </div>
      </div>

      {/* Popular Dishes */}
      <PopularDishes dishes={data.popular_dishes || []} />

      {/* Top Praises / Top Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PraiseComplaintList title="Top Praises" items={data.pros} type="praise" />
        <PraiseComplaintList title="Top Complaints" items={data.cons} type="complaint" />
      </div>

      {/* Top Reviews */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Top Reviews
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.top_reviews.map((review, i) => (
            <ReviewCard key={i} review={review} index={i} />
          ))}
        </div>
        {data.top_reviews.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No individual reviews available for this restaurant yet.
          </p>
        )}
      </div>

      {/* Sources actually used */}
      <RestaurantSources results={data.results} />
    </div>
  );
}
