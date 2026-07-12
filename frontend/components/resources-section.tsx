"use client";

import { motion } from "framer-motion";
import { ExternalLink, Film } from "lucide-react";

interface DetectedSource {
  name: string;
  articleCount: number;
  homepageUrl: string;
}

interface ResourcesSectionProps {
  sources: DetectedSource[];
}

// ── Blocked aggregator names / hostnames ─────────────────────────────
const BLOCKED_SOURCES = new Set([
  "Unknown Source",
  "news.google.com",
  "google.com",
  "feedburner.com",
]);

// ── Publisher homepage map ────────────────────────────────────────────
const SOURCE_URLS: Record<string, string> = {
  "CNN":                  "https://www.cnn.com",
  "BBC":                  "https://www.bbc.com",
  "Reuters":              "https://www.reuters.com",
  "Al Jazeera":           "https://www.aljazeera.com",
  "The Guardian":         "https://www.theguardian.com",
  "NY Times":             "https://www.nytimes.com",
  "New York Times":       "https://www.nytimes.com",
  "Washington Post":      "https://www.washingtonpost.com",
  "AP News":              "https://apnews.com",
  "Bloomberg":            "https://www.bloomberg.com",
  "Fox News":             "https://www.foxnews.com",
  "NBC News":             "https://www.nbcnews.com",
  "ABC News":             "https://abcnews.go.com",
  "Politico":             "https://www.politico.com",
  "Axios":                "https://www.axios.com",
  "The Verge":            "https://www.theverge.com",
  "Financial Times":      "https://www.ft.com",
  "Wall Street Journal":  "https://www.wsj.com",
  "The Economist":        "https://www.economist.com",
  "TIME":                 "https://time.com",
  "Forbes":               "https://www.forbes.com",
  "Business Insider":     "https://www.businessinsider.com",
  "CNBC":                 "https://www.cnbc.com",
  "Sky News":             "https://news.sky.com",
  "The Independent":      "https://www.independent.co.uk",
  "The Telegraph":        "https://www.telegraph.co.uk",
  "NPR":                  "https://www.npr.org",
  "Vox":                  "https://www.vox.com",
  "The Atlantic":         "https://www.theatlantic.com",
  "Wired":                "https://www.wired.com",
  "TechCrunch":           "https://techcrunch.com",
  // ── Movie review sources ──────────────────────────────────────────
  "IMDb":                   "https://www.imdb.com",
  "Rotten Tomatoes":        "https://www.rottentomatoes.com",
  "Letterboxd":             "https://letterboxd.com",
  "Metacritic":             "https://www.metacritic.com",
  "TMDb":                   "https://www.themoviedb.org",
  "Wikipedia":              "https://www.wikipedia.org",
  "Google Reviews":         "https://www.google.com",
  "RogerEbert.com":         "https://www.rogerebert.com",
  "Empire":                 "https://www.empireonline.com",
  "Variety":                "https://variety.com",
  "The Hollywood Reporter": "https://www.hollywoodreporter.com",
  "IndieWire":              "https://www.indiewire.com",
  "Collider":               "https://collider.com",
  "IGN":                    "https://www.ign.com",
};

/**
 * Resolve a homepage URL for a publisher.
 * Known publishers → curated URL.
 * Bare hostnames from backend → prepend https://.
 */
function resolveHomepage(name: string, homepageUrl?: string): string {
  // 1. Curated map first
  if (SOURCE_URLS[name]) return SOURCE_URLS[name];
  // 2. Backend-supplied origin (set from article URL)
  if (homepageUrl && homepageUrl !== "") return homepageUrl;
  // 3. If name looks like a hostname, use it directly
  if (name.includes(".")) return `https://${name}`;
  // 4. Last resort slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.${slug}.com`;
}

/**
 * Return the Google favicon CDN URL for a given homepage.
 */
function faviconUrl(homepage: string): string {
  try {
    const { hostname } = new URL(homepage);
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
  } catch {
    return "";
  }
}

// ── Publisher logo with fallback ─────────────────────────────────────

interface PublisherLogoProps {
  name: string;
  homepage: string;
}

function PublisherLogo({ name, homepage }: PublisherLogoProps) {
  const favicon = faviconUrl(homepage);

  if (!favicon) {
    return (
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Film className="w-5 h-5 text-primary" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-card border border-border/40 flex items-center justify-center overflow-hidden group-hover:border-primary/30 transition-colors">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={favicon}
        alt={`${name} logo`}
        width={28}
        height={28}
        className="object-contain"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>';
          }
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function ResourcesSection({ sources }: ResourcesSectionProps) {
  // Filter out aggregators, unknown sources, and blanks
  const validSources = (sources || []).filter((s) => {
    if (!s.name || s.name.trim() === "") return false;
    if (BLOCKED_SOURCES.has(s.name)) return false;
    if (s.name.toLowerCase().includes("google") && s.name !== "Google Reviews") return false;
    return true;
  });

  if (validSources.length === 0) return null;

  return (
    <motion.div
      className="mt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Film className="w-5 h-5 text-primary" />
        Review Sources
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {validSources.map((source, index) => {
          const homepage = resolveHomepage(source.name, source.homepageUrl);
          return (
            <motion.div
              key={source.name}
              className="group flex flex-col p-4 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 + index * 0.08 }}
              whileHover={{ y: -2 }}
            >
              {/* Logo row */}
              <div className="flex items-center justify-between mb-3">
                <PublisherLogo name={source.name} homepage={homepage} />
                <span className="text-xs text-muted-foreground font-medium">
                  {source.articleCount}{" "}
                  {source.articleCount === 1 ? "article" : "articles"}
                </span>
              </div>

              {/* Publisher name */}
              <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors leading-tight mb-3">
                {source.name}
              </h3>

              {/* Visit Website button */}
              <a
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-medium border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group/btn"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                Visit Website
              </a>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
