// =============================================================================
// safeNext — sanitise the `?next=` parameter we round-trip through the login
// flow and the Supabase auth callback. Without this, an attacker can craft
//   /login?next=https://evil.example.com/phishing
// and a freshly-logged-in user gets bounced off the platform onto a spoof
// page that still feels like InvoxAI.
//
// Rules:
//   * Must be a string.
//   * Must start with exactly one '/' and not '//' or '/\' (protocol-relative).
//   * Must not contain a backslash (some browsers fold "\\evil.com" → host).
//   * Must not be the bare login/signup/auth paths (those would just bounce).
//   * Falls back to `fallback` (default '/dashboard') when invalid.
// =============================================================================

const BAD_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/",
];

export function safeNext(
  candidate: unknown,
  fallback: string = "/dashboard",
): string {
  if (typeof candidate !== "string") return fallback;
  if (candidate.length === 0 || candidate.length > 512) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (candidate.includes("\\")) return fallback;
  // Block obvious bounce loops. Prefixes that already end in "/" (e.g.
  // "/auth/") match any sub-path directly; others match the exact path or a
  // "/"- or "?"-delimited sub-path so "/loginhelp" is NOT treated as "/login".
  for (const p of BAD_PREFIXES) {
    const matches = p.endsWith("/")
      ? candidate.startsWith(p)
      : candidate === p ||
        candidate.startsWith(p + "/") ||
        candidate.startsWith(p + "?");
    if (matches) return fallback;
  }
  return candidate;
}
