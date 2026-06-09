"use client";

// Selectable animated page background. Sits behind the page content. Used by the
// editor preview and (Phase 6) the public page. Styles: solid | gradient | mesh
// | particles | video. Honors prefers-reduced-motion via CSS.

import { motion } from "framer-motion";

export type BackgroundStyle = "solid" | "gradient" | "mesh" | "particles" | "video";

export const BACKGROUND_OPTIONS: Array<[BackgroundStyle, string]> = [
  ["solid", "Solid"],
  ["gradient", "Animated gradient"],
  ["mesh", "Gradient mesh / blobs"],
  ["particles", "Floating particles"],
  ["video", "Background video"],
];

// Deterministic particle positions (no Math.random in render → stable SSR).
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.6,
  size: 6 + (i % 4) * 4,
  dur: 7 + (i % 5),
}));

export function AnimatedBackground({
  style = "gradient",
  videoUrl,
}: {
  style?: BackgroundStyle;
  videoUrl?: string;
}) {
  if (style === "solid") return null;

  if (style === "video" && videoUrl) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <video src={videoUrl} autoPlay muted loop playsInline className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-black/20" />
      </div>
    );
  }

  if (style === "gradient") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "linear-gradient(120deg,#6366f1,#8b5cf6,#ec4899,#22d3ee)",
          backgroundSize: "300% 300%",
          animation: "builderGradient 16s ease infinite",
          opacity: 0.18,
        }}
      >
        <style>{`@keyframes builderGradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          @media (prefers-reduced-motion: reduce){div[style*="builderGradient"]{animation:none!important}}`}</style>
      </div>
    );
  }

  if (style === "mesh") {
    const blobs = [
      { c: "#6366f1", x: "-10%", y: "-10%", d: 12 },
      { c: "#ec4899", x: "60%", y: "10%", d: 15 },
      { c: "#22d3ee", x: "20%", y: "60%", d: 18 },
    ];
    return (
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {blobs.map((b, i) => (
          <motion.div
            key={i}
            className="absolute h-72 w-72 rounded-full blur-3xl"
            style={{ background: b.c, left: b.x, top: b.y, opacity: 0.25 }}
            animate={{ x: [0, 40, -30, 0], y: [0, -30, 30, 0] }}
            transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  // particles
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-indigo-400/40"
          style={{ left: `${p.left}%`, bottom: -20, width: p.size, height: p.size }}
          animate={{ y: [0, -380], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
