import { RESERVOIR_SIZE } from "./types";
import type { MemoryState } from "./types";
import { addVec, l2norm, scaleVec, zeros } from "./math";

const SALIENCE_THRESHOLD = 0.12;

/**
 * m_t: the "minutes to days" layer. A single trace vector that only moves
 * when the moment was actually worth remembering — gate open (novel) AND
 * prediction error high (surprising) — otherwise it slowly forgets. This
 * feeds back into the reservoir as a bias, so the machine's fast reactions
 * are colored by what recently mattered, without needing an explicit rule.
 */
export class AdaptiveMemory {
  private trace: number[];
  private salience = 0;

  constructor(private readonly decayRate = 0.015, private readonly reinforceRate = 0.3) {
    this.trace = zeros(RESERVOIR_SIZE);
  }

  step(reservoirState: number[], avgGate: number, predictionError: number): MemoryState {
    const salienceSignal = avgGate * predictionError;

    if (salienceSignal > SALIENCE_THRESHOLD) {
      const norm = l2norm(reservoirState) || 1;
      const normalized = scaleVec(reservoirState, 1 / norm);
      this.trace = addVec(scaleVec(this.trace, 1 - this.reinforceRate), scaleVec(normalized, this.reinforceRate));
      this.salience = Math.min(1, this.salience + salienceSignal);
    } else {
      this.trace = scaleVec(this.trace, 1 - this.decayRate);
      this.salience = Math.max(0, this.salience * (1 - this.decayRate * 2));
    }

    return { trace: [...this.trace], salience: this.salience };
  }

  /** The bias this memory currently exerts back onto the fast reservoir layer. */
  bias(): number[] {
    return scaleVec(this.trace, this.salience * 0.5);
  }
}
