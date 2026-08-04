export function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

export function zeroMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => zeros(cols));
}

export function randn(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randMatrix(rows: number, cols: number, scale: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => randn() * scale));
}

export function matVec(m: number[][], v: number[]): number[] {
  const out = zeros(m.length);
  for (let i = 0; i < m.length; i++) {
    let s = 0;
    const row = m[i]!;
    for (let j = 0; j < v.length; j++) s += row[j]! * v[j]!;
    out[i] = s;
  }
  return out;
}

export function addVec(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + (b[i] ?? 0));
}

export function scaleVec(a: number[], s: number): number[] {
  return a.map((x) => x * s);
}

export function tanhVec(a: number[]): number[] {
  return a.map((x) => Math.tanh(x));
}

export function l2norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, x) => s + x * x, 0));
}

export function meanVec(a: number[]): number {
  return a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length;
}

export function cosineSim(a: number[], b: number[]): number {
  const na = l2norm(a);
  const nb = l2norm(b);
  if (na === 0 || nb === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * (b[i] ?? 0);
  return dot / (na * nb);
}

/** In-place Hebbian-delta update: W[i][j] += lr * err[i] * pre[j], with weight decay. */
export function outerUpdate(W: number[][], err: number[], pre: number[], lr: number, decay: number) {
  for (let i = 0; i < W.length; i++) {
    const row = W[i]!;
    const e = err[i]! * lr;
    for (let j = 0; j < row.length; j++) {
      row[j] = row[j]! * (1 - decay) + e * (pre[j] ?? 0);
    }
  }
}

/** Estimate the spectral radius of a square matrix via power iteration, for reservoir scaling. */
export function spectralRadius(m: number[][], iters = 50): number {
  let v = m.map(() => Math.random());
  let norm = l2norm(v);
  v = v.map((x) => x / norm);
  let lambda = 0;
  for (let i = 0; i < iters; i++) {
    const next = matVec(m, v);
    norm = l2norm(next);
    if (norm === 0) return 0;
    v = next.map((x) => x / norm);
    lambda = norm;
  }
  return lambda;
}
