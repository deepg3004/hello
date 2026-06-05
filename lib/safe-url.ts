// Guard for server-side fetches to user-supplied URLs (seller webhooks). Blocks
// SSRF to loopback / private / link-local / cloud-metadata addresses. Callers
// should also pass `redirect: "manual"` so a public URL can't 30x into an
// internal one. Server-only (uses node:dns).

import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(addr: string): boolean {
  let ip = addr;
  // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1]!;

  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true; // malformed → treat as unsafe
    }
    const [a, b] = p as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true; // loopback / unspecified
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA fc00::/7
  if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) {
    return true; // link-local fe80::/10
  }
  return false;
}

/**
 * Throws if `raw` is not a public http(s) URL safe to fetch server-side.
 * Resolves DNS and rejects any address in a private/loopback/metadata range.
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("URL must use http(s)");
  }
  const host = u.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("URL points to a private/internal address");
    return;
  }
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new Error("URL points to an internal host");
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve host");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("URL resolves to a private/internal address");
  }
}
