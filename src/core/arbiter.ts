import type { ArbiterMode, EpisodicTrace } from "./types";

const GATE_REACT_THRESHOLD = 0.25;
const ESCALATE_ERROR_THRESHOLD = 0.5;

export interface ArbiterDecision {
  mode: ArbiterMode;
  reason: string;
}

/**
 * Combines the habituation gate, the predictor's confidence, and episodic
 * recall into a single mode choice each tick. Episodic recall is checked
 * first, per the design doc: if the current state resembles a stored
 * high-value experience, that recall can resolve things before any
 * deliberation is needed at all.
 */
export class Arbiter {
  decide(avgGate: number, errorEma: number, episodicMatch: EpisodicTrace | null): ArbiterDecision {
    if (episodicMatch) {
      return {
        mode: "predict",
        reason: `recognized a prior "${episodicMatch.tag}" episode (t=${episodicMatch.t}, value ${episodicMatch.value.toFixed(2)}) — recalling instead of recomputing`,
      };
    }
    if (avgGate < GATE_REACT_THRESHOLD) {
      return { mode: "react", reason: "gate mostly closed: stimulus is habituated, direct reaction suffices" };
    }
    if (errorEma < ESCALATE_ERROR_THRESHOLD) {
      return { mode: "predict", reason: "novel but within the world model's competence — predicting ahead" };
    }
    return {
      mode: "escalate",
      reason: "sustained novelty and prediction error exceed predictive competence — recruiting symbolic planner",
    };
  }
}
