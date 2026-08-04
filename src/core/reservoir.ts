import { N_CHANNELS, RESERVOIR_SIZE } from "./types";
import type { FastState } from "./types";
import { addVec, l2norm, matVec, randMatrix, scaleVec, spectralRadius, tanhVec, zeros } from "./math";

/**
 * Fast temporal state r_t. A leaky-integrator echo-state network: fixed
 * random recurrent weights (rescaled to spectral radius < 1 for stable,
 * fading memory), a fixed random input projection, and a leak rate that
 * sets how quickly this layer forgets — the "milliseconds to seconds"
 * timescale from the design doc.
 */
export class Reservoir {
  private readonly Win: number[][];
  private readonly Wres: number[][];
  private state: number[];
  private readonly leak: number;

  constructor(leak = 0.35) {
    this.leak = leak;
    this.Win = randMatrix(RESERVOIR_SIZE, N_CHANNELS, 0.6);
    let Wres = randMatrix(RESERVOIR_SIZE, RESERVOIR_SIZE, 1);
    const radius = spectralRadius(Wres) || 1;
    const targetRadius = 0.9;
    Wres = Wres.map((row) => scaleVec(row, targetRadius / radius));
    this.Wres = Wres;
    this.state = zeros(RESERVOIR_SIZE);
  }

  step(input: number[], memoryBias: number[]): FastState {
    const fromInput = matVec(this.Win, input);
    const fromRecurrence = matVec(this.Wres, this.state);
    const preActivation = addVec(addVec(fromInput, fromRecurrence), memoryBias);
    const candidate = tanhVec(preActivation);
    // Leaky integration: state = (1-leak)*state + leak*candidate
    this.state = addVec(scaleVec(this.state, 1 - this.leak), scaleVec(candidate, this.leak));
    return { activations: [...this.state], norm: l2norm(this.state) };
  }

  get size() {
    return RESERVOIR_SIZE;
  }
}
