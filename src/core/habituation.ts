import { N_CHANNELS } from "./types";
import type { HabituationState } from "./types";

/**
 * Implements the "negative feedback + incoherent feed-forward" motif from
 * the design doc's habituation literature: a slow-tracking baseline
 * (expectation), a novelty signal (deviation from that baseline), and a
 * gate whose suppression strengthens under sustained low novelty but whose
 * spontaneous recovery term keeps it from collapsing to zero and lets it
 * snap back open the moment novelty spikes. Two separated timescales —
 * baseline tracking vs. gate recovery — do the work, per the design doc.
 */
export class HabituationGate {
  private gate: number[];
  private baseline: number[];
  private ticksSinceNovelty: number[];

  constructor(
    private readonly baselineTrackRate = 0.15,
    private readonly recoveryRate = 0.04,
    private readonly habituationRate = 0.12,
    private readonly noveltyThreshold = 0.35,
  ) {
    this.gate = new Array(N_CHANNELS).fill(1);
    this.baseline = new Array(N_CHANNELS).fill(0);
    this.ticksSinceNovelty = new Array(N_CHANNELS).fill(0);
  }

  step(input: number[]): HabituationState {
    for (let i = 0; i < N_CHANNELS; i++) {
      const x = input[i] ?? 0;
      const prevBaseline = this.baseline[i] ?? 0;
      const novelty = Math.abs(x - prevBaseline);

      // Slow expectation tracking.
      this.baseline[i] = prevBaseline + this.baselineTrackRate * (x - prevBaseline);

      const suppressSignal = Math.max(0, Math.min(1, 1 - novelty / this.noveltyThreshold));
      const g = this.gate[i] ?? 1;
      const next =
        g + this.recoveryRate * (1 - g) - this.habituationRate * g * suppressSignal;
      this.gate[i] = Math.max(0.02, Math.min(1, next));

      this.ticksSinceNovelty[i] =
        novelty > this.noveltyThreshold ? 0 : (this.ticksSinceNovelty[i] ?? 0) + 1;
    }
    return { gate: [...this.gate], baseline: [...this.baseline], ticksSinceNovelty: [...this.ticksSinceNovelty] };
  }
}
