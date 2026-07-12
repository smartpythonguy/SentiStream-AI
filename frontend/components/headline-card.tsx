"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

interface HeadlineCardProps {
  title: string;
  source: string;
  date: string;
  url?: string;
  sentiment: "positive" | "negative" | "neutral";
  index: number;
}

export function HeadlineCard({
  title,
  source,
  date,
  url = "#",
  sentiment,
  index,
}: HeadlineCardProps) {
  const borderColor = {
    positive: "border-l-green-500",
    negative: "border-l-red-500",
    neutral: "border-l-slate-400",
  }[sentiment];

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 border-l-4 ${borderColor} hover:bg-card/80 hover:shadow-lg transition-all duration-300 group`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{source}</span>
            {date && (
              <>
                <span>•</span>
                <span>{date}</span>
              </>
            )}
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
      </div>
    </motion.a>
  );
}
