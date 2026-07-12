"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// ─── Domain config ────────────────────────────────────────────────────────────
export type TransitionDomain = "news" | "products" | "restaurants" | "movies";

interface DomainConfig {
  accent: string;
  accentSoft: string;
  second: string;
  bg: string;
  bgAlt: string;
  label: string;
  sublabel: string;
  messages: string[];
  emojiBg: string[];
}

const DOMAIN_CONFIG: Record<TransitionDomain, DomainConfig> = {
  news: {
    accent:     "#3B82F6",
    accentSoft: "#BFDBFE",
    second:     "#F97316",
    bg:         "#EEF4FF",
    bgAlt:      "#E6EFFF",
    label:      "Global Intelligence",
    sublabel:   "NEWS",
    messages: [
      "Scanning global headlines...",
      "Collecting trusted sources...",
      "Detecting public sentiment...",
      "Building AI news insights...",
      "Preparing your report...",
    ],
    emojiBg: ["🌍", "📰", "📡", "🗞️", "📻"],
  },
  movies: {
    accent:     "#EF4444",
    accentSoft: "#FECACA",
    second:     "#F59E0B",
    bg:         "#FFF5F5",
    bgAlt:      "#FEF2F2",
    label:      "Entertainment Analysis",
    sublabel:   "MOVIES & TV",
    messages: [
      "Reading audience reviews...",
      "Checking critic ratings...",
      "Finding top performances...",
      "Analyzing viewer reactions...",
      "Generating movie insights...",
    ],
    emojiBg: ["🎬", "🎥", "🍿", "🎞️", "🎭"],
  },
  products: {
    accent:     "#8B5CF6",
    accentSoft: "#DDD6FE",
    second:     "#EC4899",
    bg:         "#F5F3FF",
    bgAlt:      "#EDE9FE",
    label:      "Consumer Insights",
    sublabel:   "PRODUCTS",
    messages: [
      "Collecting customer reviews...",
      "Comparing product ratings...",
      "Analyzing buying opinions...",
      "Processing user feedback...",
      "Preparing shopping insights...",
    ],
    emojiBg: ["🛍️", "📦", "⭐", "🚚", "🏷️"],
  },
  restaurants: {
    accent:     "#F97316",
    accentSoft: "#FED7AA",
    second:     "#EAB308",
    bg:         "#FFF7ED",
    bgAlt:      "#FFEDD5",
    label:      "Dining Intelligence",
    sublabel:   "RESTAURANTS",
    messages: [
      "Reading diner reviews...",
      "Checking food quality scores...",
      "Analyzing customer experience...",
      "Sampling opinion data...",
      "Preparing restaurant recommendation...",
    ],
    emojiBg: ["🍽️", "🍴", "🥗", "👨‍🍳", "🌟"],
  },
};

// ─── Sentiment emojis (rain) ──────────────────────────────────────────────────
const SENTIMENT_EMOJIS = ["😊", "😔", "😠", "😐"];

interface RainDrop {
  id: number;
  emoji: string;
  left: string;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
}

function EmojiRain({ count = 18 }: { count?: number }) {
  const drops = useMemo<RainDrop[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: SENTIMENT_EMOJIS[i % SENTIMENT_EMOJIS.length],
      left: `${(i * 5.5 + 2) % 96}%`,
      duration: 6 + (i % 5) * 1.2,
      delay: (i * 0.38) % 5,
      size: 18 + (i % 4) * 6,
      opacity: 0.15 + (i % 3) * 0.07,
    })), [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map(d => (
        <motion.span
          key={d.id}
          className="absolute select-none"
          style={{
            left: d.left,
            top: "-60px",
            fontSize: d.size,
            opacity: d.opacity,
            filter: "saturate(0.6)",
          }}
          animate={{ y: ["0vh", "110vh"], opacity: [0, d.opacity, d.opacity, 0] }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.05, 0.92, 1],
          }}
        >
          {d.emoji}
        </motion.span>
      ))}
    </div>
  );
}

// ─── Background emoji icons (domain-specific) ────────────────────────────────
interface BgIconProps {
  icons: string[];
  accent: string;
}

function BackgroundIcons({ icons, accent }: BgIconProps) {
  const slots = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      icon: icons[i % icons.length],
      left: `${(i * 8.3 + 3) % 90}%`,
      top: `${(i * 7.7 + 5) % 88}%`,
      size: 24 + (i % 4) * 10,
      opacity: 0.06 + (i % 3) * 0.03,
      duration: 8 + (i % 5) * 2,
      delay: i * 0.6,
    })), [icons]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {slots.map(s => (
        <motion.span
          key={s.id}
          className="absolute select-none"
          style={{
            left: s.left,
            top: s.top,
            fontSize: s.size,
            opacity: s.opacity,
          }}
          animate={{
            y: [0, -18, 0],
            rotate: [0, s.id % 2 === 0 ? 8 : -8, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {s.icon}
        </motion.span>
      ))}
    </div>
  );
}

// ─── Ambient glow particles ───────────────────────────────────────────────────
function AmbientParticles({ accent, second, count = 20 }: { accent: string; second: string; count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${4 + (i * 4.7) % 92}%`,
      y: `${5 + (i * 6.3) % 90}%`,
      color: i % 3 === 0 ? accent : i % 3 === 1 ? second : "#818CF8",
      size: 2 + (i % 3),
      duration: 5 + (i % 5) * 1.1,
      delay: (i * 0.28) % 4,
      driftX: ((i % 5) - 2) * 16,
    })), [accent, second, count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.color }}
          animate={{ y: [0, -34, 0], x: [0, p.driftX, 0], opacity: [0.07, 0.42, 0.07], scale: [1, 1.9, 1] }}
          transition={{ duration: p.duration * 1.8, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Glowing background blobs ─────────────────────────────────────────────────
function GlowBlobs({ accent, second }: { accent: string; second: string }) {
  return (
    <>
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 700, height: 700, top: "-20%", left: "-15%",
          background: `radial-gradient(circle, ${accent}18 0%, transparent 60%)`,
          filter: "blur(72px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 600, height: 600, bottom: "-15%", right: "-10%",
          background: `radial-gradient(circle, ${second}14 0%, transparent 60%)`,
          filter: "blur(72px)",
        }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 400, height: 400, top: "30%", right: "20%",
          background: `radial-gradient(circle, ${accent}0E 0%, transparent 60%)`,
          filter: "blur(56px)",
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
    </>
  );
}

// ─── Scanning cursor ──────────────────────────────────────────────────────────
function ScanningCursor({ accent }: { accent: string }) {
  return (
    <div className="relative" style={{ width: 72, height: 72 }}>
      {/* Outer pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${accent}`, opacity: 0.3 }}
        animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Second ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: `1.5px solid ${accent}`, opacity: 0.5 }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.1, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
      />
      {/* Rotating sweep arc */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 75%, ${accent}CC 100%)`,
          }}
        />
      </motion.div>
      {/* Center dot */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 10, height: 10,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: accent,
          boxShadow: `0 0 12px ${accent}`,
        }}
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Cross hairs */}
      <div
        className="absolute"
        style={{
          top: "50%", left: "50%",
          width: 28, height: 1,
          transform: "translate(-50%, -50%)",
          background: `linear-gradient(90deg, transparent, ${accent}80, transparent)`,
        }}
      />
      <div
        className="absolute"
        style={{
          top: "50%", left: "50%",
          width: 1, height: 28,
          transform: "translate(-50%, -50%)",
          background: `linear-gradient(180deg, transparent, ${accent}80, transparent)`,
        }}
      />
    </div>
  );
}

// ─── Scan sweep line ──────────────────────────────────────────────────────────
function ScanLine({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}50, ${accent}70, ${accent}50, transparent)` }}
        animate={{ top: ["3%", "97%"] }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ accent, duration }: { accent: string; duration: number }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 4, background: `${accent}1A`, maxWidth: 340 }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}80, ${accent})` }}
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: duration / 1000, ease: "easeInOut" }}
      />
    </div>
  );
}

// ─── Rotating messages ────────────────────────────────────────────────────────
function RotatingMessages({ messages, accent }: { messages: string[]; accent: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % messages.length), 2000);
    return () => clearInterval(t);
  }, [messages]);

  const textColor = "#1A3358";
  const mutedColor = "#5A7899";

  return (
    <div className="flex flex-col items-center gap-4" style={{ minWidth: 320 }}>
      {/* Message pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(5px)" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex items-center gap-3 rounded-2xl px-6 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(244,248,255,0.88))",
            border: `1px solid ${accent}28`,
            backdropFilter: "blur(18px)",
            boxShadow: `0 2px 20px ${accent}09`,
          }}
        >
          {/* Pulse dot */}
          <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
            <motion.div
              className="absolute rounded-full"
              style={{ width: 16, height: 16, background: `${accent}20` }}
              animate={{ scale: [1, 1.9, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
          </div>
          <span style={{
            color: textColor,
            fontSize: 13,
            fontFamily: "'DM Mono', 'Fira Code', monospace",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}>
            {messages[idx]}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Step pills */}
      <div className="flex items-center gap-1.5">
        {messages.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              width: i === idx ? 22 : 5,
              background: i < idx ? accent : i === idx ? accent : "#9BB5CE",
              opacity: i === idx ? 1 : i < idx ? 0.55 : 0.22,
            }}
            style={{ height: 4 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Percentage */}
      <ProgressBar accent={accent} duration={messages.length * 2000} />
    </div>
  );
}

// ─── Center logo orb ──────────────────────────────────────────────────────────
function LogoOrb({ accent, second }: { accent: string; second: string }) {
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            inset: `-${(i + 1) * 24}px`,
            border: `1px solid ${accent}`,
            opacity: 0.10 - i * 0.025,
          }}
          animate={{ scale: [1, 1.07 + i * 0.02, 1], opacity: [0.10 - i * 0.025, 0.02, 0.10 - i * 0.025] }}
          transition={{ duration: 5 + i * 0.9, delay: i * 0.45, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: -7, background: `conic-gradient(from 0deg, transparent 52%, ${accent}CC, transparent)` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ inset: -3, background: `conic-gradient(from 180deg, transparent 62%, ${second}88, transparent)` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          width: 100, height: 100,
          background: "radial-gradient(circle at 40% 35%, #FFFFFF 55%, #E8EFFF)",
          border: `1.5px solid ${accent}38`,
          boxShadow: `0 0 30px ${accent}22, 0 0 70px ${accent}0A`,
        }}
        animate={{ scale: [1, 1.032, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/logo.svg"
          alt="SentiStream"
          width={66}
          height={66}
          priority
          style={{ objectFit: "contain" }}
        />
      </motion.div>
    </div>
  );
}

// ─── NEWS-specific: World Map SVG ─────────────────────────────────────────────
function WorldMapSVG() {
  return (
    <svg
      viewBox="0 0 1000 500"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", opacity: 0.1 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <path fill="#3B82F6" d="M 120 60 L 200 50 L 260 70 L 280 120 L 250 170 L 210 200 L 180 230 L 150 210 L 110 180 L 90 140 L 100 90 Z" />
      <path fill="#3B82F6" d="M 200 260 L 240 250 L 270 280 L 275 340 L 255 400 L 220 430 L 195 400 L 185 340 L 190 290 Z" />
      <path fill="#3B82F6" d="M 440 55 L 510 50 L 540 75 L 530 110 L 490 130 L 450 125 L 430 100 L 435 70 Z" />
      <path fill="#3B82F6" d="M 450 155 L 520 145 L 555 175 L 560 250 L 540 330 L 500 380 L 460 370 L 430 310 L 420 230 L 430 170 Z" />
      <path fill="#3B82F6" d="M 545 45 L 700 35 L 800 60 L 830 110 L 800 160 L 730 190 L 640 185 L 580 160 L 550 120 L 540 75 Z" />
      <path fill="#3B82F6" d="M 650 190 L 700 210 L 710 270 L 680 300 L 650 270 L 640 220 Z" />
      <path fill="#3B82F6" d="M 760 300 L 840 290 L 880 320 L 875 380 L 830 410 L 770 400 L 745 360 L 750 320 Z" />
      {/* Connection arcs */}
      <motion.path d="M 155 120 Q 320 20 480 85" fill="none" stroke="#3B82F6" strokeWidth="1"
        strokeDasharray="6 4" animate={{ strokeDashoffset: [0, -40] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
      <motion.path d="M 480 85 Q 580 40 670 120" fill="none" stroke="#3B82F6" strokeWidth="1"
        strokeDasharray="6 4" animate={{ strokeDashoffset: [0, -40] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: 0.5 }} />
      <motion.path d="M 670 120 Q 740 70 810 100" fill="none" stroke="#F97316" strokeWidth="1"
        strokeDasharray="6 4" animate={{ strokeDashoffset: [0, -40] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "linear", delay: 1 }} />
      {/* Dot grid */}
      <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="#3B82F6" opacity="0.3" />
      </pattern>
      <rect width="1000" height="500" fill="url(#dots)" opacity="0.4" />
    </svg>
  );
}

// ─── NEWS: Floating headline ticker ───────────────────────────────────────────
const FAKE_HEADLINES = [
  "Fed signals rate pause amid cooling inflation",
  "EU tightens AI regulation framework for 2025",
  "Semiconductor exports surge after trade deals",
  "NHS adopts AI diagnostics across 40 hospitals",
  "Climate summit reaches binding carbon accord",
  "Startup ecosystem attracts $4.2B in funding",
  "Central bank holds rates; housing worsens",
  "Samsung unveils next-gen chip amid revival",
];

function NewsTickerBanner({ accent }: { accent: string }) {
  const items = [...FAKE_HEADLINES, ...FAKE_HEADLINES];
  return (
    <div
      className="absolute bottom-0 left-0 right-0 overflow-hidden"
      style={{
        height: 32,
        background: `linear-gradient(90deg, ${accent}12, ${accent}08, ${accent}12)`,
        borderTop: `1px solid ${accent}20`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <motion.div
        className="flex items-center whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {items.map((h, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{
              color: i % 2 === 0 ? accent : "#5A7899",
              fontSize: 9.5, fontFamily: "monospace", fontWeight: 500,
              padding: "0 24px", letterSpacing: "0.04em",
            }}>
              {h}
            </span>
            <span style={{ color: `${accent}40`, fontSize: 10 }}>│</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── MOVIES: Film reel & spotlight ────────────────────────────────────────────
function MovieSpotlight({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Spotlight beam from top-left */}
      <motion.div
        className="absolute"
        style={{
          top: -60, left: "10%",
          width: 3, height: "60%",
          background: `linear-gradient(180deg, ${accent}40, transparent)`,
          transformOrigin: "top center",
          filter: "blur(2px)",
        }}
        animate={{ rotate: [-15, 15, -15] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute"
        style={{
          top: -60, right: "15%",
          width: 3, height: "55%",
          background: `linear-gradient(180deg, ${accent}30, transparent)`,
          transformOrigin: "top center",
          filter: "blur(2px)",
        }}
        animate={{ rotate: [15, -15, 15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      {/* Film strip border top */}
      <div
        className="absolute top-0 left-0 right-0 flex gap-2 px-3 py-1.5"
        style={{ borderBottom: `1px solid ${accent}15` }}
      >
        {Array.from({ length: 22 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: 10, background: `${accent}12`, border: `1px solid ${accent}18` }}
          />
        ))}
      </div>
      <div
        className="absolute bottom-8 left-0 right-0 flex gap-2 px-3 py-1.5"
        style={{ borderTop: `1px solid ${accent}15` }}
      >
        {Array.from({ length: 22 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: 10, background: `${accent}12`, border: `1px solid ${accent}18` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── RESTAURANTS: Animated plate rings ───────────────────────────────────────
function RestaurantPlateRings({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center" style={{ zIndex: 0 }}>
      {[220, 340, 460].map((size, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size, height: size,
            border: `1.5px solid ${accent}${i === 0 ? "18" : i === 1 ? "0E" : "07"}`,
          }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 5 + i * 2, repeat: Infinity, ease: "easeInOut", delay: i * 1 }}
        />
      ))}
    </div>
  );
}

// ─── PRODUCTS: Floating star ratings ─────────────────────────────────────────
function StarRatings({ accent }: { accent: string }) {
  const ratings = useMemo(() => [
    { stars: 5, label: "Excellent", left: "5%", top: "15%", delay: 0 },
    { stars: 4, label: "Very Good", left: "68%", top: "10%", delay: 0.8 },
    { stars: 5, label: "Loved it",  left: "72%", top: "55%", delay: 1.6 },
    { stars: 3, label: "Average",   left: "2%",  top: "62%", delay: 2.2 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {ratings.map((r, i) => (
        <motion.div
          key={i}
          className="absolute rounded-xl px-3 py-2"
          style={{
            left: r.left, top: r.top,
            background: "rgba(255,255,255,0.82)",
            border: `1px solid ${accent}22`,
            backdropFilter: "blur(10px)",
            boxShadow: `0 2px 14px ${accent}10`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
          transition={{
            opacity: { delay: r.delay, duration: 0.8 },
            scale: { delay: r.delay, duration: 0.8 },
            y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: r.delay + 1 },
          }}
        >
          <div style={{ fontSize: 11, marginBottom: 2 }}>
            {"⭐".repeat(r.stars)}{"☆".repeat(5 - r.stars)}
          </div>
          <div style={{ color: "#1A3358", fontSize: 9.5, fontFamily: "monospace", fontWeight: 600 }}>
            {r.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface TransitionScreenProps {
  domain: TransitionDomain;
  onComplete?: () => void;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function TransitionScreen({ domain, onComplete }: TransitionScreenProps) {
  const cfg = DOMAIN_CONFIG[domain];
  const totalDuration = cfg.messages.length * 2000 + 1200; // ms

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, Math.max(totalDuration, 5500));
    return () => clearTimeout(timer);
  }, [totalDuration, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(150deg, ${cfg.bg} 0%, ${cfg.bgAlt} 55%, ${cfg.bg} 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* ── Layer 0: Glow blobs ── */}
      <GlowBlobs accent={cfg.accent} second={cfg.second} />

      {/* ── Layer 1: Domain-specific background ── */}
      {domain === "news" && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ padding: "6% 8%" }}>
          <WorldMapSVG />
        </div>
      )}
      {domain === "movies" && <MovieSpotlight accent={cfg.accent} />}
      {domain === "restaurants" && <RestaurantPlateRings accent={cfg.accent} />}
      {domain === "products" && <StarRatings accent={cfg.accent} />}

      {/* ── Layer 2: Background domain icons ── */}
      <BackgroundIcons icons={cfg.emojiBg} accent={cfg.accent} />

      {/* ── Layer 3: Ambient particles ── */}
      <AmbientParticles accent={cfg.accent} second={cfg.second} count={16} />

      {/* ── Layer 4: Emoji rain ── */}
      <EmojiRain count={20} />

      {/* ── Layer 5: Scan sweep ── */}
      <ScanLine accent={cfg.accent} />

      {/* ── Layer 6: News ticker (news only) ── */}
      {domain === "news" && <NewsTickerBanner accent={cfg.accent} />}

      {/* ── Center content ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
      >
        {/* Logo orb + scanning cursor combined */}
        <div className="relative flex items-center justify-center">
          <LogoOrb accent={cfg.accent} second={cfg.second} />
          {/* Scanning cursor overlaid slightly below-right */}
          <div className="absolute" style={{ bottom: -32, right: -36 }}>
            <ScanningCursor accent={cfg.accent} />
          </div>
        </div>

        {/* Brand label */}
        <div className="flex flex-col items-center gap-1.5 -mt-2">
          <span style={{
            color: "#1A3358",
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: "'DM Mono', 'Fira Code', monospace",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
          }}>
            SentiStream <span style={{ color: cfg.accent }}>AI</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}55)` }} />
            <span style={{
              color: "#5A7899",
              fontSize: 8.5,
              fontFamily: "monospace",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
            }}>
              {cfg.label}
            </span>
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, ${cfg.second}55, transparent)` }} />
          </div>
        </div>

        {/* Rotating messages + progress */}
        <RotatingMessages messages={cfg.messages} accent={cfg.accent} />

        {/* Live pulse badge */}
        <motion.div
          className="flex items-center gap-2"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: cfg.second }}
            animate={{ scale: [1, 1.55, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span style={{
            color: "#5A7899",
            fontSize: 8.5,
            fontFamily: "monospace",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}>
            AI System Active · {cfg.sublabel}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
