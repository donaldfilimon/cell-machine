import { expect, test, describe } from "bun:test";
import {
  addVec,
  cosineSim,
  l2norm,
  matVec,
  meanVec,
  randn,
  scaleVec,
  spectralRadius,
  tanhVec,
  zeroMatrix,
  zeros,
} from "./math";

describe("math", () => {
  test("a vector longer than the matrix row truncates instead of yielding NaN", () => {
    // This was the defect: `row[j]!` asserted non-null on an index that is
    // genuinely absent, so the product became NaN and spread through tanh, the
    // norms and every downstream reservoir state with nothing reporting it.
    expect(matVec([[1, 2]], [1, 2, 3])).toEqual([5]);
    // The opposite mismatch already behaved this way, so the two are now
    // consistent rather than one silently corrupting.
    expect(matVec([[1, 2, 3]], [1, 2])).toEqual([5]);
    expect(matVec([[1, 2]], [1, 2, 3])[0]).not.toBeNaN();
  });

  test("matVec computes the product and shapes the output by row count", () => {
    expect(matVec([[1, 0], [0, 1]], [4, 5])).toEqual([4, 5]);
    expect(matVec([[1, 2, 3], [4, 5, 6]], [1, 1, 1])).toEqual([6, 15]);
    expect(matVec([], [1, 2])).toEqual([]);
  });

  test("addVec keeps the left operand's length", () => {
    expect(addVec([1, 2], [1, 2, 3])).toEqual([2, 4]);
    expect(addVec([1, 2, 3], [1, 2])).toEqual([2, 4, 3]);
  });

  test("cosine similarity is bounded, symmetric and zero-safe", () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12);
    expect(cosineSim([1, 0], [-1, 0])).toBeCloseTo(-1, 12);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 12);
    // A zero vector has no direction; returning 0 avoids a divide-by-zero NaN.
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
    expect(cosineSim([], [])).toBe(0);
    // Mismatched lengths must not make the measure order-dependent.
    expect(cosineSim([1, 0], [1, 0, 5])).toBeCloseTo(cosineSim([1, 0, 5], [1, 0]), 12);
  });

  test("norms and means are defined on the empty vector", () => {
    expect(l2norm([])).toBe(0);
    expect(meanVec([])).toBe(0);
    expect(l2norm([3, 4])).toBeCloseTo(5, 12);
    expect(meanVec([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
  });

  test("elementwise helpers preserve shape", () => {
    expect(zeros(3)).toEqual([0, 0, 0]);
    expect(zeros(0)).toEqual([]);
    expect(zeroMatrix(2, 3)).toEqual([[0, 0, 0], [0, 0, 0]]);
    expect(scaleVec([1, -2, 3], 2)).toEqual([2, -4, 6]);
    const squashed = tanhVec([-100, 0, 100]);
    expect(squashed[0]).toBeCloseTo(-1, 12);
    expect(squashed[1]).toBe(0);
    expect(squashed[2]).toBeCloseTo(1, 12);
  });

  test("zeroMatrix rows are independent, not shared references", () => {
    // `Array(n).fill([])` style construction would alias every row, so a single
    // weight update would write to all of them.
    const m = zeroMatrix(2, 2);
    m[0]![0] = 9;
    expect(m[1]![0]).toBe(0);
  });

  test("power iteration recovers a known spectral radius", () => {
    // Dominant eigenvalue 3; the random start vector converges from anywhere
    // that is not exactly orthogonal to the dominant eigenvector.
    expect(spectralRadius([[3, 0], [0, 1]])).toBeCloseTo(3, 6);
    expect(spectralRadius([[0, 0], [0, 0]])).toBe(0);
  });

  test("randn is finite and roughly standard-normal", () => {
    // Box-Muller rejects u === 0, so a log(0) infinity must never appear.
    const samples = Array.from({ length: 4000 }, () => randn());
    expect(samples.every(Number.isFinite)).toBe(true);
    const mean = meanVec(samples);
    expect(Math.abs(mean)).toBeLessThan(0.15);
    const variance = meanVec(samples.map((x) => (x - mean) ** 2));
    expect(variance).toBeGreaterThan(0.7);
    expect(variance).toBeLessThan(1.3);
  });
});
