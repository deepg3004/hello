// Ephemeral store for live-preview payloads.
//
// The page-builder live preview used to base64-encode the ENTIRE page_config
// into the iframe URL (?v=...). For filled payment pages that URL exceeded
// nginx's default 8k header buffer, so nginx reset the request and Cloudflare
// surfaced a 520. Instead the editor now POSTs the values here, gets a short
// token, and the iframe loads /preview/[id]?k=<token> — a tiny URL.
//
// Storage is an in-process TTL map. That's sufficient because the app runs a
// single PM2 instance and a token is written + read within the same process,
// seconds apart; tokens are disposable (the editor re-POSTs on every edit). If
// the app is ever scaled to multiple instances, back this with Redis.

import { nanoid } from "nanoid";

interface Entry {
  json: string;
  exp: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 500;
const store = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [k, e] of store) {
    if (e.exp < now) store.delete(k);
  }
  // Hard cap: drop oldest if we somehow blow past the limit.
  if (store.size > MAX_ENTRIES) {
    const overflow = store.size - MAX_ENTRIES;
    let i = 0;
    for (const k of store.keys()) {
      if (i++ >= overflow) break;
      store.delete(k);
    }
  }
}

/** Stash a preview JSON blob; returns a short token to fetch it by. */
export function putPreview(json: string): string {
  sweep();
  const key = nanoid(10);
  store.set(key, { json, exp: Date.now() + TTL_MS });
  return key;
}

/** Fetch a stashed preview JSON blob (or null if missing / expired). */
export function getPreview(key: string): string | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return e.json;
}
