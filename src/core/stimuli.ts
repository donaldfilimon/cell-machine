import { N_CHANNELS } from "./types";
import type { Stimulus } from "./types";
import { randn } from "./math";

/**
 * Generates u_t. Left to run on its own it emits a repeated pulse pattern
 * (to drive habituation) buried in noise. Manual injections simulate the
 * three probe conditions the design doc's eval suite calls for:
 * repetition, novelty, and context shift.
 */
export class StimulusGenerator {
  private t = 0;
  private repeatPhase = 0;
  private pendingInjection: Stimulus["origin"] | null = null;
  private contextBias = 0;

  inject(kind: Stimulus["origin"]) {
    this.pendingInjection = kind;
  }

  next(): Stimulus {
    this.t += 1;
    const noise = () => randn() * 0.12;

    if (this.pendingInjection) {
      const origin = this.pendingInjection;
      this.pendingInjection = null;
      return this.build(origin);
    }

    // Ambient baseline: a slow repeating pulse (habituation target) + noise.
    this.repeatPhase += 1;
    const pulse = Math.sin(this.repeatPhase / 6) > 0.75 ? 0.9 : 0.05;
    const channels = new Array(N_CHANNELS)
      .fill(0)
      .map((_, i) => this.contextBias + (i === 0 ? pulse : 0.1) + noise());

    return { t: this.t, channels, origin: pulse > 0.5 ? "repeat" : "baseline" };
  }

  private build(origin: Stimulus["origin"]): Stimulus {
    const noise = () => randn() * 0.1;
    let channels: number[];
    switch (origin) {
      case "novel":
        // A sharp, high-magnitude transient on a channel that's normally quiet.
        channels = new Array(N_CHANNELS).fill(0).map((_, i) => (i === 2 ? 1.6 : 0.1) + noise());
        break;
      case "context-shift":
        // Shifts the ambient bias so the habituated baseline is now wrong everywhere.
        this.contextBias = this.contextBias > 0 ? -0.4 : 0.5;
        channels = new Array(N_CHANNELS).fill(0).map(() => this.contextBias + noise());
        break;
      case "rare-event":
        // High-value, low-frequency signal worth committing to episodic memory.
        channels = new Array(N_CHANNELS).fill(0).map((_, i) => (i === 3 ? 2.0 : 0.05) + noise());
        break;
      case "repeat":
        channels = new Array(N_CHANNELS).fill(0).map((_, i) => (i === 0 ? 0.9 : 0.1) + noise());
        break;
      default:
        channels = new Array(N_CHANNELS).fill(0).map(() => this.contextBias + noise());
    }
    return { t: this.t, channels, origin };
  }
}
