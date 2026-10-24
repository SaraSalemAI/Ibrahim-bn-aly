"use client";

/** Small dependency-free SVG charts. Colours come from CSS variables so they follow the theme. */

export function Waterfall({ items, format, height = 260 }: { items: Array<{ label: string; value: number; total?: boolean }>; format: (n: number) => string; height?: number }) {
  if (!items.length) return null;
  let run = 0;
  const bars = items.map((it) => {
    const start = it.total ? 0 : run;
    const end = it.total ? it.value : run + it.value;
    run = end;
    return { ...it, start, end };
  });
  const vals = bars.flatMap((b) => [b.start, b.end, 0]);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const pad = 30;
  const w = Math.max(560, items.length * 70);
  const y = (v: number) => pad + ((max - v) / (max - min || 1)) * (height - pad * 2);
  const bw = (w - 40) / items.length;
  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${w} ${height + 40}`} width="100%" style={{ maxWidth: w }} role="img" className="chart">
        <line x1={20} x2={w - 20} y1={y(0)} y2={y(0)} className="axis" />
        {bars.map((b, i) => {
          const top = y(Math.max(b.start, b.end));
          const h = Math.max(1, Math.abs(y(b.start) - y(b.end)));
          const cls = b.total ? "bar-total" : b.value >= 0 ? "bar-pos" : "bar-neg";
          return (
            <g key={i}>
              <rect x={20 + i * bw + 6} y={top} width={bw - 12} height={h} className={cls} rx={3} />
              <text x={20 + i * bw + bw / 2} y={top - 6} textAnchor="middle" className="chart-val">
                {format(b.value)}
              </text>
              <text x={20 + i * bw + bw / 2} y={height + 14} textAnchor="middle" className="chart-label">
                {b.label.length > 14 ? b.label.slice(0, 13) + "…" : b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Bars({ series, format, height = 220 }: { series: Array<{ label: string; values: Array<{ name: string; value: number | null }> }>; format: (n: number) => string; height?: number }) {
  const all = series.flatMap((s) => s.values.map((v) => v.value ?? 0));
  const max = Math.max(1, ...all.map(Math.abs));
  const groups = series.length;
  const per = series[0]?.values.length ?? 1;
  const w = Math.max(480, groups * per * 46 + 40);
  const gw = (w - 40) / groups;
  const pad = 26;
  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${w} ${height + 34}`} width="100%" style={{ maxWidth: w }} className="chart" role="img">
        {series.map((s, gi) =>
          s.values.map((v, vi) => {
            const bw = (gw - 16) / per;
            const val = v.value ?? 0;
            const h = (Math.abs(val) / max) * (height - pad * 2);
            const x = 20 + gi * gw + 8 + vi * bw;
            const yTop = height - pad - (val >= 0 ? h : 0);
            return (
              <g key={`${gi}-${vi}`}>
                <rect x={x + 2} y={yTop} width={bw - 4} height={Math.max(1, h)} className={`series-${vi}`} rx={3} />
                <text x={x + bw / 2} y={yTop - 5} textAnchor="middle" className="chart-val">
                  {v.value === null ? "—" : format(v.value)}
                </text>
              </g>
            );
          }),
        )}
        {series.map((s, gi) => (
          <text key={gi} x={20 + gi * gw + gw / 2} y={height + 10} textAnchor="middle" className="chart-label">
            {s.label.length > 18 ? s.label.slice(0, 17) + "…" : s.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function Legend({ names }: { names: string[] }) {
  return (
    <div className="legend">
      {names.map((n, i) => (
        <span key={n}>
          <i className={`swatch series-${i}`} /> {n}
        </span>
      ))}
    </div>
  );
}

export function Heatmap({ xs, ys, grid, fx, fy, fv }: { xs: number[]; ys: number[]; grid: number[][]; fx: (n: number) => string; fy: (n: number) => string; fv: (n: number) => string }) {
  const flat = grid.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const t = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  return (
    <div className="scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th />
            {xs.map((x, i) => (
              <th key={i} className="num">{fx(x)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y, yi) => (
            <tr key={yi}>
              <th className="num">{fy(y)}</th>
              {grid[yi].map((v, xi) => (
                <td key={xi} className="num heat" style={{ ["--t" as string]: t(v) }}>
                  {fv(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FootballField({ bars, format }: { bars: Array<{ label: string; low: number; high: number; mid: number }>; format: (n: number) => string }) {
  if (!bars.length) return null;
  const min = Math.min(0, ...bars.map((b) => b.low));
  const max = Math.max(...bars.map((b) => b.high));
  const w = 640;
  const left = 170;
  const x = (v: number) => left + ((v - min) / (max - min || 1)) * (w - left - 30);
  const rowH = 44;
  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${w} ${bars.length * rowH + 30}`} width="100%" style={{ maxWidth: w }} className="chart" role="img">
        {bars.map((b, i) => (
          <g key={b.label} transform={`translate(0, ${i * rowH + 10})`}>
            <text x={left - 8} y={18} textAnchor="end" className="chart-label">
              {b.label}
            </text>
            <rect x={x(b.low)} y={4} width={Math.max(2, x(b.high) - x(b.low))} height={20} className="bar-total" rx={3} />
            <line x1={x(b.mid)} x2={x(b.mid)} y1={0} y2={28} className="mid-line" />
            {x(b.high) - x(b.low) < 70 ? (
              <text x={(x(b.low) + x(b.high)) / 2} y={40} textAnchor="middle" className="chart-val">{`${format(b.low)} – ${format(b.high)}`}</text>
            ) : (
              <>
                <text x={x(b.low)} y={40} textAnchor="middle" className="chart-val">{format(b.low)}</text>
                <text x={x(b.high)} y={40} textAnchor="middle" className="chart-val">{format(b.high)}</text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Gauge({ value, zones, format }: { value: number; zones: Array<{ upTo: number; cls: string; label: string }>; format: (n: number) => string }) {
  const max = zones[zones.length - 1].upTo;
  const pos = Math.max(0, Math.min(1, value / max));
  let prev = 0;
  return (
    <div className="gauge">
      <div className="gauge-track">
        {zones.map((z) => {
          const width = ((z.upTo - prev) / max) * 100;
          prev = z.upTo;
          return (
            <div key={z.label} className={`gauge-zone ${z.cls}`} style={{ width: `${width}%` }}>
              {z.label}
            </div>
          );
        })}
        <div className="gauge-marker" style={{ insetInlineStart: `${pos * 100}%` }} title={format(value)} />
      </div>
      <div className="gauge-value">{format(value)}</div>
    </div>
  );
}
