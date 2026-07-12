"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";

interface VerdictCardProps {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  summary: string;
}

const sentimentConfig = {
  positive: {
    icon: TrendingUp,
    label: "Positive Sentiment",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowColor: "shadow-green-500/20",
  },
  negative: {
    icon: TrendingDown,
    label: "Negative Sentiment",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    glowColor: "shadow-red-500/20",
  },
  neutral: {
    icon: Minus,
    label: "Neutral Sentiment",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    glowColor: "shadow-slate-500/20",
  },
};

export function VerdictCard({ sentiment, score, summary }: VerdictCardProps) {
  const config = sentimentConfig[sentiment];
  const Icon = config.icon;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl border ${config.borderColor} ${config.bgColor} p-6 backdrop-blur-md shadow-xl ${config.glowColor}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />

      <div className="relative z-10">
        {/* Header */}
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

        {/* Score */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-bold text-foreground">{score}</span>
          <span className="text-2xl text-muted-foreground">/100</span>
          <Sparkles className="w-5 h-5 text-accent ml-2" />
        </div>

        {/* Summary */}
        <p className="text-muted-foreground leading-relaxed">{summary}</p>
      </div>
    </motion.div>
  );
}
