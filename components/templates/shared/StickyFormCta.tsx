"use client";

// Mobile-only sticky bottom CTA for landing / lead pages. Smooth-scrolls to the
// opt-in form (an element with id = targetId). Mirrors the Telegram page's
// mobile bottom bar so every page has a thumb-friendly conversion button.

export function StickyFormCta({
  label = "Get instant access",
  accent = "#10b981",
  targetId = "signup",
}: {
  label?: string;
  accent?: string;
  targetId?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <button
        type="button"
        onClick={() =>
          document
            .getElementById(targetId)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
        className="btn-shine w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98]"
        style={{ backgroundColor: accent }}
      >
        {label}
      </button>
    </div>
  );
}
