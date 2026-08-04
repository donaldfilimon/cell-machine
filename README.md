# Cell-State Adaptive Problem Solver — Bun implementation

A working implementation of the layered architecture from the design doc:
event-driven reactive layer → reservoir (fast state r_t) → habituation gate
→ predictive world model (θ_t) → medium-term adaptive memory (m_t) →
episodic recall (e_t) → arbiter → bounded symbolic planner → safety governor.

No ML frameworks, no mocked data: every module is a small, real, runnable
implementation of the mechanism the design doc describes (leaky-integrator
echo-state reservoir, delta-rule online predictor, negative-feedback +
incoherent-feedforward habituation motif, cosine-similarity episodic
retrieval, bounded BFS symbolic search).

## Run it

```
bun install
bun run dev      # hot reload
# or
bun run start
```

Open http://localhost:3000. The simulation runs server-side and streams a
snapshot of the full internal state over a WebSocket every tick; the
dashboard is a live console, not a static mockup.

## What to try

- **Repeat pulse** — watch the habituation gate close on the repeating
  channel while everything else stays sensitive.
- **Novel burst** — a sharp transient on a normally-quiet channel; the gate
  snaps back open and the arbiter usually moves to `predict`.
- **Context shift** — invalidates the tracked baseline everywhere; expect
  a spike in prediction error and, if sustained, escalation to the
  symbolic planner (watch the layer-map diagram light up amber → coral).
- **Rare event** — a high-value transient that gets committed to episodic
  memory; inject it again later and watch the arbiter recognize it and
  skip straight to `predict` with a "recalling instead of recomputing"
  reason.

Pause/resume and tick-rate controls are on the console; the event log
records mode switches, symbolic outcomes, episodic commits, and governor
flags (pathological habituation / pathological perseveration).

## Layout

```
server.ts              Bun.serve: WebSocket tick stream + control messages
src/core/
  types.ts              x_t = {r_t, m_t, θ_t, e_t} shared types
  math.ts                vector/matrix helpers
  stimuli.ts             synthetic multichannel stimulus generator (u_t)
  reservoir.ts           fast state r_t — leaky-integrator echo-state net
  habituation.ts         per-channel novelty gate with timescale-separated recovery
  predictor.ts           θ_t — online delta-rule linear predictor
  memory.ts              m_t — decaying, reinforcible adaptive memory trace
  episodic.ts            e_t — sparse high-value episodic store, cosine retrieval
  arbiter.ts             react / predict / escalate mode selection
  symbolic.ts            bounded-BFS symbolic planner (escalation only)
  governor.ts            safety governor: habituation/perseveration audits, clamping
  cell.ts                orchestrator: one tick = one full layer pass
public/
  index.html, app.js, styles.css   live console (canvas traces, membrane view, layer map)
```

## Honest limitations

This is a legible reference implementation, not a claim that any of this
is conscious or that the symbolic planner is a general reasoner — it's a
budgeted BFS over a toy 1-D correction problem, standing in for "recruit a
slower, explicit tool when the fast layers can't resolve uncertainty."
Swapping in a real planner, a bigger reservoir, or actual sensor input is a
matter of replacing one module; the tick loop and typed state contract in
`cell.ts` / `types.ts` don't need to change.
