import { N_CHANNELS } from "./types";
import type { CellSnapshot } from "./types";
import { StimulusGenerator } from "./stimuli";
import { Reservoir } from "./reservoir";
import { HabituationGate } from "./habituation";
import { AdaptiveMemory } from "./memory";
import { Predictor } from "./predictor";
import { EpisodicStore } from "./episodic";
import { Arbiter } from "./arbiter";
import { SymbolicPlanner, NOT_INVOKED } from "./symbolic";
import { SafetyGovernor } from "./governor";
import { addVec, l2norm, matVec, meanVec, randMatrix, scaleVec, tanhVec } from "./math";

/**
 * The Cell-State Adaptive Problem Solver, assembled. One tick = one full
 * pass through the layered hybrid architecture from the design doc:
 * reactive layer -> reservoir -> habituation gate -> predictor -> episodic
 * recall -> arbiter -> (react | predict | escalate to symbolic planner) ->
 * safety governor -> action.
 */
export class Cell {
  private readonly stimuli = new StimulusGenerator();
  private readonly reservoir = new Reservoir();
  private readonly habituation = new HabituationGate();
  private readonly memory = new AdaptiveMemory();
  private readonly predictor = new Predictor();
  private readonly episodic = new EpisodicStore();
  private readonly arbiter = new Arbiter();
  private readonly symbolic = new SymbolicPlanner();
  private readonly governor = new SafetyGovernor();
  private readonly Wout = randMatrix(N_CHANNELS, this.reservoir.size, 0.5);

  inject(kind: "novel" | "context-shift" | "rare-event" | "repeat") {
    this.stimuli.inject(kind);
  }

  tick(): CellSnapshot {
    const stimulus = this.stimuli.next();

    const habituationState = this.habituation.step(stimulus.channels);
    const memoryBiasIn = this.memory.bias();
    const gateModulatedInput = stimulus.channels.map((x, i) => x * (habituationState.gate[i] ?? 1));

    const fast = this.reservoir.step(gateModulatedInput, this.padToReservoir(memoryBiasIn));
    const predictorState = this.predictor.step(fast.activations);

    const avgGate = meanVec(habituationState.gate);
    const memoryState = this.memory.step(fast.activations, avgGate, predictorState.error);

    const salienceForEpisodic = avgGate * predictorState.error;
    this.episodic.maybeCommit(stimulus.t, fast.activations, stimulus.origin, salienceForEpisodic);
    const retrieved = this.episodic.retrieve(fast.activations);

    const decision = this.arbiter.decide(avgGate, predictorState.errorEma, retrieved);

    let action = tanhVec(matVec(this.Wout, fast.activations)).map(
      (x, i) => x * (habituationState.gate[i] ?? 1),
    );
    let symbolicResult = NOT_INVOKED;

    if (decision.mode === "predict" && predictorState.lastPrediction) {
      const predictedReadout = tanhVec(matVec(this.Wout, predictorState.lastPrediction));
      action = addVec(scaleVec(action, 0.6), scaleVec(predictedReadout, 0.4));
    } else if (decision.mode === "escalate") {
      const sign = meanVec(fast.activations) >= 0 ? 1 : -1;
      symbolicResult = this.symbolic.solve(predictorState.errorEma * sign);
      if (symbolicResult.plan) {
        const dampening = Math.max(0, 1 - symbolicResult.plan.length / 8);
        action = scaleVec(action, dampening);
      } else {
        // Budget exceeded: fall back to a conservative hold rather than
        // acting on an unresolved plan.
        action = scaleVec(action, 0.3);
      }
    }

    const governorFlags = this.governor.evaluate(avgGate, l2norm(stimulus.channels), decision.mode, symbolicResult);
    if (governorFlags.clamped) action = this.governor.clamp(action);

    return {
      t: stimulus.t,
      stimulus,
      fast: { norm: fast.norm },
      habituation: { gate: habituationState.gate, avgGate },
      memory: { salience: memoryState.salience },
      predictor: { error: predictorState.error, errorEma: predictorState.errorEma },
      episodic: { retrieved, storeSize: this.episodic.size },
      arbiter: decision,
      symbolic: symbolicResult,
      governor: governorFlags,
      action,
    };
  }

  private padToReservoir(v: number[]): number[] {
    const out = new Array(this.reservoir.size).fill(0);
    for (let i = 0; i < v.length && i < out.length; i++) out[i] = v[i]!;
    return out;
  }
}
