"use client";

import { useState } from "react";
import { AILoadingScreen } from "@/components/ai-loading-screen";
import { Button } from "@/components/ui/button";

export default function LoadingDemoPage() {
  const [showLoading, setShowLoading] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {showLoading && <AILoadingScreen />}
      
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">Loading Screen Demo</h1>
        <p className="text-muted-foreground">
          Click the button below to toggle the AI loading screen
        </p>
        <Button
          onClick={() => setShowLoading(!showLoading)}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
        >
          {showLoading ? "Hide Loading Screen" : "Show Loading Screen"}
        </Button>
      </div>
    </div>
  );
}
