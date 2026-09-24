import { expect, test } from "bun:test";
import { Predictor } from "./predictor";
import { RESERVOIR_SIZE } from "./types";

function vector(): number[] {
  return Array.from({ length: RESERVOIR_SIZE }, () => 0);
}

test("Predictor snapshots its input before learning on the next step", () => {
  const predictor = new Predictor(1, 0);
  const previous = vector();
  previous[0] = 1;

  predictor.step(previous);
  previous[0] = 100;

  const current = vector();
  current[0] = 1;
  const state = predictor.step(current);

  expect(state.weights[0]![0]).toBe(1);
});

test("mutating a returned state cannot change Predictor's private history", () => {
  const predictor = new Predictor(1, 0);
  const first = vector();
  first[0] = 1;
  const exposed = predictor.step(first);

  exposed.lastPrediction![0] = 100;
  exposed.weights[0]![0] = 100;

  const next = predictor.step(vector());
  expect(next.error).toBe(0);
  expect(next.weights[0]![0]).toBe(0);
});
