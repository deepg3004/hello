"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

// Brand-palette confetti. Self-contained canvas burst (no dependency) fired
// once on mount — used on payment/order success. Honors reduced-motion.
const COLORS = ["#7C3AED", "#06B6D4", "#A855F7", "#FACC15", "#10B981"];

export function Confetti({ duration = 2400 }: { duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = canvas.width / 2;
    const cy = canvas.height * 0.32;
    const parts: Particle[] = Array.from({ length: 150 }, () => ({
      x: cx + (Math.random() - 0.5) * 220 * dpr,
      y: cy,
      vx: (Math.random() - 0.5) * 15 * dpr,
      vy: (Math.random() * -15 - 4) * dpr,
      size: (4 + Math.random() * 5) * dpr,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.32,
    }));

    const g = 0.42 * dpr;
    const start = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      for (const p of parts) {
        p.vy += g;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (elapsed < duration) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [duration]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] h-screen w-screen"
    />
  );
}
