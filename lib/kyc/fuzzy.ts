// Lightweight Levenshtein-based fuzzy match for name comparison between PAN
// and bank-penny-drop responses. Returns a similarity in [0, 1].

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|shri|smt|kumari|kum)\.?\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const v0 = new Array<number>(b.length + 1);
  const v1 = new Array<number>(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

/** Returns 0..1 similarity of two human names (order-insensitive token bag). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // Whole-string Levenshtein ratio.
  const lev = levenshtein(na, nb);
  const ratio = 1 - lev / Math.max(na.length, nb.length);

  // Token-bag jaccard — handles "Anil Kumar S" vs "Anil S Kumar".
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / new Set([...ta, ...tb]).size;

  // Blend the two — gives a more forgiving score when tokens overlap.
  return Math.max(ratio, 0.55 * ratio + 0.45 * jaccard);
}
