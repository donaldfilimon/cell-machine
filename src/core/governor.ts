import type { ArbiterMode, GovernorFlags, SymbolicResult } from "./types";
import { l2norm, scaleVec } from "./math";

const LOW_GATE_INPUT_FLOOR = 0.5;
const HABITUATION_STREAK_LIMIT = 90; // ticks
const PERSEVERATION_STREAK_LIMIT = 6; // consecutive exhausted escalations
const MAX_ACTION_NORM = 2.5;

/**
 * The audit layer the design doc calls for explicitly: it does not decide
 * behavior, it watches for the two named failure modes — ignoring signals
 * it should not ignore, and continuing to chase signals it should have
 * resolved by now — and clamps output when either fires.
 */
export class SafetyGovernor {
  private lowGateStreak = 0;
  private escalateStreak = 0;

  evaluate(avgGate: number, inputNorm: number, mode: ArbiterMode, symbolic: SymbolicResult): GovernorFlags {
    this.lowGateStreak = avgGate < 0.06 && inputNorm > LOW_GATE_INPUT_FLOOR ? this.lowGateStreak + 1 : 0;
    this.escalateStreak = mode === "escalate" && symbolic.budgetExceeded ? this.escalateStreak + 1 : 0;

    const pathologicalHabituation = this.lowGateStreak > HABITUATION_STREAK_LIMIT;
    const pathologicalPerseveration = this.escalateStreak > PERSEVERATION_STREAK_LIMIT;

    return {
      pathologicalHabituation,
      pathologicalPerseveration,
      clamped: pathologicalHabituation || pathologicalPerseveration,
    };
  }

  clamp(action: number[]): number[] {
    const norm = l2norm(action);
    return norm <= MAX_ACTION_NORM ? action : scaleVec(action, MAX_ACTION_NORM / norm);
  }
}
