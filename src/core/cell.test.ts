import { afterEach, describe, expect, test } from "bun:test";
import { Cell } from "./cell";
import { StimulusGenerator } from "./stimuli";
import { HabituationGate } from "./habituation";
import { AdaptiveMemory } from "./memory";
import { Reservoir } from "./reservoir";
import { Predictor } from "./predictor";
import { EpisodicStore } from "./episodic";
import { Arbiter } from "./arbiter";
import type { ArbiterDecision } from "./arbiter";
import { SymbolicPlanner } from "./symbolic";
import { SafetyGovernor } from "./governor";
import { l2norm } from "./math";
import { N_CHANNELS } from "./types";
import type { EpisodicTrace, Stimulus, SymbolicResult } from "./types";

// Recording spies installed on the prototypes of every stage Cell.tick()
// drives. Each spy logs its label and then calls the real method (or a
// replacement), so tests assert on call order rather than numeric output.
const calls: string[] = [];
const restores: (() => void)[] = [];

function record<P, K extends keyof P>(proto: P, key: K, label: string, replacement?: P[K]): void {
  const original = proto[key];
  if (typeof original !== "function") throw new Error(`${String(key)} is not a method`);
  const impl = (replacement ?? original) as unknown as (this: unknown, ...args: unknown[]) => unknown;
  proto[key] = function (this: unknown, ...args: unknown[]) {
    calls.push(label);
    return impl.apply(this, args);
  } as unknown as P[K];
  restores.push(() => {
    proto[key] = original;
  });
}

/** mulberry32: a tiny deterministic PRNG so the stimulus is reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function installSeededStimulus(seed: number): void {
  const rand = seeded(seed);
  let t = 0;
  const next = function (): Stimulus {
    t += 1;
    return { t, channels: Array.from({ length: N_CHANNELS }, () => rand() * 2 - 1), origin: "baseline" };
  };
  record(StimulusGenerator.prototype, "next", "stimulus", next);
}

function installStageSpies(): void {
  record(HabituationGate.prototype, "step", "habituation");
  record(AdaptiveMemory.prototype, "bias", "memory.bias");
  record(Reservoir.prototype, "step", "reservoir");
  record(Predictor.prototype, "step", "predictor");
  record(AdaptiveMemory.prototype, "step", "memory");
  record(EpisodicStore.prototype, "maybeCommit", "episodic.commit");
  record(EpisodicStore.prototype, "retrieve", "episodic.retrieve");
}

afterEach(() => {
  while (restores.length > 0) restores.pop()!();
  calls.length = 0;
});

const CORE_ORDER = [
  "stimulus",
  "habituation",
  "memory.bias",
  "reservoir",
  "predictor",
  "memory",
  "episodic.commit",
  "episodic.retrieve",
  "arbiter",
];

describe("Cell.tick() ordering", () => {
  test("escalation runs every stage in order: ... arbiter -> planner -> governor -> snapshot", () => {
    installSeededStimulus(42);
    installStageSpies();
    const escalate = (): ArbiterDecision => ({ mode: "escalate", reason: "forced by test" });
    record(Arbiter.prototype, "decide", "arbiter", escalate);
    record(SymbolicPlanner.prototype, "solve", "planner");
    record(SafetyGovernor.prototype, "evaluate", "governor");

    const cell = new Cell();
    const snapshot = cell.tick();
    calls.push("snapshot");

    expect(calls).toEqual([...CORE_ORDER, "planner", "governor", "snapshot"]);
    expect(snapshot.t).toBe(1);
    expect(snapshot.arbiter.mode).toBe("escalate");
    expect(snapshot.symbolic.invoked).toBe(true);
  });

  test("non-escalating ticks skip the planner but keep the same order", () => {
    installSeededStimulus(7);
    installStageSpies();
    const predict = (): ArbiterDecision => ({ mode: "predict", reason: "forced by test" });
    record(Arbiter.prototype, "decide", "arbiter", predict);
    record(SymbolicPlanner.prototype, "solve", "planner");
    record(SafetyGovernor.prototype, "evaluate", "governor");

    const cell = new Cell();
    for (let i = 0; i < 3; i++) {
      cell.tick();
      calls.push("snapshot");
    }

    const oneTick = [...CORE_ORDER, "governor", "snapshot"];
    expect(calls).toEqual([...oneTick, ...oneTick, ...oneTick]);
  });
});

describe("Arbiter", () => {
  const trace: EpisodicTrace = { t: 3, vector: [1, 0, 0], tag: "rare-event", value: 0.9 };

  test("an episodic hit short-circuits to predict before gate and error are consulted", () => {
    const arbiter = new Arbiter();
    // Without a hit, these inputs escalate (open gate, high error) or react (closed gate).
    expect(arbiter.decide(0.9, 0.9, null).mode).toBe("escalate");
    expect(arbiter.decide(0.1, 0.9, null).mode).toBe("react");

    const escalating = arbiter.decide(0.9, 0.9, trace);
    const reacting = arbiter.decide(0.1, 0.9, trace);
    expect(escalating.mode).toBe("predict");
    expect(reacting.mode).toBe("predict");
    expect(escalating.reason).toContain(`"rare-event" episode`);
  });
});

describe("SafetyGovernor", () => {
  const exhausted: SymbolicResult = { invoked: true, plan: null, stepsExplored: 48, budgetExceeded: true };

  test("sustained exhausted escalation raises perseveration and norm-clamps the action", () => {
    const governor = new SafetyGovernor();
    const flags = Array.from({ length: 7 }, () => governor.evaluate(0.9, 0.1, "escalate", exhausted));

    // The streak must exceed six consecutive exhausted escalations.
    expect(flags.slice(0, 6).every((f) => !f.clamped)).toBe(true);
    expect(flags[6]).toEqual({ pathologicalHabituation: false, pathologicalPerseveration: true, clamped: true });

    const clamped = governor.clamp([3, 4, 0, 0]);
    expect(l2norm(clamped)).toBeCloseTo(2.5, 10);
    expect(clamped[0]! / clamped[1]!).toBeCloseTo(0.75, 10);
    expect(governor.clamp([1, 1, 0, 0])).toEqual([1, 1, 0, 0]);
  });

  test("a resolved escalation resets the streak", () => {
    const governor = new SafetyGovernor();
    for (let i = 0; i < 6; i++) governor.evaluate(0.9, 0.1, "escalate", exhausted);
    const resolved: SymbolicResult = { invoked: true, plan: ["dampen"], stepsExplored: 2, budgetExceeded: false };
    expect(governor.evaluate(0.9, 0.1, "escalate", resolved).clamped).toBe(false);
    expect(governor.evaluate(0.9, 0.1, "escalate", exhausted).clamped).toBe(false);
  });
});
