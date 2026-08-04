import type { EpisodicTrace, Stimulus } from "./types";
import { cosineSim } from "./math";

const COMMIT_THRESHOLD = 0.3;
const RETRIEVE_THRESHOLD = 0.72;

/**
 * e_t: rare, high-value experiences preserved indefinitely (bounded by
 * capacity, evicting the least valuable trace), distinct from the
 * medium-term memory's continuously-decaying single trace. Retrieval
 * happens before any heavyweight deliberation, per the design doc, so its
 * output can bias the arbiter's mode choice up front.
 */
export class EpisodicStore {
  private traces: EpisodicTrace[] = [];

  constructor(private readonly capacity = 40) {}

  maybeCommit(t: number, vector: number[], tag: Stimulus["origin"], value: number) {
    if (value < COMMIT_THRESHOLD) return;
    this.traces.push({ t, vector: [...vector], tag, value });
    if (this.traces.length > this.capacity) {
      let minIdx = 0;
      for (let i = 1; i < this.traces.length; i++) {
        if (this.traces[i]!.value < this.traces[minIdx]!.value) minIdx = i;
      }
      this.traces.splice(minIdx, 1);
    }
  }

  retrieve(current: number[]): EpisodicTrace | null {
    let best: EpisodicTrace | null = null;
    let bestSim = RETRIEVE_THRESHOLD;
    for (const trace of this.traces) {
      const sim = cosineSim(current, trace.vector);
      if (sim > bestSim) {
        bestSim = sim;
        best = trace;
      }
    }
    return best;
  }

  get size() {
    return this.traces.length;
  }
}
