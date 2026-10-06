// Compatibility for older Chrome/Edge versions: pdf.js uses Math.sumPrecise (ES2026).
const M = Math as Math & { sumPrecise?: (xs: Iterable<number>) => number };
if (typeof M.sumPrecise !== 'function') {
  M.sumPrecise = (xs: Iterable<number>) => {
    // Neumaier compensated summation
    let sum = 0, c = 0;
    for (const x of xs) { const t = sum + x; c += Math.abs(sum) >= Math.abs(x) ? (sum - t) + x : (x - t) + sum; sum = t; }
    return sum + c;
  };
}
export {};
