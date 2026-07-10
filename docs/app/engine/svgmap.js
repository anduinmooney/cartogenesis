// svgmap.ts — Labeled SVG map poster.
//
// PNG renders can't carry text; SVG can. This composes a rendered map (embedded
// as a PNG data-URI background) with vector labels for regions, settlements, and
// notable features — the first output where places are actually *named on the
// map*. The result is a single self-contained .svg poster.

                                        

function esc(s        )         {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

                                
                                                                             
                 
                                  
                    
 

/**
 * Build an SVG poster string. `backgroundDataUri` is a `data:image/png;base64,…`
 * URI of any rendered map for this world (terrain or biome), embedded as the
 * base layer and then labeled. Taking a data URI rather than a raw Buffer lets
 * this run in the browser too (from `canvas.toDataURL`), not only in Node.
 */
export function worldPosterSVG(
  world       ,
  backgroundDataUri        ,
  opts                = {},
)         {
  const W = world.meta.width;
  const H = world.meta.height;
  const dataUri = backgroundDataUri;

  const title =
    opts.title ??
    (world.history.realms[0]?.name || world.meta.capital || "Unknown World");
  const subtitle = opts.subtitle ?? `seed: ${world.meta.seed}`;

  const regionFont = Math.max(7, Math.round(W / 42));
  const townFont = Math.max(6, Math.round(W / 52));
  const titleFont = Math.max(14, Math.round(W / 22));

  const parts           = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
      `font-family="Georgia, 'Times New Roman', serif">`,
  );
  parts.push(`<image href="${dataUri}" x="0" y="0" width="${W}" height="${H}"/>`);

  // Reusable label style: white text with a dark outline for legibility.
  const labelStyle = (font        , weight = "400", italic = false) =>
    `fill="#fdfdfb" stroke="#1a1712" stroke-width="${Math.max(
      1.6,
      font / 6,
    )}" paint-order="stroke" font-size="${font}" font-weight="${weight}"` +
    (italic ? ` font-style="italic"` : "") +
    ` text-anchor="middle" dominant-baseline="middle"`;

  // --- Region labels (larger provinces only, to limit clutter). ---
  const regions = [...world.regions.regions].sort((a, b) => b.area - a.area);
  const labelCount = Math.min(regions.length, 14);
  parts.push(`<g opacity="0.92">`);
  for (let i = 0; i < labelCount; i++) {
    const r = regions[i];
    parts.push(
      `<text x="${r.cx}" y="${r.cy}" ${labelStyle(
        regionFont,
        "400",
        true,
      )} letter-spacing="0.5">${esc(r.name)}</text>`,
    );
  }
  parts.push(`</g>`);

  // --- Notable feature labels. ---
  parts.push(`<g>`);
  for (const f of world.history.features) {
    const prefix =
      f.kind === "peak" ? "▲ " : f.kind === "lake" ? "" : "";
    const label =
      f.kind === "river" ? `~ ${f.name}` : `${prefix}${f.name}`;
    parts.push(
      `<text x="${f.x}" y="${f.y}" ${labelStyle(townFont)} fill="#eafcff">${esc(
        label,
      )}</text>`,
    );
  }
  parts.push(`</g>`);

  // --- Settlements: markers + labels for cities and towns. ---
  parts.push(`<g>`);
  for (const s of world.settlements.settlements) {
    if (s.tier === "village") continue;
    const rad = s.isCapital ? 5 : s.tier === "city" ? 3.6 : 2.6;
    const fill = s.isCapital ? "#ffd24a" : s.tier === "city" ? "#fff4dc" : "#ffffff";
    parts.push(
      `<circle cx="${s.x}" cy="${s.y}" r="${rad}" fill="${fill}" stroke="#1a1712" stroke-width="1.2"/>`,
    );
    const font = s.isCapital || s.tier === "city" ? townFont + 1 : townFont;
    parts.push(
      `<text x="${s.x}" y="${s.y - rad - font * 0.5}" ${labelStyle(
        font,
        s.isCapital ? "700" : "400",
      )}>${esc(s.name)}</text>`,
    );
  }
  parts.push(`</g>`);

  // --- Title cartouche (bottom-left). ---
  const cw = Math.min(W * 0.6, title.length * titleFont * 0.62 + 24);
  const ch = titleFont * 2.1;
  const cx = 10;
  const cy = H - ch - 10;
  parts.push(
    `<g><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="4" ` +
      `fill="#0d1017" fill-opacity="0.66" stroke="#d9b25a" stroke-width="1"/>` +
      `<text x="${cx + 12}" y="${cy + ch * 0.44}" fill="#f4ead0" font-size="${titleFont}" ` +
      `font-weight="700" dominant-baseline="middle">${esc(title)}</text>` +
      `<text x="${cx + 12}" y="${cy + ch * 0.76}" fill="#9fb0c0" font-size="${Math.round(
        titleFont * 0.42,
      )}" font-style="italic" dominant-baseline="middle">Cartogenesis · ${esc(
        subtitle,
      )}</text></g>`,
  );

  parts.push(`</svg>`);
  return parts.join("\n");
}
