"use client";

import { motion } from "framer-motion";
import { Star, User } from "lucide-react";

interface ReviewCardProps {
  author: string;
  rating: number;
  text: string;
  date: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
}

const sentimentColors = {
  positive: "border-green-500/30 bg-green-500/5",
  negative: "border-red-500/30 bg-red-500/5",
  neutral: "border-slate-500/30 bg-slate-500/5",
};

export function ReviewCard({
  author,
  rating,
  text,
  date,
  source,
  sentiment,
}: ReviewCardProps) {
  return (
    <motion.div
      className={`rounded-2xl border ${sentimentColors[sentiment]} backdrop-blur-sm p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{author}</p>
            <p className="text-xs text-muted-foreground">{source}</p>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < rating
                  ? "text-amber-400 fill-amber-400"
                  : "text-slate-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Review text */}
      <p className="text-sm text-foreground/80 leading-relaxed mb-3">
        {`"${text}"`}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{date}</p>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            sentiment === "positive"
              ? "text-green-500 bg-green-500/10"
              : sentiment === "negative"
              ? "text-red-500 bg-red-500/10"
              : "text-slate-400 bg-slate-500/10"
          }`}
        >
          {sentiment}
        </span>
      </div>
    </motion.div>
  );
}
