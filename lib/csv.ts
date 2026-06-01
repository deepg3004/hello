// RFC-4180-ish CSV serialisation. Quotes every field and doubles internal
// quotes, so commas / newlines / quotes in data never corrupt the output.

export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  return lines.join("\r\n");
}
