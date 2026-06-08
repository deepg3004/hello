"use client";

import { usePathname } from "next/navigation";

import { PolicyFooter } from "./PolicyFooter";

/** Strip a `/seller-host/<username>` prefix so we can match the buyer-visible
 *  path whether Next reports the rewritten path or the public one. */
function publicPath(p: string): string {
  const m = p.match(/^\/seller-host\/[^/]+(\/.*|$)/);
  return m ? m[1] || "/" : p;
}

/**
 * Renders the compliance PolicyFooter EXCEPT on the themed storefront pages,
 * which carry their own branded footer (with the same Privacy/Terms/Refund/
 * Contact links + "Powered by InvoxAI"). Avoids a duplicate footer there while
 * keeping the legal links on checkout / marketing pages that still need them.
 */
export function ConditionalPolicyFooter({ hideRoot = false }: { hideRoot?: boolean }) {
  const p = publicPath(usePathname() || "/");
  const onStorefront =
    p.startsWith("/store") ||
    p.startsWith("/course") ||
    p.startsWith("/c/") ||
    p.startsWith("/legal") ||
    p.startsWith("/account") ||
    (hideRoot && (p === "/" || p === ""));
  if (onStorefront) return null;
  return <PolicyFooter />;
}
