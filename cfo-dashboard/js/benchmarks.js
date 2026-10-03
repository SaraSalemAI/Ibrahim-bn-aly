/* Sector benchmarks.
 * For each ratio: good / bad = status boundaries, typical = an indicative sector value shown for comparison.
 * These are rules of thumb from common practice, not published market statistics; the page says so.
 * A sector lists only the ratios where it differs from "general"; everything else falls back to general,
 * and general falls back to the defaults on each ratio in js/analysis.js.
 */
(function (CFO) {
  // [good, bad, typical]
  const SECTORS = {
    general: { en: 'General', ar: 'عام', r: {
      current_ratio: [1.5, 1.0, 1.5], quick_ratio: [1.0, 0.7, 1.0], cash_ratio: [0.5, 0.2, 0.4], ocf_ratio: [0.4, 0.2, 0.4],
      gross_margin: [0.35, 0.15, 0.35], ebitda_margin: [0.15, 0.05, 0.15], operating_margin: [0.10, 0.03, 0.10], net_margin: [0.08, 0.02, 0.07],
      roa: [0.06, 0.02, 0.06], roe: [0.15, 0.05, 0.12], roce: [0.12, 0.05, 0.12],
      asset_turnover: [1.0, 0.5, 0.9], fixed_asset_turnover: [3, 1, 3], dso: [45, 90, 45], dio: [60, 120, 60], dpo: [null, null, 45], ccc: [60, 120, 60],
      debt_to_equity: [1.0, 2.0, 0.8], debt_ratio: [0.5, 0.7, 0.5], equity_multiplier: [2, 3, 2], interest_coverage: [3, 1.5, 5], net_debt_to_ebitda: [2, 4, 1.8],
      fcf_margin: [0.05, 0, 0.05], cash_conversion: [1.0, 0.8, 1.1], payout_ratio: [0.6, 1.0, 0.4], altman_z: [2.6, 1.1, 3.0] } },
    retail: { en: 'Trading & retail', ar: 'تجارة وتجزئة', r: {
      current_ratio: [1.2, 0.8, 1.2], quick_ratio: [0.5, 0.2, 0.4], gross_margin: [0.30, 0.15, 0.28], ebitda_margin: [0.08, 0.03, 0.08],
      operating_margin: [0.05, 0.02, 0.05], net_margin: [0.03, 0.01, 0.03], asset_turnover: [2.0, 1.2, 2.2], dso: [15, 40, 10],
      dio: [50, 100, 55], ccc: [30, 80, 35], debt_to_equity: [1.0, 2.0, 0.9], fcf_margin: [0.03, 0, 0.03] } },
    manufacturing: { en: 'Manufacturing', ar: 'صناعة', r: {
      current_ratio: [1.5, 1.0, 1.6], quick_ratio: [0.9, 0.6, 0.9], gross_margin: [0.30, 0.15, 0.28], ebitda_margin: [0.15, 0.06, 0.14],
      operating_margin: [0.10, 0.04, 0.09], net_margin: [0.07, 0.02, 0.06], asset_turnover: [0.9, 0.5, 0.8], dso: [50, 90, 55],
      dio: [70, 130, 75], ccc: [80, 140, 85], debt_to_equity: [0.8, 1.6, 0.7] } },
    services: { en: 'Services & technology', ar: 'خدمات وتقنية', r: {
      current_ratio: [1.3, 0.9, 1.5], quick_ratio: [1.2, 0.8, 1.3], gross_margin: [0.50, 0.30, 0.55], ebitda_margin: [0.20, 0.08, 0.20],
      operating_margin: [0.15, 0.05, 0.15], net_margin: [0.10, 0.03, 0.11], roe: [0.18, 0.06, 0.16], asset_turnover: [0.9, 0.5, 0.8],
      dso: [50, 90, 50], dio: [15, 45, 10], ccc: [40, 90, 40], debt_to_equity: [0.6, 1.5, 0.5], interest_coverage: [5, 2, 8],
      net_debt_to_ebitda: [1.5, 3, 1], fcf_margin: [0.10, 0, 0.10] } },
    construction: { en: 'Construction & real estate', ar: 'مقاولات وعقارات', r: {
      current_ratio: [1.3, 1.0, 1.3], gross_margin: [0.18, 0.08, 0.15], ebitda_margin: [0.10, 0.04, 0.09], operating_margin: [0.07, 0.02, 0.06],
      net_margin: [0.05, 0.01, 0.04], asset_turnover: [0.8, 0.4, 0.7], dso: [70, 120, 75], ccc: [80, 150, 85],
      debt_to_equity: [1.2, 2.5, 1.1], interest_coverage: [2.5, 1.3, 4], net_debt_to_ebitda: [2.5, 4.5, 2.5], fcf_margin: [0.03, 0, 0.03] } },
    food: { en: 'Food & beverage', ar: 'أغذية ومشروبات', r: {
      current_ratio: [1.2, 0.8, 1.2], quick_ratio: [0.6, 0.3, 0.6], gross_margin: [0.30, 0.15, 0.32], ebitda_margin: [0.12, 0.05, 0.12],
      operating_margin: [0.08, 0.03, 0.08], net_margin: [0.05, 0.015, 0.05], asset_turnover: [1.5, 0.8, 1.4], dso: [30, 60, 25],
      dio: [25, 60, 25], ccc: [25, 70, 25] } },
    healthcare: { en: 'Healthcare', ar: 'رعاية صحية', r: {
      quick_ratio: [1.2, 0.8, 1.2], gross_margin: [0.40, 0.20, 0.40], ebitda_margin: [0.16, 0.06, 0.16], operating_margin: [0.12, 0.04, 0.11],
      net_margin: [0.08, 0.02, 0.08], asset_turnover: [0.8, 0.4, 0.8], dso: [50, 90, 50], dio: [45, 100, 45], ccc: [50, 110, 55],
      debt_to_equity: [0.7, 1.5, 0.6] } },
  };

  let current = 'general';

  /** { good, bad, typical } for a ratio in a sector (default: the selected one). */
  function bench(id, sector = current) {
    const def = CFO.RATIO?.[id] || {};
    const row = SECTORS[sector]?.r[id] || SECTORS.general.r[id];
    if (!row) return { good: def.good, bad: def.bad, typical: null };
    return { good: row[0] ?? def.good, bad: row[1] ?? def.bad, typical: row[2] ?? null };
  }

  CFO.SECTORS = SECTORS;
  CFO.bench = bench;
  CFO.setSector = key => { current = SECTORS[key] ? key : 'general'; };
  CFO.getSector = () => current;
  CFO.sectorName = (key, lang) => (SECTORS[key] || SECTORS.general)[lang === 'ar' ? 'ar' : 'en'];
})(globalThis.CFO = globalThis.CFO || {});
