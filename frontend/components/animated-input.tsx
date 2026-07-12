"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  domain?: "news" | "products" | null;
}

const newsSuggestions = [
  "us-iran",
  "russia-ukraine",
  "india-pakistan",
  "trump",
  "china-taiwan",
];

const productSuggestions = [
  "iPhone 16",
  "Pixel 9a",
  "Samsung S25",
  "Tesla",
  "PlayStation 5",
];

const newsPlaceholders = [
  "Search a news topic...",
  "Try: us-iran tensions...",
  "Try: russia-ukraine updates...",
  "Try: china-taiwan relations...",
  "Try: trump policies...",
];

const productPlaceholders = [
  "Search a product or brand...",
  "Try: iPhone 16 reviews...",
  "Try: Samsung S25 sentiment...",
  "Try: Tesla brand perception...",
  "Try: PlayStation 5 reactions...",
];

const defaultPlaceholders = [
  "Tesla stock market sentiment...",
  "Apple iPhone 16 reviews...",
  "2024 US election coverage...",
  "Climate change policies...",
  "Netflix subscription changes...",
  "AI technology trends...",
];

export function AnimatedInput({
  value,
  onChange,
  placeholder,
  onSubmit,
  domain,
}: AnimatedInputProps) {
  const placeholderList = domain === "news"
    ? newsPlaceholders
    : domain === "products"
      ? productPlaceholders
      : defaultPlaceholders;

  const suggestions = domain === "news"
    ? newsSuggestions
    : domain === "products"
      ? productSuggestions
      : [];

  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholderList[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [value, onSubmit]
  );

  // Reset placeholder when domain changes
  useEffect(() => {
    setCurrentPlaceholder(placeholderList[0]);
  }, [domain]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPlaceholder((prev) => {
          const currentIndex = placeholderList.indexOf(prev);
          const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % placeholderList.length;
          return placeholderList[nextIndex];
        });
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [value, placeholderList]);

  const staticPlaceholder = placeholder || (domain === "news"
    ? "Search a news topic..."
    : domain === "products"
      ? "Search a product or brand..."
      : "Search a topic...");

  return (
    <div className="w-full space-y-3">
      {/* Input field */}
      <div
        className={cn(
          "relative w-full rounded-2xl transition-all duration-300",
          "backdrop-blur-xl bg-white/50 border shadow-lg",
          isFocused
            ? "border-primary/50 shadow-primary/20 scale-[1.01]"
            : "border-white/50 shadow-primary/5"
        )}
      >
        {/* Animated glow */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-0 transition-opacity duration-300 -z-10 blur-xl",
            isFocused && "opacity-100"
          )}
        />

        <div className="flex items-center gap-4 px-6 py-4">
          <Search
            className={cn(
              "w-6 h-6 shrink-0 transition-colors duration-300",
              isFocused ? "text-primary" : "text-muted-foreground"
            )}
          />
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-transparent text-foreground text-lg outline-none placeholder:text-transparent"
              placeholder={staticPlaceholder}
            />
            {/* Animated placeholder */}
            {!value && (
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-lg pointer-events-none transition-all duration-300",
                  isAnimating && "opacity-0 -translate-y-full"
                )}
              >
                {currentPlaceholder}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
                "backdrop-blur-sm hover:scale-105 active:scale-95",
                value === chip
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/40 text-foreground/70 border-white/60 hover:bg-white/70 hover:text-foreground hover:border-primary/30 hover:shadow-sm"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
