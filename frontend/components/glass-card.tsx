"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "backdrop-blur-xl bg-white/40 border border-white/50 rounded-2xl shadow-lg shadow-primary/5",
        className
      )}
    >
      {children}
    </div>
  );
}
