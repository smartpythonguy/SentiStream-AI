"use client";

export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large blue orb - top right */}
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-30 blur-3xl animate-float-slow"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.2 250) 0%, transparent 70%)",
        }}
      />
      
      {/* Orange orb - bottom left */}
      <div
        className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-25 blur-3xl animate-float-medium"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.18 45) 0%, transparent 70%)",
        }}
      />
      
      {/* Small blue orb - center left */}
      <div
        className="absolute top-1/3 left-1/4 w-48 h-48 rounded-full opacity-20 blur-2xl animate-float-fast"
        style={{
          background: "radial-gradient(circle, oklch(0.6 0.18 250) 0%, transparent 70%)",
        }}
      />
      
      {/* Small orange orb - center right */}
      <div
        className="absolute top-1/2 right-1/4 w-40 h-40 rounded-full opacity-20 blur-2xl animate-float-reverse"
        style={{
          background: "radial-gradient(circle, oklch(0.75 0.15 45) 0%, transparent 70%)",
        }}
      />
      
      {/* Tiny accent orbs */}
      <div
        className="absolute top-1/4 right-1/3 w-24 h-24 rounded-full opacity-15 blur-xl animate-pulse"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.2 250) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-1/3 left-1/3 w-20 h-20 rounded-full opacity-15 blur-xl animate-pulse delay-1000"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.18 45) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
