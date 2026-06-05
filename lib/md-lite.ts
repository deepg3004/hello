// Tiny, SAFE markdown → HTML for seller section copy (no dependency, no raw
// HTML passthrough). Escapes everything first, then applies a small set of
// inline/block formats. Output is safe to use with dangerouslySetInnerHTML.
//
// Supported: **bold**, *italic*, `code`, [text](url), # / ## / ### headings,
// - bullet lists, and paragraph/line breaks.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // links [text](http...) — only http(s)/mailto, escaped already
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)/g, (_m, t, href) => {
    return `<a href="${href}" class="underline" target="_blank" rel="noreferrer">${t}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-black/10 px-1 text-[0.9em]">$1</code>');
  return out;
}

/** Render markdown-lite to a safe HTML string. */
export function mdLite(src: string | null | undefined): string {
  if (!src) return "";
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join("<br/>")}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      html.push(`<ul class="list-disc pl-5">${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length + 2; // h3..h5
      html.push(`<h${level} class="font-semibold">${inline(h[2])}</h${level}>`);
    } else if (li) {
      flushPara();
      list.push(li[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return html.join("");
}
