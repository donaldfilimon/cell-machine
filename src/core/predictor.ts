import { RESERVOIR_SIZE } from "./types";
import type { PredictorState } from "./types";
import { l2norm, matVec, outerUpdate, zeroMatrix } from "./math";

/**
 * theta_t: the slow world-model parameters. Kept deliberately simple, per
 * the design doc's note that adaptation should stay local and efficient —
 * an online linear map predicting r_{t+1} from r_t, updated only by the
 * error it actually made (a delta rule), not a full backprop pass.
 */
export class Predictor {
  private weights: number[][];
  private prevReservoir: number[] | null = null;
  private prevPrediction: number[] | null = null;
  private errorEma = 0;

  constructor(private readonly lr = 0.02, private readonly decay = 0.001) {
    this.weights = zeroMatrix(RESERVOIR_SIZE, RESERVOIR_SIZE);
  }

  step(current: number[]): PredictorState {
    let error = 0;
    if (this.prevPrediction) {
      const diff = current.map((x, i) => x - (this.prevPrediction![i] ?? 0));
      error = l2norm(diff) / Math.sqrt(RESERVOIR_SIZE);
      if (this.prevReservoir) {
        outerUpdate(this.weights, diff, this.prevReservoir, this.lr, this.decay);
      }
    }
    this.errorEma = this.errorEma * 0.93 + error * 0.07;

    const prediction = matVec(this.weights, current);
    // Keep the model's learning history independent of caller-owned arrays.
    this.prevReservoir = [...current];
    this.prevPrediction = [...prediction];

    return {
      weights: this.weights.map((row) => [...row]),
      lastPrediction: prediction,
      error,
      errorEma: this.errorEma,
    };
  }
}
