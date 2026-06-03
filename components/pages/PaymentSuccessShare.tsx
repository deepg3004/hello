"use client";

import { useRef, useState } from "react";
import { Check, Download, Loader2, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaymentSuccessShareProps {
  amount: number; // rupees
  currency: string;
  productName: string;
  orderId: string;
  buyerName: string | null;
  sellerName: string | null;
  dateText: string;
  /** Public page URL to include in the share message (so friends can buy too). */
  shareUrl: string | null;
}

// WhatsApp brand mark (inline SVG — avoids an icon dep mismatch).
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.516 5.26l-.999 3.648 3.972-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export function PaymentSuccessShare({
  amount,
  currency,
  productName,
  orderId,
  buyerName,
  sellerName,
  dateText,
  shareUrl,
}: PaymentSuccessShareProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"img" | "dl" | "wa" | null>(null);

  const amountStr = `₹${amount.toLocaleString("en-IN")}`;
  const msg =
    `✅ Payment Successful!\n${amountStr} paid for ${productName}` +
    (sellerName ? ` from ${sellerName}` : "") +
    (shareUrl ? `\n\n${shareUrl}` : "");

  async function renderCanvas(): Promise<HTMLCanvasElement | null> {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: Math.min(3, window.devicePixelRatio * 2 || 2),
      useCORS: true,
      logging: false,
    });
  }

  function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  }

  // Share the rendered card as an IMAGE (Web Share L2). Falls back to a text
  // share, then to a download, so it always does something useful.
  async function shareImage() {
    setBusy("img");
    try {
      const canvas = await renderCanvas();
      const blob = canvas ? await toBlob(canvas) : null;
      const file = blob
        ? new File([blob], "payment-success.png", { type: "image/png" })
        : null;

      const nav = navigator as Navigator & {
        canShare?: (d: unknown) => boolean;
      };
      if (file && nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: "Payment Successful",
          text: msg,
        });
      } else if (navigator.share) {
        await navigator.share({ title: "Payment Successful", text: msg });
      } else if (file) {
        triggerDownload(file);
      }
    } catch {
      /* user dismissed the share sheet — ignore */
    } finally {
      setBusy(null);
    }
  }

  async function downloadImage() {
    setBusy("dl");
    try {
      const canvas = await renderCanvas();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob)
            triggerDownload(
              new File([blob], "payment-success.png", { type: "image/png" }),
            );
        }, "image/png");
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  // WhatsApp can't receive an image via a web link (wa.me is text-only). The
  // only way to send the receipt IMAGE to WhatsApp from the web is the native
  // share sheet with the file attached — the user taps WhatsApp there and the
  // image + caption go through. Desktop / unsupported → fall back to text.
  async function whatsappShare() {
    setBusy("wa");
    try {
      const canvas = await renderCanvas();
      const blob = canvas ? await toBlob(canvas) : null;
      const file = blob
        ? new File([blob], "payment-success.png", { type: "image/png" })
        : null;
      const nav = navigator as Navigator & {
        canShare?: (d: unknown) => boolean;
      };
      if (file && nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], text: msg });
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(msg)}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch {
      /* user dismissed the share sheet — ignore */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── The branded, shareable success card (this is what's captured) ── */}
      <div className="flex justify-center">
        <div
          ref={cardRef}
          className="w-full max-w-[360px] overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200"
        >
          {/* Header band */}
          <div
            className="relative px-6 pb-10 pt-7 text-center text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #6d28d9 0%, #4f46e5 55%, #06b6d4 120%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full"
              style={{ background: "rgba(255,255,255,0.14)" }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
              Payment Successful
            </p>
            <div className="mt-4 flex justify-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <Check className="h-6 w-6 text-emerald-500" strokeWidth={3.5} />
                </span>
              </span>
            </div>
            <p className="mt-4 font-sora text-4xl font-extrabold leading-none tracking-tight">
              {amountStr}
            </p>
            <p className="mt-1 text-xs text-white/75">{currency} · paid</p>
          </div>

          {/* Body — pulled up over the band */}
          <div className="-mt-5 rounded-t-3xl bg-white px-6 pb-5 pt-5">
            <p className="text-center font-sora text-base font-bold text-zinc-900">
              {productName}
            </p>
            {sellerName && (
              <p className="mt-0.5 text-center text-xs text-zinc-500">
                from {sellerName}
              </p>
            )}
            <dl className="mt-4 space-y-2 border-t border-dashed border-zinc-200 pt-4 text-sm">
              {buyerName && (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Paid by</dt>
                  <dd className="font-medium text-zinc-900">{buyerName}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Order ID</dt>
                <dd className="font-mono text-xs font-semibold text-zinc-900">
                  #{orderId.slice(0, 8).toUpperCase()}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Date</dt>
                <dd className="font-medium text-zinc-900">{dateText}</dd>
              </div>
            </dl>
          </div>

          {/* Brand + partner strip */}
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-3">
            <span className="font-sora text-sm font-bold text-zinc-900">
              Invox<span style={{ color: "#7c3aed" }}>AI</span>
            </span>
            <span className="text-[10px] font-medium text-zinc-500">
              🔒 Secured by Razorpay
            </span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        📸 Share your payment receipt with friends
      </p>

      {/* ── Share buttons — sticky bottom bar on mobile, inline on desktop ── */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-2 border-t border-zinc-200 bg-white/95 px-4 pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur",
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          "md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        )}
      >
        <button
          type="button"
          onClick={whatsappShare}
          disabled={busy === "wa"}
          className="btn-shine flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:brightness-95 disabled:opacity-60"
        >
          {busy === "wa" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <WhatsAppIcon className="h-5 w-5" />
          )}
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={shareImage}
          disabled={busy === "img"}
          className="btn-shine flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "img" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Share2 className="h-5 w-5" />
          )}
          Share
        </button>
        <button
          type="button"
          onClick={downloadImage}
          disabled={busy === "dl"}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "dl" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
