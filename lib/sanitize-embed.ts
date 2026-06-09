// Best-effort hardening for the seller "custom HTML / embed" block.
//
// This is NOT a full HTML sanitizer (we don't pull in DOMPurify on the server),
// and the embed is the seller's OWN content on their OWN site — but a team
// member with only `pages.manage` (not the account owner) could otherwise plant
// script that runs for buyers and for the owner. So we strip the three obvious
// active-content vectors while leaving legitimate markup (iframes, styles,
// links, images) intact. Defense-in-depth, not a guarantee.
export function sanitizeEmbedHtml(html: string): string {
  if (!html) return "";
  return (
    html
      // <script>…</script> and self-closing/standalone <script ...>
      .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*script\b[^>]*>/gi, "")
      // inline event handlers: onclick=, onload=, onerror=, … (quoted or bare)
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      // javascript: and data:text/html URIs in href/src/etc.
      .replace(/(?:href|src|xlink:href)\s*=\s*"(?:javascript:|data:text\/html)[^"]*"/gi, "")
      .replace(/(?:href|src|xlink:href)\s*=\s*'(?:javascript:|data:text\/html)[^']*'/gi, "")
  );
}
