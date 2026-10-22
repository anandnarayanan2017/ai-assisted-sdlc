/** Benchmark statistics: the estimators used by HumanEval-style leaderboards. */

/**
 * Unbiased pass@k (Chen et al. 2021, "Evaluating Large Language Models Trained on Code"):
 * 1 - C(n-c, k) / C(n, k), for n samples of which c passed. Computed as a stable product.
 */
export function passAtK(n: number, c: number, k: number): number {
  if (k > n) throw new Error(`pass@${k} needs at least ${k} samples per task (got ${n})`);
  if (n - c < k) return 1;
  let miss = 1;
  for (let i = n - c + 1; i <= n; i++) miss *= 1 - k / i;
  return 1 - miss;
}

/** Wilson score interval for a binomial proportion (95% by default); honest at small n, unlike +/- 2*SE. */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
