// Console builder — draws dashboard widgets in the browser with inline SVG (no chart library).
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { computeWidget, formatValue, type Row, type Widget } from "./widgets";

const PALETTE = ["#2f8f7a", "#d9822b", "#3b6fb6", "#b5487a", "#7f8f2a", "#8a5cc7", "#c0563f", "#4a9bb0"];
const NS = "http://www.w3.org/2000/svg";

export const WIDGET_CSS = `
.cbw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cbw{border:1px solid var(--cbw-line,#d0d7de);border-radius:12px;padding:12px 14px;background:var(--cbw-bg,#fff);color:var(--cbw-fg,#1f2328);display:flex;flex-direction:column;gap:8px;min-width:0}
.cbw.full{grid-column:1/-1}
.cbw h3{margin:0;font:600 13px/1.3 system-ui,sans-serif;display:flex;justify-content:space-between;gap:8px}
.cbw h3 button{border:0;background:transparent;color:var(--cbw-muted,#656d76);cursor:pointer;font-size:14px}
.cbw .v{font:700 30px/1.1 system-ui,sans-serif;font-variant-numeric:tabular-nums}
.cbw .m{font:12px system-ui,sans-serif;color:var(--cbw-muted,#656d76)}
.cbw svg{width:100%;height:auto;display:block}
.cbw svg text{font:11px system-ui,sans-serif;fill:var(--cbw-muted,#656d76)}
.cbw .legend{display:flex;flex-wrap:wrap;gap:6px 12px;font:12px system-ui,sans-serif}
.cbw .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:5px;vertical-align:-1px}
.cbw table{width:100%;border-collapse:collapse;font:12px system-ui,sans-serif}
.cbw th,.cbw td{text-align:start;padding:5px 6px;border-bottom:1px solid var(--cbw-line,#d0d7de);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
.cbw .tw{overflow-x:auto}
@media (max-width:640px){.cbw-grid{grid-template-columns:1fr}}
`;

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
const short = (s: string, n = 10) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function bars(points: { label: string; value: number }[], w: Widget): SVGElement {
  const W = 360, H = 180, pad = 26, max = Math.max(1, ...points.map((p) => p.value));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": w.title });
  const bw = (W - pad) / Math.max(1, points.length);
  points.forEach((p, i) => {
    const h = ((H - pad - 14) * p.value) / max;
    const r = svg("rect", { x: pad + i * bw + 3, y: H - pad - h, width: Math.max(4, bw - 6), height: Math.max(1, h), rx: 3, fill: PALETTE[0] });
    const t = svg("title", {}); t.textContent = `${p.label}: ${formatValue(w, p.value)}`; r.append(t);
    const lb = svg("text", { x: pad + i * bw + bw / 2, y: H - 8, "text-anchor": "middle" }); lb.textContent = short(p.label, Math.max(4, Math.floor(bw / 7)));
    s.append(r, lb);
  });
  const top = svg("text", { x: 0, y: 12 }); top.textContent = formatValue({ ...w, decimals: w.decimals ?? 0 }, max);
  s.append(top, svg("line", { x1: pad, x2: W, y1: H - pad, y2: H - pad, stroke: "currentColor", "stroke-opacity": 0.2 }));
  return s;
}

function line(points: { label: string; value: number }[], w: Widget): SVGElement {
  const W = 720, H = 200, pad = 30, max = Math.max(1, ...points.map((p) => p.value)), n = Math.max(1, points.length - 1);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": w.title });
  const xy = points.map((p, i) => [pad + ((W - pad * 2) * i) / n, H - pad - ((H - pad * 2) * p.value) / max] as const);
  s.append(svg("line", { x1: pad, x2: W - pad, y1: H - pad, y2: H - pad, stroke: "currentColor", "stroke-opacity": 0.2 }));
  if (xy.length > 1) s.append(svg("polyline", { points: xy.map((p) => p.join(",")).join(" "), fill: "none", stroke: PALETTE[2], "stroke-width": 2.5, "stroke-linejoin": "round" }));
  const every = Math.ceil(points.length / 8);
  xy.forEach(([x, y], i) => {
    const c = svg("circle", { cx: x, cy: y, r: 3.5, fill: PALETTE[2] });
    const t = svg("title", {}); t.textContent = `${points[i].label}: ${formatValue(w, points[i].value)}`; c.append(t);
    s.append(c);
    if (i % every === 0) { const lb = svg("text", { x, y: H - 10, "text-anchor": "middle" }); lb.textContent = points[i].label; s.append(lb); }
  });
  const top = svg("text", { x: 0, y: 14 }); top.textContent = formatValue({ ...w, decimals: w.decimals ?? 0 }, max); s.append(top);
  return s;
}

function pie(points: { label: string; value: number }[], w: Widget, legend: HTMLElement): SVGElement {
  const s = svg("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": w.title, style: "max-width:200px;margin:auto" });
  const total = points.reduce((a, p) => a + p.value, 0) || 1;
  let a0 = -Math.PI / 2;
  points.slice(0, 8).forEach((p, i) => {
    const a1 = a0 + (2 * Math.PI * p.value) / total, large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0, x1, y1] = [100 + 90 * Math.cos(a0), 100 + 90 * Math.sin(a0), 100 + 90 * Math.cos(a1), 100 + 90 * Math.sin(a1)];
    const path = points.length === 1 ? svg("circle", { cx: 100, cy: 100, r: 90, fill: PALETTE[0] }) : svg("path", { d: `M100 100 L${x0} ${y0} A90 90 0 ${large} 1 ${x1} ${y1} Z`, fill: PALETTE[i % PALETTE.length], stroke: "var(--cbw-bg,#fff)", "stroke-width": 2 });
    const t = svg("title", {}); t.textContent = `${p.label}: ${Math.round((p.value / total) * 100)}%`; path.append(t);
    s.append(path);
    const li = document.createElement("span"); const sw = document.createElement("i"); sw.style.background = PALETTE[i % PALETTE.length];
    li.append(sw, `${p.label} ${Math.round((p.value / total) * 100)}%`); legend.append(li);
    a0 = a1;
  });
  return s;
}

export interface RenderWidgetsOptions {
  /** Shows a remove button on each widget. */
  onRemove?: (index: number) => void;
}

/** Renders a dashboard of widgets into `target`. Returns nothing; call again to refresh. */
export function renderWidgets(target: HTMLElement, widgets: Widget[], datasets: Record<string, Row[]>, opts: RenderWidgetsOptions = {}): void {
  if (!document.getElementById("cbw-css")) { const st = document.createElement("style"); st.id = "cbw-css"; st.textContent = WIDGET_CSS; document.head.append(st); }
  const grid = document.createElement("div"); grid.className = "cbw-grid";
  widgets.forEach((w, i) => {
    const card = document.createElement("section"); card.className = "cbw" + (w.size === "full" || w.type === "line" || w.type === "table" ? " full" : "");
    const h = document.createElement("h3"); h.append(w.title);
    if (opts.onRemove) { const b = document.createElement("button"); b.type = "button"; b.textContent = "✕"; b.setAttribute("aria-label", `Remove ${w.title}`); b.onclick = () => opts.onRemove!(i); h.append(b); }
    card.append(h);
    const r = computeWidget(w, datasets);
    if (r.kind === "error") card.append(Object.assign(document.createElement("p"), { className: "m", textContent: r.message }));
    else if (r.kind === "kpi") {
      card.append(Object.assign(document.createElement("div"), { className: "v", textContent: r.text }));
      card.append(Object.assign(document.createElement("div"), { className: "m", textContent: `${w.metric ?? "count"}${w.field ? " of " + w.field : ""} · ${w.dataset}` }));
    } else if (r.kind === "table") {
      const tw = document.createElement("div"); tw.className = "tw";
      const t = document.createElement("table"), hr = document.createElement("tr");
      for (const c of r.columns) hr.append(Object.assign(document.createElement("th"), { textContent: c }));
      t.append(hr);
      for (const row of r.rows) { const tr = document.createElement("tr"); for (const c of r.columns) tr.append(Object.assign(document.createElement("td"), { textContent: row[c] === null || row[c] === undefined ? "—" : String(row[c]) })); t.append(tr); }
      tw.append(t); card.append(tw);
    } else if (!r.points.length) card.append(Object.assign(document.createElement("p"), { className: "m", textContent: "No data." }));
    else if (w.type === "pie") { const lg = document.createElement("div"); lg.className = "legend"; card.append(pie(r.points, w, lg), lg); }
    else card.append(w.type === "line" ? line(r.points, w) : bars(r.points, w));
    grid.append(card);
  });
  target.replaceChildren(grid);
}
