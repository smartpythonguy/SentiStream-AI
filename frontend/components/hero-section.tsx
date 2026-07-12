"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { GlassCard } from "./glass-card";
import { CategoryCard } from "./category-card";
import { AnimatedInput } from "./animated-input";
import { TransitionScreen } from "./transition-screen";
import { usePageTransition } from "@/context/transition-context";
import {
  ArrowRight,
  Zap,
  Sparkles,
  Newspaper,
  ShoppingBag,
  UtensilsCrossed,
  Clapperboard,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AnalysisCategory = "news" | "products" | "restaurants" | "movies";

// ─── Per-domain localStorage keys ────────────────────────────────────────────
const STORAGE_KEYS: Record<AnalysisCategory, string> = {
  news:        "sentistream_last_topic_news",
  products:    "sentistream_last_topic_products",
  restaurants: "sentistream_last_topic_restaurants",
  movies:      "sentistream_last_topic_movies",
};

// ─── Static fallback topics (shown while fetching or on error) ────────────────
const FALLBACK_TOPICS: Record<AnalysisCategory, string[]> = {
  news:        ["Trump", "Russia-Ukraine", "India-Pakistan", "Climate Policy", "Gaza"],
  products:    ["iPhone 16", "Samsung S25", "Pixel 9a", "Tesla Model Y", "PS5"],
  restaurants: ["McDonald's", "Starbucks", "Domino's", "Subway", "KFC"],
  movies:      ["Pushpa 2", "Squid Game", "Wednesday", "Stranger Things", "Deadpool"],
};

// ─── Category config ──────────────────────────────────────────────────────────
interface CategoryConfig {
  value: AnalysisCategory;
  iconName: "Newspaper" | "ShoppingBag" | "UtensilsCrossed" | "Clapperboard";
  title: string;
  description: string;
  examples: string[];
  gradient: "blue" | "orange" | "green" | "purple" | "pink";
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    value: "news",
    iconName: "Newspaper",
    title: "News & Politics",
    description: "Analyze sentiment from news articles, political coverage, and current events worldwide",
    examples: ["US-Iran", "Climate Policy", "Elections", "NATO"],
    gradient: "blue",
  },
  {
    value: "products",
    iconName: "ShoppingBag",
    title: "Products & Brands",
    description: "Track brand perception, product reviews, and consumer sentiment across platforms",
    examples: ["iPhone 16", "Samsung Galaxy S25", "PS5", "Tesla Model Y"],
    gradient: "purple",
  },
  {
    value: "restaurants",
    iconName: "UtensilsCrossed",
    title: "Restaurants",
    description: "Gauge diner sentiment from reviews and food coverage for any restaurant or cuisine",
    examples: ["Paradise Biryani", "Cafe Niloufer", "Mehfil", "McDonald's"],
    gradient: "orange",
  },
  {
    value: "movies",
    iconName: "Clapperboard",
    title: "Movies & TV Shows",
    description: "Gauge audience and critic sentiment for any film, series, or streaming show worldwide",
    examples: ["Pushpa 3", "Squid Game", "Wednesday", "Stranger Things"],
    gradient: "pink",
  },
];

// ─── Page-level fade-out variant ──────────────────────────────────────────────
const pageFadeVariants = {
  visible: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function HeroSection() {
  const { state, navigateToDashboard } = usePageTransition();
  const analysisRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<AnalysisCategory | null>(null);
  const [topic, setTopic] = useState("");
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  // Controls whether the full-screen transition is showing
  const [showTransition, setShowTransition] = useState(false);
  // Stores the href to navigate to once the transition completes
  const pendingHref = useRef<string>("");

  const scrollToAnalysis = () => {
    analysisRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Fetch trending topics whenever domain changes ─────────────────────────
  useEffect(() => {
    if (!selectedCategory) return;
    let cancelled = false;
    // Show fallbacks immediately so the UI never looks empty
    setTrendingTopics(FALLBACK_TOPICS[selectedCategory]);
    fetch(`/api/trending?domain=${selectedCategory}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.topics?.length) {
          setTrendingTopics(data.topics.slice(0, 6));
        }
      })
      .catch(() => { /* keep fallbacks */ });
    return () => { cancelled = true; };
  }, [selectedCategory]);

  const handleCategorySelect = useCallback(
    (category: AnalysisCategory) => {
      if (selectedCategory && topic) {
        localStorage.setItem(STORAGE_KEYS[selectedCategory], topic);
      }
      setSelectedCategory(category);
      const saved = localStorage.getItem(STORAGE_KEYS[category]);
      setTopic(saved ?? "");
      // Auto-scroll to the search bar
      setTimeout(() => {
        searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    },
    [selectedCategory, topic]
  );

  const handleTopicChange = useCallback(
    (value: string) => {
      setTopic(value);
      if (selectedCategory) {
        localStorage.setItem(STORAGE_KEYS[selectedCategory], value);
      }
    },
    [selectedCategory]
  );

  // ── Main analyze handler — shows transition screen first, then navigates ──
  const handleAnalyze = useCallback(() => {
    if (!selectedCategory || !topic.trim()) return;

    const href = `/results?topic=${encodeURIComponent(topic.trim())}&category=${selectedCategory}`;
    pendingHref.current = href;

    // Show the domain-themed transition screen
    setShowTransition(true);
  }, [selectedCategory, topic]);

  // Called by TransitionScreen when its animation finishes
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    if (pendingHref.current) {
      navigateToDashboard(pendingHref.current, selectedCategory!);
    }
  }, [navigateToDashboard, selectedCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedCategory && topic.trim() && !showTransition) {
        handleAnalyze();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCategory, topic, handleAnalyze, showTransition]);

  const selectedConfig = CATEGORY_CONFIG.find((c) => c.value === selectedCategory);

  function resolveIcon(iconName: CategoryConfig["iconName"]) {
    const cls = "w-8 h-8";
    switch (iconName) {
      case "Newspaper":       return <Newspaper       className={cls} />;
      case "ShoppingBag":     return <ShoppingBag     className={cls} />;
      case "UtensilsCrossed": return <UtensilsCrossed className={cls} />;
      case "Clapperboard":    return <Clapperboard    className={cls} />;
    }
  }

  return (
    <>
      {/* ── Full-screen domain transition overlay ── */}
      <AnimatePresence>
        {showTransition && selectedCategory && (
          <TransitionScreen
            key="transition"
            domain={selectedCategory}
            onComplete={handleTransitionComplete}
          />
        )}
      </AnimatePresence>

      {/* ── Main page content ── */}
      <motion.div
        variants={pageFadeVariants}
        initial="visible"
        animate={state === "exiting" ? "exit" : "visible"}
      >
        {/* ── Hero Section ── */}
        <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-6xl mx-auto text-center z-10">
            {/* Badge */}
            <GlassCard className="inline-flex items-center gap-2 px-4 py-2 mb-8 animate-fade-in">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground/80">
                Powered by Advanced AI
              </span>
            </GlassCard>

            {/* Main Title */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-in-up">
              <span className="text-foreground">Welcome to </span>
              <span className="text-foreground">Senti</span>
              <span className="text-primary">Stream</span>
              <span className="text-accent"> AI</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-200 text-balance">
              Understand the world&apos;s emotions in real time.
            </p>

            {/* CTA */}
            <div className="flex items-center justify-center mb-16 animate-fade-in-up animation-delay-400">
              <Button
                size="lg"
                onClick={scrollToAnalysis}
                className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground px-10 py-6 text-lg font-semibold rounded-full shadow-xl shadow-primary/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-600">
              <GlassCard className="relative overflow-hidden h-64 hover:scale-105 transition-transform duration-300 group">
                <Image src="/images/nlp-ai.jpg" alt="NLP visualization" fill className="object-cover opacity-40 group-hover:opacity-50 group-hover:scale-110 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">NLP</h3>
                  <p className="text-muted-foreground text-sm">&quot;Language is the roadmap of a culture.&quot;</p>
                </div>
              </GlassCard>

              <GlassCard className="relative overflow-hidden h-64 hover:scale-105 transition-transform duration-300 group">
                <Image src="/images/ml-ai.jpg" alt="Machine Learning visualization" fill className="object-cover opacity-40 group-hover:opacity-50 group-hover:scale-110 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">Machine Learning</h3>
                  <p className="text-muted-foreground text-sm">&quot;Machines that learn, minds that grow.&quot;</p>
                </div>
              </GlassCard>

              <GlassCard className="relative overflow-hidden h-64 hover:scale-105 transition-transform duration-300 group">
                <Image src="/images/sentiment-ai.jpg" alt="Sentiment Analysis visualization" fill className="object-cover opacity-40 group-hover:opacity-50 group-hover:scale-110 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">Sentiment Analysis</h3>
                  <p className="text-muted-foreground text-sm">&quot;Every word carries an emotion.&quot;</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* ── Analysis Section ── */}
        <section
          ref={analysisRef}
          id="analysis"
          className="relative min-h-screen flex items-center justify-center px-4 py-20 scroll-mt-20"
        >
          <div className="max-w-4xl mx-auto w-full z-10">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                AI-Powered Analysis
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
                What would you like to{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  analyze
                </span>
                ?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Choose a category and enter your topic to get real-time sentiment insights
              </p>
            </div>

            {/* ── Category Cards ── */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {CATEGORY_CONFIG.map((cat) => (
                <CategoryCard
                  key={cat.value}
                  categoryValue={cat.value}
                  icon={resolveIcon(cat.iconName)}
                  title={cat.title}
                  description={cat.description}
                  isSelected={selectedCategory === cat.value}
                  onClick={() => handleCategorySelect(cat.value)}
                  gradient={cat.gradient}
                />
              ))}
            </div>

            {/* ── Trending topic chips ── */}
            {selectedCategory && trendingTopics.length > 0 && (
              <div className="mb-6 animate-fade-in">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
                  Trending in {selectedConfig?.title}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {trendingTopics.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => handleTopicChange(ex)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 hover:scale-105 active:scale-95 ${
                        topic === ex
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                          : "bg-card/60 text-foreground border-border/50 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input + Analyze button ── */}
            <div ref={searchRef} className="w-full space-y-6">
              <AnimatedInput
                value={topic}
                onChange={handleTopicChange}
                domain={selectedCategory as "news" | "products" | null}
              />

              <Button
                onClick={handleAnalyze}
                disabled={!selectedCategory || !topic.trim()}
                className="w-full py-6 text-lg font-semibold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Analyze Sentiment
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-center text-muted-foreground text-sm">
                {!selectedCategory
                  ? "Select a category above to continue"
                  : !topic.trim()
                    ? `Enter a topic or pick an example above`
                    : `Ready to analyze "${topic}" in ${selectedConfig?.title}`}
              </p>
            </div>
          </div>
        </section>
      </motion.div>
    </>
  );
}
