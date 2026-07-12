"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "./glass-card";
import { X } from "lucide-react";
import Image from "next/image";

/** Renders the SentiStream logo from public/favicon.svg */
function SentistreamLogo({ size = 32 }: { size?: number }) {
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

interface NavbarProps {
  onGetStartedClick?: () => void;
}

export function Navbar({ onGetStartedClick }: NavbarProps) {
  const [showAbout, setShowAbout] = useState(false);

  const handleGetStarted = () => {
    if (onGetStartedClick) {
      onGetStartedClick();
    }
  };

  return (
    <>
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
        <GlassCard className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-white/10 flex items-center justify-center">
              <SentistreamLogo size={22} />
            </div>
            <span className="font-bold text-lg text-foreground">
              Senti<span className="text-primary">Stream</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowAbout(true)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </button>
            <Button
              size="sm"
              onClick={handleGetStarted}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5"
            >
              Get Started
            </Button>
          </div>
        </GlassCard>
      </nav>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowAbout(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl animate-fade-in-up">
            <GlassCard className="p-8 border border-border/50">
              {/* Close button */}
              <button
                onClick={() => setShowAbout(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Content */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-white/10 flex items-center justify-center">
                    <SentistreamLogo size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      About Senti<span className="text-primary">Stream</span> AI
                    </h2>
                    <p className="text-muted-foreground text-sm">Real-time Sentiment Intelligence</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                <div className="grid gap-4">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      AI-Powered Analytics
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      SentiStream AI leverages advanced machine learning and natural language processing
                      to deliver precise sentiment analysis across millions of data points in real-time.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      News &amp; Current Events
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Monitor public sentiment on breaking news, political developments, and global events
                      with our comprehensive news analysis engine.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      Product &amp; Brand Intelligence
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Track brand perception, analyze product reviews, and understand consumer sentiment
                      to make data-driven business decisions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">Powered by</span>
                  <span className="text-xs font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Advanced AI Technology
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  );
}
