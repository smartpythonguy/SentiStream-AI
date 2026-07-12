"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const brand = {
  blue:        "#3B82F6",
  blueMid:     "#2563EB",
  orange:      "#F97316",
  orangeMid:   "#EA6100",
  bg:          "#EEF4FF",
  bgAlt:       "#E6EFFF",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F4F8FF",
  border:      "#C7DAFF",
  borderSoft:  "#DDEAFF",
  textPrimary: "#1A3358",
  textMuted:   "#5A7899",
  textDim:     "#9BB5CE",
};

const sentimentColor: Record<string, string> = {
  positive: "#16A34A",
  negative: "#DC2626",
  neutral:  brand.blue,
};

// ─── Status message pools ─────────────────────────────────────────────────────
const newsMessages = [
  "Collecting live headlines...",
  "Scanning global coverage...",
  "Comparing media narratives...",
  "Detecting sentiment shifts...",
  "Generating intelligence report...",
];
const productMessages = [
  "Collecting user reviews...",
  "Processing Reddit discussions...",
  "Analyzing customer feedback...",
  "Extracting consumer opinions...",
  "Generating sentiment report...",
];

// ─── Fake data pools ──────────────────────────────────────────────────────────
const fakeHeadlines = [
  { region: "US", headline: "Fed signals rate pause amid cooling inflation data",          tag: "Economy",  sentiment: "neutral"  },
  { region: "EU", headline: "Brussels tightens AI regulation framework for 2025",         tag: "Tech",     sentiment: "neutral"  },
  { region: "AS", headline: "Semiconductor exports surge following new trade deals",       tag: "Markets",  sentiment: "positive" },
  { region: "UK", headline: "NHS adopts AI diagnostics across 40 major hospitals",         tag: "Health",   sentiment: "positive" },
  { region: "CN", headline: "EV manufacturers report record Q2 delivery numbers",          tag: "Auto",     sentiment: "positive" },
  { region: "IN", headline: "Startup ecosystem attracts $4.2B in venture funding",         tag: "Business", sentiment: "positive" },
  { region: "BR", headline: "Climate summit reaches binding carbon accord",                tag: "Climate",  sentiment: "positive" },
  { region: "JP", headline: "Robotics firms pioneer new factory automation wave",          tag: "Industry", sentiment: "positive" },
  { region: "RU", headline: "Energy markets volatile as sanctions package expands",        tag: "Energy",   sentiment: "negative" },
  { region: "AU", headline: "Central bank holds rates; housing affordability worsens",     tag: "Finance",  sentiment: "negative" },
  { region: "CA", headline: "Tech layoffs ease as AI hiring drives sector recovery",       tag: "Jobs",     sentiment: "positive" },
  { region: "KR", headline: "Samsung unveils next-gen chip amid supply chain revival",    tag: "Tech",     sentiment: "positive" },
];

const fakeComments = [
  { user: "throwaway_dev99", avatar: "T", score: 2341, sentiment: "positive", body: "Honestly the best purchase I've made this year. Zero regrets.",                       sub: "r/BuyItForLife"    },
  { user: "skeptical_sam",   avatar: "S", score:  891, sentiment: "negative", body: "Overpriced for what it is. Marketing is doing all the heavy lifting here.",           sub: "r/Frugal"          },
  { user: "kira_m",          avatar: "K", score: 4102, sentiment: "positive", body: "After 6 months of daily use — still perfect. Build quality is unmatched.",            sub: "r/ProductReviews"  },
  { user: "neutral_ned",     avatar: "N", score:  567, sentiment: "neutral",  body: "It's fine. Does what it says. Nothing groundbreaking.",                               sub: "r/mildlyinteresting"},
  { user: "techie_z",        avatar: "Z", score: 1789, sentiment: "positive", body: "The software update last month fixed every complaint. Now it's genuinely great.",     sub: "r/gadgets"         },
  { user: "frustrated_buyer",avatar: "F", score:  312, sentiment: "negative", body: "Customer support ghosted me for 3 weeks. Never again.",                              sub: "r/ConsumerAdvice"  },
  { user: "daily_reviewer",  avatar: "D", score:  998, sentiment: "positive", body: "Tried 4 competitors. This one wins on every single metric.",                         sub: "r/ConsumerAdvice"  },
  { user: "long_time_user",  avatar: "L", score: 2750, sentiment: "positive", body: "Still using it after 2 years. Incredible durability — worth every penny.",           sub: "r/BuyItForLife"    },
];

const newsSources = ["Reuters","Bloomberg","AP News","BBC","Al Jazeera","NYT","FT","CNN","WSJ","The Guardian","Axios","Politico"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Very lightweight SVG world-map silhouette (simplified continents) */
function WorldMapSVG() {
  return (
    <svg
      viewBox="0 0 1000 500"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", opacity: 0.13 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* North America */}
      <path fill={brand.blue} d="M 120 60 L 200 50 L 260 70 L 280 120 L 250 170 L 210 200 L 180 230 L 150 210 L 110 180 L 90 140 L 100 90 Z" />
      {/* South America */}
      <path fill={brand.blue} d="M 200 260 L 240 250 L 270 280 L 275 340 L 255 400 L 220 430 L 195 400 L 185 340 L 190 290 Z" />
      {/* Europe */}
      <path fill={brand.blue} d="M 440 55 L 510 50 L 540 75 L 530 110 L 490 130 L 450 125 L 430 100 L 435 70 Z" />
      {/* Africa */}
      <path fill={brand.blue} d="M 450 155 L 520 145 L 555 175 L 560 250 L 540 330 L 500 380 L 460 370 L 430 310 L 420 230 L 430 170 Z" />
      {/* Asia */}
      <path fill={brand.blue} d="M 545 45 L 700 35 L 800 60 L 830 110 L 800 160 L 730 190 L 640 185 L 580 160 L 550 120 L 540 75 Z" />
      {/* South/SE Asia appendage */}
      <path fill={brand.blue} d="M 650 190 L 700 210 L 710 270 L 680 300 L 650 270 L 640 220 Z" />
      {/* Australia */}
      <path fill={brand.blue} d="M 760 300 L 840 290 L 880 320 L 875 380 L 830 410 L 770 400 L 745 360 L 750 320 Z" />
      {/* Japan */}
      <path fill={brand.orange} d="M 820 95 L 840 88 L 850 100 L 835 112 L 820 108 Z" />
      {/* UK/Ireland blip */}
      <path fill={brand.orange} d="M 425 58 L 435 54 L 440 63 L 430 68 Z" />
      {/* Pulse dots on key cities */}
      <circle cx="155" cy="120" r="4" fill={brand.blue} opacity="0.9" />   {/* NYC */}
      <circle cx="480"  cy="85"  r="4" fill={brand.blue} opacity="0.9" />   {/* London */}
      <circle cx="670" cy="120" r="4" fill={brand.blue} opacity="0.9" />   {/* Delhi */}
      <circle cx="810" cy="100" r="4" fill={brand.orange} opacity="0.9" />  {/* Tokyo */}
      <circle cx="490" cy="195" r="4" fill={brand.orange} opacity="0.9" />  {/* Nairobi */}
      <circle cx="223" cy="300" r="4" fill={brand.blue} opacity="0.9" />   {/* São Paulo */}
      <circle cx="800" cy="340" r="4" fill={brand.blue} opacity="0.9" />   {/* Sydney */}
    </svg>
  );
}

// ─── Ambient particles ────────────────────────────────────────────────────────
function AmbientParticles({ count = 20 }: { count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${4 + (i * 4.7) % 92}%`,
      y: `${5 + (i * 6.3) % 90}%`,
      color: i % 3 === 0 ? brand.orange : i % 3 === 1 ? brand.blue : "#818CF8",
      size: 2 + (i % 3),
      duration: 5 + (i % 5) * 1.1,
      delay: (i * 0.28) % 4,
      driftX: ((i % 5) - 2) * 16,
    })), [count]);

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

// ─── Scan line ────────────────────────────────────────────────────────────────
function ScanLine({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, ${brand.orange}40, transparent)` }}
        animate={{ top: ["4%", "96%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// ─── NEWS: World map background ───────────────────────────────────────────────
function NewsWorldMap() {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
      style={{ padding: "0 4%" }}
    >
      {/* Dot-grid underlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${brand.blue}22 1.2px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
          opacity: 0.6,
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      {/* Map silhouette */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: "6% 8%" }}>
        <WorldMapSVG />
      </div>
      {/* Animated arc lines connecting cities */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.18 }}>
        {/* NYC → London */}
        <motion.path d="M 155 120 Q 320 20 480 85" fill="none" stroke={brand.blue} strokeWidth="1"
          strokeDasharray="6 4"
          animate={{ strokeDashoffset: [0, -40] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
        {/* London → Delhi */}
        <motion.path d="M 480 85 Q 580 40 670 120" fill="none" stroke={brand.blue} strokeWidth="1"
          strokeDasharray="6 4"
          animate={{ strokeDashoffset: [0, -40] }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: 0.5 }} />
        {/* Delhi → Tokyo */}
        <motion.path d="M 670 120 Q 740 70 810 100" fill="none" stroke={brand.orange} strokeWidth="1"
          strokeDasharray="6 4"
          animate={{ strokeDashoffset: [0, -40] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "linear", delay: 1 }} />
        {/* London → Nairobi */}
        <motion.path d="M 480 85 Q 490 150 490 195" fill="none" stroke={brand.blue} strokeWidth="1"
          strokeDasharray="5 4"
          animate={{ strokeDashoffset: [0, -36] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: 0.8 }} />
        {/* NYC → São Paulo */}
        <motion.path d="M 155 120 Q 185 210 223 300" fill="none" stroke={brand.orange} strokeWidth="1"
          strokeDasharray="5 4"
          animate={{ strokeDashoffset: [0, -36] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "linear", delay: 1.5 }} />
      </svg>
    </div>
  );
}

// ─── NEWS: Floating headline cards ────────────────────────────────────────────
function FloatingNewsHeadlines() {
  const slots = useMemo(() => [
    { left: "1%",   top: "8%",  delay: 0   },
    { left: "61%",  top: "5%",  delay: 1.1 },
    { left: "73%",  top: "33%", delay: 0.5 },
    { left: "0%",   top: "53%", delay: 1.7 },
    { left: "63%",  top: "67%", delay: 0.2 },
    { left: "18%",  top: "76%", delay: 2.0 },
  ], []);

  const [assignments, setAssignments] = useState<number[]>(() =>
    slots.map((_, i) => i % fakeHeadlines.length)
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setAssignments(prev => prev.map(idx => (idx + 3) % fakeHeadlines.length));
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {slots.map((slot, i) => {
        const card = fakeHeadlines[assignments[i]];
        return (
          <motion.div
            key={`slot-${i}`}
            className="absolute"
            style={{ left: slot.left, top: slot.top }}
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.8, delay: slot.delay, ease: "easeOut" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={card.headline}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
                className="rounded-xl px-3 py-2.5"
                style={{
                  width: 212,
                  background: `linear-gradient(135deg, ${brand.surface}F8, ${brand.surfaceAlt}F6)`,
                  border: `1px solid ${brand.border}`,
                  backdropFilter: "blur(16px)",
                  boxShadow: `0 3px 18px ${brand.blue}0E, 0 1px 4px ${brand.blue}08`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{
                    background: `${brand.blue}18`, color: brand.blue,
                    fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                    padding: "1px 5px", borderRadius: 4, letterSpacing: "0.05em",
                  }}>
                    {card.region}
                  </span>
                  <span style={{ color: brand.orange, fontSize: 9.5, fontWeight: 600 }}>{card.tag}</span>
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: sentimentColor[card.sentiment], boxShadow: `0 0 5px ${sentimentColor[card.sentiment]}80` }}
                  />
                </div>
                <p style={{ color: brand.textPrimary, fontSize: 10.5, lineHeight: 1.44, fontWeight: 500 }}>
                  {card.headline}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="h-px flex-1 rounded"
                    style={{ background: `linear-gradient(90deg, ${sentimentColor[card.sentiment]}55, transparent)` }} />
                  <span style={{ color: sentimentColor[card.sentiment], fontSize: 8.5, fontFamily: "monospace", textTransform: "capitalize" }}>
                    {card.sentiment}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── NEWS: Scrolling source ticker strip ─────────────────────────────────────
function NewsTickerStrip() {
  // Duplicate list for seamless loop
  const items = [...newsSources, ...newsSources];
  return (
    <div
      className="absolute bottom-0 left-0 right-0 overflow-hidden"
      style={{
        height: 32,
        background: `linear-gradient(90deg, ${brand.blue}12, ${brand.blueMid}08, ${brand.blue}12)`,
        borderTop: `1px solid ${brand.border}`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <motion.div
        className="flex items-center gap-0 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", alignItems: "center" }}
      >
        {items.map((src, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{
              color: i % 3 === 0 ? brand.blue : i % 3 === 1 ? brand.orange : brand.textMuted,
              fontSize: 9.5, fontFamily: "monospace", fontWeight: 600,
              letterSpacing: "0.12em", padding: "0 18px", textTransform: "uppercase",
            }}>
              {src}
            </span>
            <span style={{ color: brand.border, fontSize: 10, userSelect: "none" }}>│</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── NEWS: Source scanner panel ───────────────────────────────────────────────
function NewsSourceScanner() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(p => (p + 1) % newsSources.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10" style={{ width: 148 }}>
      <div style={{ color: brand.textMuted, fontSize: 8.5, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: 4 }}>
        SCANNING SOURCES
      </div>
      {newsSources.slice(0, 7).map((src, i) => (
        <motion.div
          key={src}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1"
          animate={{
            background: activeIdx === i ? `linear-gradient(90deg, ${brand.blue}14, ${brand.orange}0C)` : "transparent",
            borderColor: activeIdx === i ? `${brand.blue}30` : "transparent",
          }}
          style={{ border: "1px solid transparent" }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            animate={{
              background: activeIdx === i ? brand.blue : brand.textDim,
              scale: activeIdx === i ? 1.5 : 1,
            }}
            transition={{ duration: 0.25 }}
          />
          <span style={{
            color: activeIdx === i ? brand.blue : brand.textMuted,
            fontSize: 9.5, fontFamily: "monospace",
            transition: "color 0.3s",
          }}>
            {src}
          </span>
          {activeIdx === i && (
            <motion.span
              className="ml-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ color: brand.orange, fontSize: 7.5, fontFamily: "monospace" }}
            >
              LIVE
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─── PRODUCT: Reddit card ─────────────────────────────────────────────────────
function RedditCard({ comment }: { comment: typeof fakeComments[0] }) {
  const avatarBg =
    comment.sentiment === "positive" ? `linear-gradient(135deg, ${brand.blue}, #6366F1)` :
    comment.sentiment === "negative" ? `linear-gradient(135deg, ${brand.orange}, #EF4444)` :
    `linear-gradient(135deg, #64829E, #A8BFD4)`;

  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{
        width: 248,
        background: `linear-gradient(135deg, ${brand.surface}F9, ${brand.surfaceAlt}F7)`,
        border: `1px solid ${brand.borderSoft}`,
        backdropFilter: "blur(16px)",
        boxShadow: `0 4px 22px ${sentimentColor[comment.sentiment]}0D, 0 1px 6px ${brand.blue}08`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold font-mono"
          style={{ background: avatarBg, fontSize: 11 }}
        >
          {comment.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span style={{ color: brand.textPrimary, fontSize: 9.5, fontWeight: 600 }}>u/{comment.user}</span>
          </div>
          <div style={{ color: brand.textMuted, fontSize: 8.5, marginBottom: 5 }}>{comment.sub}</div>
          <p style={{ color: brand.textPrimary, fontSize: 10.5, lineHeight: 1.46, opacity: 0.85 }}>
            {comment.body}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span style={{ color: brand.orange, fontSize: 11, fontWeight: 700 }}>▲</span>
            <span style={{ color: brand.textMuted, fontSize: 9, fontFamily: "monospace" }}>
              {comment.score.toLocaleString()}
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: sentimentColor[comment.sentiment] }} />
              <span style={{ color: sentimentColor[comment.sentiment], fontSize: 8.5, fontFamily: "monospace", textTransform: "capitalize" }}>
                {comment.sentiment}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT: Floating cards (two rising columns) ────────────────────────────
function FloatingCommentCards() {
  const [colA, colB] = useMemo(() => {
    const s = [...fakeComments].sort(() => Math.random() - 0.5);
    return [s.slice(0, 4), s.slice(4)];
  }, []);

  const cols = [
    { items: colA, left: "4%"  },
    { items: colB, left: "57%" },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {cols.map((col, ci) =>
        col.items.map((comment, ri) => {
          const duration = 26 + ri * 4;
          const delay = ci * 2.0 + ri * 5.5;
          return (
            <motion.div
              key={`${comment.user}-${ci}`}
              className="absolute"
              style={{ left: col.left }}
              initial={{ bottom: -160 }}
              animate={{ bottom: "110%" }}
              transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
            >
              <motion.div
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration, delay, repeat: Infinity, times: [0, 0.06, 0.88, 1] }}
              >
                <RedditCard comment={comment} />
              </motion.div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

// ─── PRODUCT: Live sentiment meter panel ─────────────────────────────────────
function SentimentMeter() {
  const [tick, setTick] = useState(0);
  const bars = [
    { label: "Positive", pct: 63, color: "#16A34A" },
    { label: "Neutral",  pct: 22, color: brand.blue  },
    { label: "Negative", pct: 15, color: "#DC2626"  },
  ];

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
      style={{
        width: 148,
        background: `linear-gradient(135deg, ${brand.surface}F9, ${brand.surfaceAlt}F7)`,
        border: `1px solid ${brand.border}`,
        borderRadius: 14,
        padding: "14px 13px",
        backdropFilter: "blur(14px)",
        boxShadow: `0 3px 18px ${brand.blue}0E`,
      }}
    >
      <div style={{ color: brand.textMuted, fontSize: 8.5, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 12 }}>
        SENTIMENT SPLIT
      </div>
      {bars.map((bar, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
            <span style={{ color: bar.color, fontSize: 8.5, fontFamily: "monospace", fontWeight: 600 }}>{bar.label.toUpperCase()}</span>
            <span style={{ color: bar.color, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
              {bar.pct + (tick % 3 === i ? 1 : 0)}%
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: `${bar.color}1A` }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${bar.color}70, ${bar.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${bar.pct}%` }}
              transition={{ duration: 3.5, delay: i * 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 10, marginTop: 4 }}>
        <div style={{ color: brand.textMuted, fontSize: 8.5, fontFamily: "monospace", marginBottom: 4 }}>REVIEWS SCANNED</div>
        <motion.div
          style={{ color: brand.blue, fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          {(12847 + tick * 41).toLocaleString()}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Center logo orb ──────────────────────────────────────────────────────────
function LogoOrb({ accent, second }: { accent: string; second: string }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing halo rings */}
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

      {/* Rotating conic sweep */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -7,
          background: `conic-gradient(from 0deg, transparent 52%, ${accent}CC, transparent)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />
      {/* Counter sweep */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -3,
          background: `conic-gradient(from 180deg, transparent 62%, ${second}88, transparent)`,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />

      {/* Logo disc */}
      <motion.div
        className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          width: 100,
          height: 100,
          background: `radial-gradient(circle at 40% 35%, #FFFFFF 55%, ${brand.bgAlt})`,
          border: `1.5px solid ${accent}38`,
          boxShadow: `0 0 30px ${accent}22, 0 0 70px ${accent}0A, inset 0 1px 0 ${accent}1A`,
        }}
        animate={{ scale: [1, 1.032, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Use actual logo.svg from public folder */}
        <Image
          src="/logo.svg"
          alt="SentiStream"
          width={66}
          height={66}
          priority
          style={{ objectFit: "contain" }}
          // Fallback: if logo.svg doesn't exist, render inline SVG placeholder
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <svg viewBox="0 0 500 500" width="66" height="66" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(250,250)">
                    <path fill="${brand.blue}" d="M 0,-30 A 30,30 0 1,1 0,30 A 30,30 0 1,1 0,-30 Z M 0,-14 A 14,14 0 1,0 0,14 A 14,14 0 1,0 0,-14 Z"/>
                    <path fill="none" stroke="${brand.blue}" stroke-width="14" stroke-linecap="round" d="M -32,-48 A 58,58 0 0,1 32,-48"/>
                    <path fill="none" stroke="${brand.blue}" stroke-width="14" stroke-linecap="round" d="M -32,48 A 58,58 0 0,0 32,48"/>
                    <path fill="none" stroke="${brand.blue}" stroke-width="14" stroke-linecap="round" d="M -48,-32 A 58,58 0 0,0 -48,32"/>
                    <path fill="none" stroke="${brand.orange}" stroke-width="14" stroke-linecap="round" d="M 48,-32 A 58,58 0 0,1 48,32"/>
                    <rect fill="${brand.blue}" x="-78" y="-16" width="14" height="32" rx="7"/>
                    <rect fill="${brand.orange}" x="64" y="-16" width="14" height="32" rx="7"/>
                  </g>
                </svg>`;
            }
          }}
        />
      </motion.div>

      {/* Orbiting data nodes */}
      {[45, 135, 225, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const r   = 76;
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `calc(50% + ${Math.cos(rad) * r}px - 3px)`,
              top:  `calc(50% + ${Math.sin(rad) * r}px - 3px)`,
              background: i % 2 === 0 ? accent : second,
            }}
            animate={{ opacity: [0.22, 1, 0.22], scale: [1, 1.7, 1] }}
            transition={{ duration: 3.2, delay: i * 0.75, repeat: Infinity }}
          />
        );
      })}
    </div>
  );
}

// ─── Status / progress bar ────────────────────────────────────────────────────
function StatusBar({ messages, accent }: { messages: string[]; accent: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % messages.length), 1100);
    return () => clearInterval(t);
  }, [messages]);

  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1,  y:  0, filter: "blur(0px)" }}
          exit={  { opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex items-center gap-3 rounded-2xl px-6 py-3"
          style={{
            background: `linear-gradient(135deg, ${brand.surface}F9, ${brand.surfaceAlt}F2)`,
            border: `1px solid ${accent}28`,
            backdropFilter: "blur(18px)",
            boxShadow: `0 2px 22px ${accent}09, inset 0 1px 0 ${accent}14`,
          }}
        >
          {/* Pulse dot */}
          <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
            <motion.div
              className="absolute rounded-full"
              style={{ width: 16, height: 16, background: `${accent}1C` }}
              animate={{ scale: [1, 1.9, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
          </div>
          <span style={{
            color: brand.textPrimary, fontSize: 13, fontFamily: "'DM Mono','Fira Code',monospace",
            fontWeight: 500, letterSpacing: "0.01em", opacity: 0.92,
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
              width:      i === idx ? 22 : 5,
              background: i < idx ? accent : i === idx ? accent : brand.textDim,
              opacity:    i === idx ? 1  : i < idx   ? 0.55     : 0.22,
            }}
            style={{ height: 4 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AILoadingScreenProps {
  mode?: "news" | "products";
  /** Called when the loading animation finishes. If provided, the component
   *  does NOT navigate itself — the parent is responsible for routing. */
  onComplete?: () => void;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function AILoadingScreen({ mode = "news", onComplete }: AILoadingScreenProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const accent = mode === "news" ? brand.blue   : brand.orange;
  const second = mode === "news" ? brand.orange : brand.blue;
  const messages = mode === "news" ? newsMessages : productMessages;

  // Total animation = 5 status steps × 1100 ms + 1000 ms grace = ~6.5 s
  // Navigation is blocked for a minimum of 5500 ms regardless.
  const [done, setDone] = useState(false);

  useEffect(() => {
    // 5 messages × 1100 ms each = 5500 ms, plus 800 ms grace → 6300 ms total
    // Minimum hard floor of 5500 ms so animation is always fully visible.
    const total = Math.max(messages.length * 1100 + 800, 5500);
    const timer = setTimeout(() => setDone(true), total);
    return () => clearTimeout(timer);
  }, [messages.length]);

  useEffect(() => {
    if (!done) return;
    // If a callback was provided, delegate navigation to the parent entirely.
    if (onComplete) {
      onComplete();
      return;
    }
    // Fallback: self-navigate using URL search params (used when the loading
    // screen is rendered at a dedicated route, e.g. /loading).
    const topic    = searchParams?.get("topic")    ?? "";
    const category = searchParams?.get("category") ?? mode;
    router.push(`/results?topic=${encodeURIComponent(topic)}&category=${category}`);
  }, [done, router, searchParams, mode, onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(150deg, ${brand.bg} 0%, ${brand.bgAlt} 55%, #E8F0FF 100%)` }}
    >
      {/* ── Ambient glow blobs ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 720, height: 720, top: "-18%", left: "-12%",
          background: `radial-gradient(circle, ${accent}0D 0%, transparent 66%)`,
          filter: "blur(64px)",
        }}
        animate={{ scale: [1, 1.13, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 620, height: 620, bottom: "-14%", right: "-10%",
          background: `radial-gradient(circle, ${second}0B 0%, transparent 66%)`,
          filter: "blur(64px)",
        }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.55, 0.95, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── NEWS mode layers ── */}
      {mode === "news" && (
        <>
          <AmbientParticles count={18} />
          <NewsWorldMap />
          <FloatingNewsHeadlines />
          <NewsSourceScanner />
          <ScanLine accent={accent} />
          <NewsTickerStrip />
        </>
      )}

      {/* ── PRODUCT mode layers ── */}
      {mode === "products" && (
        <>
          <AmbientParticles count={16} />
          <FloatingCommentCards />
          <SentimentMeter />
          <ScanLine accent={accent} />
        </>
      )}

      {/* ── Centre stack ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, scale: 0.91, y: 18 }}
        animate={{ opacity: 1, scale: 1,    y:  0 }}
        transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <LogoOrb accent={accent} second={second} />

        {/* Brand label */}
        <div className="flex flex-col items-center gap-1 -mt-2">
          <span style={{
            color: brand.textPrimary, fontSize: 12.5, fontWeight: 700,
            fontFamily: "'DM Mono','Fira Code',monospace",
            letterSpacing: "0.24em", textTransform: "uppercase",
          }}>
            SentiStream <span style={{ color: accent }}>AI</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, transparent, ${brand.blue}55)` }} />
            <span style={{
              color: brand.textMuted, fontSize: 8.5, fontFamily: "monospace",
              letterSpacing: "0.26em", textTransform: "uppercase",
            }}>
              {mode === "news" ? "Global Intelligence" : "Consumer Insights"}
            </span>
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, ${brand.orange}55, transparent)` }} />
          </div>
        </div>

        <StatusBar messages={messages} accent={accent} />

        {/* Live pulse badge */}
        <motion.div
          className="flex items-center gap-2"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: brand.orange }}
            animate={{ scale: [1, 1.55, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span style={{
            color: brand.textMuted, fontSize: 8.5, fontFamily: "monospace",
            letterSpacing: "0.22em", textTransform: "uppercase",
          }}>
            AI System Active
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
