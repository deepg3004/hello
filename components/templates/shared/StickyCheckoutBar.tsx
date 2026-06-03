"use client";

interface StickyCheckoutBarProps {
  /** Target anchor (no #) — clicking the button scrolls there smoothly. */
  targetId: string;
  /** Display price, e.g. "₹999". */
  priceLabel: string;
  /** Button label. */
  cta: string;
  /** Tailwind colour class for the button bg. */
  buttonClassName?: string;
  /** Inline style for the button (e.g. theme accent background). */
  buttonStyle?: React.CSSProperties;
  /** Inline style for the bar container (e.g. a dark themed background). */
  barStyle?: React.CSSProperties;
  /** Tailwind classes for the bar container (defaults to a light bar). */
  barClassName?: string;
}

export function StickyCheckoutBar({
  targetId,
  priceLabel,
  cta,
  buttonClassName = "bg-primary text-primary-foreground",
  buttonStyle,
  barStyle,
  barClassName = "border-t bg-white",
}: StickyCheckoutBarProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 px-4 py-3 shadow-2xl md:hidden ${barClassName}`}
      style={barStyle}
    >
      <a
        href={`#${targetId}`}
        style={buttonStyle}
        className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${buttonClassName}`}
        onClick={(e) => {
          const target = document.getElementById(targetId);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
      >
        <span>{cta}</span>
        <span className="opacity-90">— {priceLabel}</span>
      </a>
    </div>
  );
}
