"use client";

import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
}

interface SentimentPieChartProps {
  data: SentimentData;
  /** Which sentiment won — drives the center label. */
  dominantSentiment: "positive" | "negative" | "neutral";
  /** The percentage to display in the center label. */
  dominantPct: number;
}

const COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral:  "#94a3b8",
};

const DOMINANT_LABEL: Record<"positive" | "negative" | "neutral", string> = {
  positive: "Positive",
  negative: "Negative",
  neutral:  "Neutral",
};

const DOMINANT_TEXT_COLOR: Record<"positive" | "negative" | "neutral", string> = {
  positive: "text-green-500",
  negative: "text-red-500",
  neutral:  "text-slate-400",
};

export function SentimentPieChart({
  data,
  dominantSentiment,
  dominantPct,
}: SentimentPieChartProps) {
  const chartData = [
    { name: "Positive", value: data.positive, color: COLORS.positive },
    { name: "Negative", value: data.negative, color: COLORS.negative },
    { name: "Neutral",  value: data.neutral,  color: COLORS.neutral  },
  ];

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
            formatter={(value: number) => [`${value}%`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label — always reflects the dominant sentiment */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className={`text-3xl font-bold ${DOMINANT_TEXT_COLOR[dominantSentiment]}`}>
            {dominantPct}%
          </p>
          <p className="text-sm text-muted-foreground">
            {DOMINANT_LABEL[dominantSentiment]}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
