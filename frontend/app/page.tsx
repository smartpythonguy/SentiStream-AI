"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FloatingOrbs } from "@/components/floating-orbs";
import { AnimatedBackground } from "@/components/animated-background";
import { usePageTransition } from "@/context/transition-context";

// ─────────────────────────────────────────────
// Analysis categories — shared across HeroSection (selector) and the
// results dashboard (page.tsx) for category-specific rendering.
// "value" maps to the `category` query param and the backend `domain`.
// ─────────────────────────────────────────────
export const ANALYSIS_CATEGORIES = [
  {
    value: "news",
    label: "News & Politics",
    icon: "📰",
    placeholder: "e.g. Climate Policy, Elections",
  },
  {
    value: "products",
    label: "Products & Brands",
    icon: "🛒",
    placeholder: "e.g. iPhone 16, Samsung Galaxy S25",
  },
  {
    value: "restaurants",
    label: "Restaurants",
    icon: "🍽️",
    placeholder: "e.g. Paradise Biryani, Cafe Niloufer",
  },
  {
    value: "movies",
    label: "Movies & TV Shows",
    icon: "🎬",
    placeholder: "e.g. Pushpa 3, Squid Game, Wednesday, Stranger Things",
  },
] as const;

export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number]["value"];

// ─── Animation variants ───────────────────────────────────────────────────────

/**
 * The whole home page fades out when a domain is selected.
 * `exiting` state is set by TransitionContext after card click.
 */
const homePageVariants = {
  visible: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

export default function Home() {
  const { state } = usePageTransition();

  const scrollToAnalysis = () => {
    const analysisSection = document.getElementById("analysis");
    analysisSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {state !== "navigating" && (
        <motion.main
          className="relative min-h-screen overflow-x-hidden"
          variants={homePageVariants}
          initial="visible"
          animate={state === "exiting" ? "exit" : "visible"}
          exit="exit"
        >
          {/* Animated wave background */}
          <AnimatedBackground />

          {/* Floating background orbs */}
          <FloatingOrbs />

          {/* Subtle grid pattern overlay */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(oklch(0.55 0.2 250) 1px, transparent 1px),
                linear-gradient(90deg, oklch(0.55 0.2 250) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />

          {/* Navigation */}
          <Navbar onGetStartedClick={scrollToAnalysis} />

          {/* Hero Section with merged Analysis */}
          {/* HeroSection receives navigateToDashboard via usePageTransition() internally */}
          <HeroSection />
        </motion.main>
      )}
    </AnimatePresence>
  );
}
