// Shared types for the Cell-State Adaptive Problem Solver.
// x_t = { r_t, m_t, theta_t, e_t } per the design doc.

export const N_CHANNELS = 4;
export const RESERVOIR_SIZE = 48;

/** Raw multichannel stimulus at time t (u_t). */
export interface Stimulus {
  t: number;
  channels: number[]; // length N_CHANNELS
  /** Ground-truth label for what generated this tick, for the event log / eval only. */
  origin: "baseline" | "repeat" | "novel" | "context-shift" | "rare-event";
}

/** Fast dynamical state r_t: reservoir activations + their scalar norm. */
export interface FastState {
  activations: number[]; // length RESERVOIR_SIZE
  norm: number;
}

/** Per-channel habituation gate, i.e. the novelty filter sitting on r_t. */
export interface HabituationState {
  gate: number[]; // 0..1 per channel, 1 = fully salient / un-habituated
  baseline: number[]; // running habituated expectation per channel
  ticksSinceNovelty: number[];
}

/** Medium-term adaptive memory m_t: a decaying, reinforcible bias vector. */
export interface MemoryState {
  trace: number[]; // length RESERVOIR_SIZE, same basis as reservoir
  salience: number; // scalar summary of how "charged" memory currently is
}

/** Predictive world model theta_t (kept intentionally simple: online linear model). */
export interface PredictorState {
  weights: number[][]; // RESERVOIR_SIZE x RESERVOIR_SIZE, predicts r_{t+1} from r_t
  lastPrediction: number[] | null;
  error: number; // scalar prediction error at this tick
  errorEma: number; // slow-moving average of error, for the arbiter/governor
}

/** One compressed episodic trace e_t. */
export interface EpisodicTrace {
  t: number;
  vector: number[]; // compressed reservoir snapshot
  tag: Stimulus["origin"];
  value: number; // how useful/salient this episode was judged to be
}

export type ArbiterMode = "react" | "predict" | "escalate";

export interface SymbolicResult {
  invoked: boolean;
  plan: string[] | null;
  stepsExplored: number;
  budgetExceeded: boolean;
}

export interface GovernorFlags {
  pathologicalHabituation: boolean;
  pathologicalPerseveration: boolean;
  clamped: boolean;
}

/** Full snapshot streamed to the UI each tick. */
export interface CellSnapshot {
  t: number;
  stimulus: Stimulus;
  fast: { norm: number };
  habituation: { gate: number[]; avgGate: number };
  memory: { salience: number };
  predictor: { error: number; errorEma: number };
  episodic: { retrieved: EpisodicTrace | null; storeSize: number };
  arbiter: { mode: ArbiterMode; reason: string };
  symbolic: SymbolicResult;
  governor: GovernorFlags;
  action: number[]; // final motor/tool output vector, length N_CHANNELS
}
