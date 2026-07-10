// markdown.ts — A tiny Markdown→HTML renderer for the gazetteer.
//
// Deliberately NOT a general Markdown implementation — it handles exactly the
// subset `src/report.ts` emits: ATX headings (# ## ###), unordered lists,
// GitHub-style tables, blockquotes, horizontal rules, and inline **bold** /
// *italic*. A dependency would be absurd for this, and we control both ends.
//
// Security: every input is HTML-escaped BEFORE any formatting runs, so a world
// whose name happens to contain "<script>" (it can't today, but defence in
// depth) renders as text, never as markup. Formatting then inserts only a fixed
// vocabulary of tags of our own.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline spans: **bold** and *italic*. Operates on already-escaped text. */
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Slugify a heading's text into a stable id for the table of contents. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A heading discovered while rendering — feeds the table of contents. */
export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

/**
 * Render the report's Markdown subset to HTML. Returns the HTML plus the list
 * of `##`/`###` headings (with ids) so the caller can build a table of contents
 * and scroll to sections.
 */
export function renderMarkdown(md: string): RenderResult {
  const lines = md.split("\n");
  const out: string[] = [];
  const headings: Heading[] = [];
  let i = 0;

  const closeList = (stack: string[]) => {
    while (stack.length) out.push(stack.pop()!);
  };
  const listStack: string[] = [];

  while (i < lines.length) {
    const raw = lines[i];

    // Table: a header row, a separator row of dashes, then body rows.
    if (
      raw.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      closeList(listStack);
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const header = cells(raw);
      out.push('<table><thead><tr>');
      for (const h of header) out.push(`<th>${inline(escapeHtml(h))}</th>`);
      out.push("</tr></thead><tbody>");
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].includes("|")) {
        const row = cells(lines[i]);
        out.push("<tr>");
        for (let c = 0; c < header.length; c++) {
          out.push(`<td>${inline(escapeHtml(row[c] ?? ""))}</td>`);
        }
        out.push("</tr>");
        i++;
      }
      out.push("</tbody></table>");
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(raw);
    if (heading) {
      closeList(listStack);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text);
      if (level >= 2 && level <= 3) headings.push({ level, text, id });
      out.push(
        `<h${level} id="${id}">${inline(escapeHtml(text))}</h${level}>`,
      );
      i++;
      continue;
    }

    if (/^\s*---\s*$/.test(raw)) {
      closeList(listStack);
      out.push("<hr>");
      i++;
      continue;
    }

    const li = /^(\s*)-\s+(.*)$/.exec(raw);
    if (li) {
      if (!listStack.length) {
        out.push("<ul>");
        listStack.push("</ul>");
      }
      out.push(`<li>${inline(escapeHtml(li[2]))}</li>`);
      i++;
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(raw);
    if (quote) {
      closeList(listStack);
      out.push(`<blockquote>${inline(escapeHtml(quote[1]))}</blockquote>`);
      i++;
      continue;
    }

    if (raw.trim() === "") {
      closeList(listStack);
      i++;
      continue;
    }

    closeList(listStack);
    out.push(`<p>${inline(escapeHtml(raw))}</p>`);
    i++;
  }
  closeList(listStack);

  return { html: out.join("\n"), headings };
}
