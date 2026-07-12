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
   Verdict card — reused pattern from verdict-card.tsx, driven by
   dominant_sentiment + dominant_pct (count-based, not confidence-based)
   ──────────────────────────────────────────────────────────────── */

function RestaurantVerdictCard({ data }: { data: RestaurantAnalysis }) {
  const config = sentimentConfig[data.dominant_sentiment];
  const Icon = config.icon;

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
            {data.dominant_pct}
          </span>
          <span className="text-2xl text-muted-foreground">%</span>
          <Sparkles className="w-5 h-5 text-accent ml-2" />
        </div>

        <p className="text-muted-foreground leading-relaxed">
          {data.ai_summary}
        </p>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Sentiment distribution pie — same visual language as sentiment-pie-chart.tsx
   ──────────────────────────────────────────────────────────────── */

function RestaurantPieChart({ data }: { data: RestaurantAnalysis }) {
  const counts = { Positive: 0, Negative: 0, Neutral: 0 };
  for (const r of data.results) counts[r.sentiment]++;

  const chartData = [
    { name: "Positive", value: counts.Positive, color: COLORS.Positive },
    { name: "Negative", value: counts.Negative, color: COLORS.Negative },
    { name: "Neutral",  value: counts.Neutral,  color: COLORS.Neutral  },
  ];

  const config = sentimentConfig[data.dominant_sentiment];

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
            {data.dominant_pct}%
          </p>
          <p className="text-sm text-muted-foreground">
            {data.dominant_sentiment}
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
   Top Reviews — individual review cards, styled like headline-card.tsx
   ──────────────────────────────────────────────────────────────── */

function ReviewCard({ review, index }: { review: ReviewResult; index: number }) {
  const border = reviewBorder[review.sentiment];

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
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-muted-foreground">
              {review.sentiment} · {review.confidence}% confidence
            </span>
          </div>
          <h4 className="font-medium text-foreground text-sm leading-snug mb-2 line-clamp-3 group-hover:text-primary transition-colors">
            {review.headline}
          </h4>
          <span className="text-xs text-muted-foreground font-medium">
            {review.source}
          </span>
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
    </div>
  );
}
