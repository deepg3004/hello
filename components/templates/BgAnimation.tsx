"use client";

import { useEffect, useState } from "react";

const KEYFRAMES = `
@keyframes invFall { 0%{transform:translateY(-12vh) translateX(0)} 100%{transform:translateY(112vh) translateX(24px)} }
@keyframes invRise { 0%{transform:translateY(112vh) rotate(0)} 100%{transform:translateY(-12vh) rotate(20deg)} }
@keyframes invSpin { 0%{transform:translateY(-12vh) rotate(0)} 100%{transform:translateY(112vh) rotate(420deg)} }
@keyframes invTwinkle { 0%,100%{opacity:.12} 50%{opacity:1} }
@keyframes invFloat { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-26px) translateX(14px)} }
`;

const CONFETTI = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

export function BgAnimation({ type }: { type?: string | null }) {
  // Render only after mount — purely decorative, avoids any hydration concern.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !type || type === "none") return null;

  const count = type === "space" ? 60 : type === "planet" ? 8 : 26;
  const items = Array.from({ length: count }, (_, i) => i);

  const node = (i: number) => {
    const left = (i * 37) % 100;
    const delay = ((i % 12) * 0.6).toFixed(2);
    const dur = 6 + (i % 8);
    const base: React.CSSProperties = {
      position: "absolute",
      left: `${left}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${dur}s`,
      animationIterationCount: "infinite",
      animationTimingFunction: "linear",
    };

    switch (type) {
      case "snow":
        return (
          <span key={i} style={{ ...base, top: "-5%", fontSize: 8 + (i % 3) * 4, color: "rgba(255,255,255,0.85)", animationName: "invFall" }}>
            ❄
          </span>
        );
      case "gift":
        return (
          <span key={i} style={{ ...base, fontSize: 18 + (i % 3) * 8, animationName: "invRise" }}>
            🎁
          </span>
        );
      case "party":
        return (
          <span
            key={i}
            style={{
              ...base,
              top: "-5%",
              width: 7 + (i % 3) * 3,
              height: 10 + (i % 3) * 3,
              borderRadius: 2,
              background: CONFETTI[i % CONFETTI.length],
              animationName: "invSpin",
            }}
          />
        );
      case "space":
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              borderRadius: "9999px",
              background: "#fff",
              animationName: "invTwinkle",
              animationDelay: `${(i % 10) * 0.4}s`,
              animationDuration: `${2 + (i % 4)}s`,
              animationIterationCount: "infinite",
            }}
          />
        );
      case "planet":
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${(i * 41) % 92}%`,
              top: `${(i * 29) % 88}%`,
              fontSize: 26 + (i % 3) * 14,
              opacity: 0.85,
              animationName: "invFloat",
              animationDelay: `${(i % 6) * 0.8}s`,
              animationDuration: `${7 + (i % 5)}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            }}
          >
            {["🪐", "🌍", "🌌", "⭐"][i % 4]}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <style>{KEYFRAMES}</style>
      {items.map(node)}
    </div>
  );
}
