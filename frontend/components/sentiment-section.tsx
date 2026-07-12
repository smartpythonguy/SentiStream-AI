"use client";

import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

interface SentimentItem {
  text: string;
  source: string;
  date: string;
}

interface SentimentSectionProps {
  type: "positive" | "negative" | "neutral";
  items: SentimentItem[];
  count: number;
}

const sectionConfig = {
  positive: {
    icon: ThumbsUp,
    label: "Positive",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    dotColor: "bg-green-500",
  },
  negative: {
    icon: ThumbsDown,
    label: "Negative",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    dotColor: "bg-red-500",
  },
  neutral: {
    icon: Minus,
    label: "Neutral",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    dotColor: "bg-slate-500",
  },
};

export function SentimentSection({
  type,
  items,
  count,
}: SentimentSectionProps) {
  const config = sectionConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      className={`rounded-2xl border ${config.borderColor} bg-card/50 backdrop-blur-sm p-5 hover:shadow-lg transition-shadow duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <span className={`font-semibold ${config.color}`}>
            {config.label}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">{count} mentions</span>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={index}
            className="relative pl-4 border-l-2 border-border/50"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div className={`absolute left-[-5px] top-2 w-2 h-2 rounded-full ${config.dotColor}`} />
            <p className="text-sm text-foreground leading-relaxed">
              {`"${item.text}"`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{item.source}</span>
              <span className="text-xs text-muted-foreground/50">|</span>
              <span className="text-xs text-muted-foreground">{item.date}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
