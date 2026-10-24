import { round2, type PeriodFigures } from "./engine";

const div = (a: number, b: number) => (b === 0 ? null : a / b);
const r = (v: number | null, dp = 4) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

export function dupont(f: PeriodFigures) {
  const netMargin = div(f.netProfit, f.revenue);
  const assetTurnover = div(f.revenue, f.totalAssets);
  const equityMultiplier = div(f.totalAssets, f.totalEquity);
  const taxBurden = div(f.netProfit, f.ebt);
  const interestBurden = div(f.ebt, f.ebit);
  const ebitMargin = div(f.ebit, f.revenue);
  const prod = (xs: (number | null)[]) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a! * b!, 1));
  return {
    threeStep: { netMargin: r(netMargin), assetTurnover: r(assetTurnover), equityMultiplier: r(equityMultiplier), roe: r(prod([netMargin, assetTurnover, equityMultiplier])) },
    fiveStep: {
      taxBurden: r(taxBurden),
      interestBurden: r(interestBurden),
      ebitMargin: r(ebitMargin),
      assetTurnover: r(assetTurnover),
      equityMultiplier: r(equityMultiplier),
      roe: r(prod([taxBurden, interestBurden, ebitMargin, assetTurnover, equityMultiplier])),
    },
  };
}

/**
 * Altman Z''-score (1995 emerging-market / non-manufacturer model), which needs no market capitalisation:
 * Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4. Zones: > 2.60 safe, 1.10–2.60 grey, < 1.10 distress.
 */
export function altmanZ(f: PeriodFigures) {
  const ta = f.totalAssets;
  const x1 = div(f.currentAssets - f.currentLiabilities, ta);
  const x2 = div(f.retainedEarnings + f.legalReserve + f.netProfit, ta);
  const x3 = div(f.ebit, ta);
  const x4 = div(f.totalEquity, f.totalLiabilities);
  if (x1 === null || x2 === null || x3 === null || x4 === null) return { available: false as const, x1, x2, x3, x4, z: null, zone: null };
  const z = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
  const zone = z > 2.6 ? "safe" : z >= 1.1 ? "grey" : "distress";
  return { available: true as const, x1: r(x1), x2: r(x2), x3: r(x3), x4: r(x4), z: round2(z), zone };
}

/**
 * Beneish M-score (8-variable model). Above −1.78 suggests a higher likelihood of earnings manipulation.
 * TATA uses operating cash flow from the cash flow statement.
 */
export function beneishM(cur: PeriodFigures, prior: PeriodFigures, operatingCashFlow: number) {
  const netPpe = (f: PeriodFigures) => f.ppeGross + f.accumulatedDepreciation;
  const gm = (f: PeriodFigures) => div(f.grossProfit, f.revenue);
  const sga = (f: PeriodFigures) => f.sellingExpenses + f.adminExpenses;
  // 0/0 (e.g. no soft assets in either year) is read as "no change" = 1, the usual convention for the index.
  const q = (a: number | null, b: number | null) => (a === null || b === null ? null : b === 0 ? (a === 0 ? 1 : null) : a / b);
  const vars = {
    DSRI: q(div(cur.receivables, cur.revenue), div(prior.receivables, prior.revenue)),
    GMI: q(gm(prior), gm(cur)),
    AQI: q(div(cur.totalAssets - cur.currentAssets - netPpe(cur), cur.totalAssets), div(prior.totalAssets - prior.currentAssets - netPpe(prior), prior.totalAssets)),
    SGI: div(cur.revenue, prior.revenue),
    DEPI: q(div(prior.depreciation, prior.depreciation + netPpe(prior)), div(cur.depreciation, cur.depreciation + netPpe(cur))),
    SGAI: q(div(sga(cur), cur.revenue), div(sga(prior), prior.revenue)),
    LVGI: q(div(cur.currentLiabilities + cur.longTermDebt, cur.totalAssets), div(prior.currentLiabilities + prior.longTermDebt, prior.totalAssets)),
    TATA: div(cur.netProfit - operatingCashFlow, cur.totalAssets),
  };
  const missing = Object.entries(vars).filter(([, v]) => v === null).map(([k]) => k);
  const rounded = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, r(v)])) as Record<keyof typeof vars, number | null>;
  if (missing.length) return { available: false as const, vars: rounded, missing, m: null, flag: null };
  const v = vars as Record<keyof typeof vars, number>;
  const m =
    -4.84 + 0.92 * v.DSRI + 0.528 * v.GMI + 0.404 * v.AQI + 0.892 * v.SGI + 0.115 * v.DEPI - 0.172 * v.SGAI + 4.679 * v.TATA - 0.327 * v.LVGI;
  return { available: true as const, vars: rounded, missing, m: round2(m), flag: m > -1.78 };
}
