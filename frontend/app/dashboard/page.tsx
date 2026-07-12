"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardNavbar } from "@/components/dashboard-navbar";
import { CategoryCard } from "@/components/category-card";
import { AnimatedInput } from "@/components/animated-input";
import { FloatingOrbs } from "@/components/floating-orbs";
import { AILoadingScreen } from "@/components/ai-loading-screen";
import { Button } from "@/components/ui/button";
import { Newspaper, ShoppingBag, Sparkles, ArrowRight } from "lucide-react";

const STORAGE_KEYS = {
  news: "sentistream_last_topic_news",
  products: "sentistream_last_topic_products",
} as const;

export default function DashboardPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<
    "news" | "products" | null
  >(null);
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // When category changes, restore the last topic for that domain
  const handleCategorySelect = useCallback(
    (category: "news" | "products") => {
      // Save current topic to the previous domain before switching
      if (selectedCategory && topic) {
        localStorage.setItem(STORAGE_KEYS[selectedCategory], topic);
      }

      setSelectedCategory(category);

      // Restore last topic for the newly selected domain
      const saved = localStorage.getItem(STORAGE_KEYS[category]);
      setTopic(saved ?? "");
    },
    [selectedCategory, topic]
  );

  // Persist topic on every change
  const handleTopicChange = useCallback(
    (value: string) => {
      setTopic(value);
      if (selectedCategory) {
        localStorage.setItem(STORAGE_KEYS[selectedCategory], value);
      }
    },
    [selectedCategory]
  );

  const handleAnalyze = useCallback(() => {
    if (!selectedCategory || !topic) return;

    setIsLoading(true);

    setTimeout(() => {
      router.push(
        `/results?topic=${encodeURIComponent(topic)}&category=${selectedCategory}`
      );
    }, 2000);
  }, [selectedCategory, topic, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedCategory && topic) {
        handleAnalyze();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCategory, topic, handleAnalyze]);

  if (isLoading) {
    return <AILoadingScreen mode={selectedCategory || "news"} />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background elements */}
      <FloatingOrbs />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <DashboardNavbar />

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Analysis
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
              What would you like to{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                analyze
              </span>
              ?
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Choose a category and enter your topic to get real-time sentiment
              insights
            </p>
          </div>

          {/* Category Cards */}
          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 animate-fade-in-up animation-delay-200">
            <CategoryCard
              icon={<Newspaper className="w-8 h-8" />}
              title="News & Politics"
              description="Analyze sentiment from news articles, political coverage, and current events worldwide"
              isSelected={selectedCategory === "news"}
              onClick={() => handleCategorySelect("news")}
              gradient="blue"
            />
            <CategoryCard
              icon={<ShoppingBag className="w-8 h-8" />}
              title="Products & Brands"
              description="Track brand perception, product reviews, and consumer sentiment across platforms"
              isSelected={selectedCategory === "products"}
              onClick={() => handleCategorySelect("products")}
              gradient="orange"
            />
          </div>

          {/* Input Section */}
          <div className="w-full max-w-2xl space-y-6 animate-fade-in-up animation-delay-400">
            <AnimatedInput
              value={topic}
              onChange={handleTopicChange}
              onSubmit={handleAnalyze}
              domain={selectedCategory}
            />

            <Button
              onClick={handleAnalyze}
              disabled={!selectedCategory || !topic}
              className="w-full py-6 text-lg font-semibold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-xl shadow-primary/30 transition-all duration-200 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Analyze Sentiment
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            {/* Helper text */}
            <p className="text-center text-muted-foreground text-sm">
              {!selectedCategory
                ? "Select a category above to continue"
                : !topic
                  ? "Enter a topic to start analyzing"
                  : "Ready to analyze your topic"}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
