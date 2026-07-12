"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "./glass-card";
import { Settings, Bell, X, Trash2, Clock, Check, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { usePageTransition } from "@/context/transition-context";

// Mock analysis history data
const mockHistory = [
  { id: 1, topic: "iPhone 15 Pro", category: "Products & Brands", date: "2 hours ago", sentiment: "positive" },
  { id: 2, topic: "Climate Policy 2024", category: "News & Politics", date: "5 hours ago", sentiment: "neutral" },
  { id: 3, topic: "Tesla Stock", category: "Products & Brands", date: "1 day ago", sentiment: "negative" },
  { id: 4, topic: "AI Regulations", category: "News & Politics", date: "2 days ago", sentiment: "positive" },
];

interface DashboardNavbarProps {
  onRefresh?: () => void;
}

/** Renders the SentiStream logo from public/favicon.svg */
export function SentistreamLogo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/favicon.svg"
      alt="SentiStream logo"
      width={size}
      height={size}
      priority
    />
  );
}

export function DashboardNavbar({ onRefresh }: DashboardNavbarProps) {
  const router = useRouter();
  const { reset } = usePageTransition();

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [history, setHistory] = useState(mockHistory);

  const [settings, setSettings] = useState({
    darkMode: true,
    notifications: true,
    autoRefresh: false,
    compactView: false,
    soundEffects: false,
  });

  /**
   * Root cause fix: the old `window.location.href = "/"` caused a full-page
   * reload, but when Next.js rehydrated the home page client-side the
   * TransitionContext still held its stale "exiting" / "navigating" state,
   * which made AnimatePresence render nothing (blank page).
   *
   * Fix: reset the transition context back to "idle" first, then use
   * router.push() so navigation stays inside the SPA and the home page
   * re-mounts with state === "idle", allowing AnimatePresence to render it.
   */
  const goHome = useCallback(() => {
    reset();
    router.push("/");
  }, [reset, router]);

  const handleSettingChange = useCallback((key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const removeHistoryItem = useCallback((id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "bg-green-500";
      case "negative": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <>
      <nav className="w-full px-6 py-4">
        <GlassCard className="px-6 py-3 flex items-center justify-between">
          {/* Logo + Wordmark — clicking navigates home */}
          <div className="flex items-center gap-2">
            <button
              onClick={goHome}
              className="flex items-center gap-3 hover:opacity-80 active:scale-95 transition-all duration-150 cursor-pointer"
              title="Back to Home"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center shadow-lg">
                <SentistreamLogo size={28} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-foreground leading-tight">
                  Senti<span className="bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">Stream</span>
                </span>
                <span className="text-xs text-muted-foreground">AI Dashboard</span>
              </div>
            </button>
            {/* Explicit Back to Home button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={goHome}
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 active:scale-95 transition-all duration-150"
              title="Back to Home"
            >
              <Home className="w-4 h-4" />
            </Button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 active:scale-95 transition-all duration-150"
            >
              <Bell className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 active:scale-95 transition-all duration-150"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* AI Status Indicator */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/25 cursor-default select-none">
                    {/* Pulsing green dot */}
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="text-xs font-semibold text-green-500 hidden sm:block">Live</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  AI Engine Active
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </GlassCard>
      </nav>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Analysis History
            </DialogTitle>
            <DialogDescription>Your recent sentiment analyses</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No history yet</p>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getSentimentColor(item.sentiment)}`} />
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.topic}</p>
                      <p className="text-xs text-muted-foreground">{item.category} · {item.date}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHistoryItem(item.id)}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {history.length > 0 && (
            <Button
              variant="outline"
              onClick={clearHistory}
              className="w-full mt-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All History
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings
            </DialogTitle>
            <DialogDescription>Customize your SentiStream experience</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Appearance</h3>
              <div className="space-y-3">
                {[
                  { id: "dark-mode", key: "darkMode" as const, label: "Dark Mode", desc: "Use dark theme for the interface" },
                  { id: "compact-view", key: "compactView" as const, label: "Compact View", desc: "Show more content with less spacing" },
                ].map(({ id, key, label, desc }) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                    <Label htmlFor={id} className="flex flex-col gap-1 cursor-pointer">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </Label>
                    <Switch id={id} checked={settings[key]} onCheckedChange={() => handleSettingChange(key)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Notifications</h3>
              <div className="space-y-3">
                {[
                  { id: "notifications", key: "notifications" as const, label: "Push Notifications", desc: "Get notified about analysis updates" },
                  { id: "sound-effects", key: "soundEffects" as const, label: "Sound Effects", desc: "Play sounds for notifications" },
                ].map(({ id, key, label, desc }) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                    <Label htmlFor={id} className="flex flex-col gap-1 cursor-pointer">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </Label>
                    <Switch id={id} checked={settings[key]} onCheckedChange={() => handleSettingChange(key)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Analysis</h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                <Label htmlFor="auto-refresh" className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-medium">Auto Refresh</span>
                  <span className="text-xs text-muted-foreground">Automatically refresh analysis data</span>
                </Label>
                <Switch
                  id="auto-refresh"
                  checked={settings.autoRefresh}
                  onCheckedChange={() => handleSettingChange("autoRefresh")}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              Settings auto-saved
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* About Modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center">
                <SentistreamLogo size={32} />
              </div>
              <div>
                <span className="text-xl">
                  About Senti<span className="bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">Stream</span> AI
                </span>
              </div>
            </DialogTitle>
            <DialogDescription>Real-time Sentiment Intelligence Platform</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="grid gap-3">
              {[
                {
                  accent: "from-blue-400 to-blue-500",
                  bg: "bg-blue-500/5 border-blue-500/10",
                  title: "AI-Powered Analytics",
                  body: "SentiStream AI leverages advanced machine learning and natural language processing to deliver precise sentiment analysis across millions of data points in real-time.",
                },
                {
                  accent: "from-orange-400 to-orange-500",
                  bg: "bg-orange-500/5 border-orange-500/10",
                  title: "News & Current Events",
                  body: "Monitor public sentiment on breaking news, political developments, and global events with our comprehensive news analysis engine.",
                },
                {
                  accent: "from-blue-400 to-orange-400",
                  bg: "bg-primary/5 border-primary/10",
                  title: "Product & Brand Intelligence",
                  body: "Track brand perception, analyze product reviews, and understand consumer sentiment to make data-driven business decisions.",
                },
              ].map(({ accent, bg, title, body }) => (
                <div key={title} className={`p-4 rounded-xl border ${bg}`}>
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${accent} inline-block`} />
                    {title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Version 1.0.0</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">
                  Powered by Advanced AI
                </span>
              </div>
              {/* AI status indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/25">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-xs font-semibold text-green-500">Live</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
