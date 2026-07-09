import { generateWorld } from "./src/world.ts";
import { renderContours } from "./src/render.ts";
import { worldReportMarkdown } from "./src/report.ts";
import { worldPosterSVG } from "./src/svgmap.ts";
import { encodePNG } from "./src/png.ts";
try {
  const w = generateWorld({ seed: "cartogenesis", width: 360, height: 360 });
  console.log("gen ok, volcanoes", w.meta.volcanoCount);
  const topo = renderContours(w.elevation, w.meta.seaLevel);
  console.log("topo ok", topo.length);
  const rep = worldReportMarkdown(w);
  console.log("report ok", rep.length);
  const poster = worldPosterSVG(w, encodePNG(360,360,topo));
  console.log("poster ok", poster.length);
} catch(e) {
  console.log("ERROR:", e.message);
  console.log(e.stack.split("\n").slice(0,4).join("\n"));
}
