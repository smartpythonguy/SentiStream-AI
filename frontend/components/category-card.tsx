"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePageTransition } from "@/context/transition-context";

interface CategoryCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  gradient: "blue" | "orange" | "green" | "purple" | "pink";
  categoryValue: string;
}

export function CategoryCard({
  icon,
  title,
  description,
  isSelected,
  onClick,
  gradient,
  categoryValue,
}: CategoryCardProps) {
  const { state, selectedCardId } = usePageTransition();

  const isThisSelected = selectedCardId === categoryValue;
  const isAnotherSelected = state === "exiting" && !isThisSelected;

  const gradientMap = {
    blue:   { selected: "bg-primary/10 border-primary/30 shadow-primary/20 focus:ring-primary/50", glow: "bg-primary/20", icon: "from-primary to-primary/70 shadow-primary/30", indicator: "border-primary bg-primary" },
    orange: { selected: "bg-accent/10 border-accent/30 shadow-accent/20 focus:ring-accent/50",   glow: "bg-accent/20",   icon: "from-accent to-accent/70 shadow-accent/30",   indicator: "border-accent bg-accent"   },
    green:  { selected: "bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/20 focus:ring-emerald-500/50", glow: "bg-emerald-500/20", icon: "from-emerald-500 to-emerald-500/70 shadow-emerald-500/30", indicator: "border-emerald-500 bg-emerald-500" },
    purple: { selected: "bg-purple-500/10 border-purple-500/30 shadow-purple-500/20 focus:ring-purple-500/50",     glow: "bg-purple-500/20",   icon: "from-purple-500 to-purple-500/70 shadow-purple-500/30",   indicator: "border-purple-500 bg-purple-500"   },
    pink:   { selected: "bg-pink-500/10 border-pink-500/30 shadow-pink-500/20 focus:ring-pink-500/50",             glow: "bg-pink-500/20",     icon: "from-pink-500 to-pink-500/70 shadow-pink-500/30",         indicator: "border-pink-500 bg-pink-500"       },
  };

  const g = gradientMap[gradient] ?? gradientMap.blue;

  return (
    <motion.button
      onClick={onClick}
      // Zoom the selected card, fade siblings
      animate={
        isThisSelected
          ? { scale: 1.08, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }
          : isAnotherSelected
          ? { opacity: 0, transition: { duration: 0.3 } }
          : { scale: 1, opacity: 1 }
      }
      whileHover={state === "idle" ? { scale: 1.02, y: -4 } : undefined}
      whileTap={state === "idle" ? { scale: 0.98 } : undefined}
      style={{ zIndex: isThisSelected ? 10 : 1, position: "relative", originX: 0.5, originY: 0.5 }}
      className={cn(
        "group w-full p-6 rounded-3xl text-left",
        "backdrop-blur-xl border shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        isSelected ? g.selected : "bg-white/40 border-white/50 hover:bg-white/60 shadow-primary/5 focus:ring-primary/30"
      )}
    >
      {/* Glow on hover */}
      <div className={cn("absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl", g.glow)} />

      {/* Icon */}
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br shadow-lg", g.icon)}>
        <div className="text-white">{icon}</div>
      </div>

      {/* Content */}
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>

      {/* Selection indicator */}
      <div className={cn("absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300", isSelected ? g.indicator : "border-muted-foreground/30 bg-transparent")}>
        {isSelected && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </motion.button>
  );
}
