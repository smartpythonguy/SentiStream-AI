"use client";

import { useEffect, useRef } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    // Particle system
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      color: string;
    }> = [];

    const colors = [
      "rgba(59, 130, 246, 0.6)",  // blue
      "rgba(249, 115, 22, 0.5)",  // orange
      "rgba(99, 102, 241, 0.4)",  // indigo
      "rgba(251, 146, 60, 0.4)",  // lighter orange
    ];

    // Initialize particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.008;

      // Draw flowing wave gradients
      const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient1.addColorStop(0, `rgba(59, 130, 246, ${0.08 + Math.sin(time) * 0.03})`);
      gradient1.addColorStop(0.5, `rgba(249, 115, 22, ${0.06 + Math.cos(time * 0.7) * 0.02})`);
      gradient1.addColorStop(1, `rgba(59, 130, 246, ${0.05 + Math.sin(time * 1.3) * 0.02})`);

      // Wave 1 - large flowing wave
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let x = 0; x <= canvas.width; x += 5) {
        const y = canvas.height * 0.7 + 
          Math.sin(x * 0.003 + time) * 80 +
          Math.sin(x * 0.006 + time * 1.5) * 40 +
          Math.cos(x * 0.002 + time * 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = gradient1;
      ctx.fill();

      // Wave 2 - secondary wave
      const gradient2 = ctx.createLinearGradient(canvas.width, 0, 0, canvas.height);
      gradient2.addColorStop(0, `rgba(249, 115, 22, ${0.06 + Math.cos(time * 0.8) * 0.02})`);
      gradient2.addColorStop(0.5, `rgba(59, 130, 246, ${0.08 + Math.sin(time * 1.1) * 0.03})`);
      gradient2.addColorStop(1, `rgba(249, 115, 22, ${0.04 + Math.cos(time) * 0.02})`);

      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let x = 0; x <= canvas.width; x += 5) {
        const y = canvas.height * 0.8 + 
          Math.cos(x * 0.004 + time * 0.8) * 60 +
          Math.sin(x * 0.007 + time * 1.2) * 30 +
          Math.sin(x * 0.002 + time * 0.3) * 50;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = gradient2;
      ctx.fill();

      // Wave 3 - top accent wave
      const gradient3 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height * 0.5);
      gradient3.addColorStop(0, `rgba(59, 130, 246, ${0.04 + Math.sin(time * 0.6) * 0.02})`);
      gradient3.addColorStop(1, `rgba(249, 115, 22, ${0.03 + Math.cos(time * 0.9) * 0.01})`);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= canvas.width; x += 5) {
        const y = canvas.height * 0.25 + 
          Math.sin(x * 0.002 + time * 0.6) * 100 +
          Math.cos(x * 0.005 + time) * 50;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, 0);
      ctx.closePath();
      ctx.fillStyle = gradient3;
      ctx.fill();

      // Draw and update particles
      particles.forEach((p) => {
        // Update position with wave influence
        p.x += p.vx + Math.sin(time + p.y * 0.01) * 0.2;
        p.y += p.vy + Math.cos(time + p.x * 0.01) * 0.2;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity * (0.7 + Math.sin(time * 2 + p.x) * 0.3)})`);
        ctx.fill();

        // Add glow effect
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        const glowColor = p.color.replace(/[\d.]+\)$/, `${p.opacity * 0.15})`);
        ctx.fillStyle = glowColor;
        ctx.fill();
      });

      // Draw connecting lines between close particles
      ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.globalAlpha = 1 - distance / 150;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.9 }}
    />
  );
}
