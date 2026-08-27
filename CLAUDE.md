# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Bun/TypeScript implementation of a "Cell-State Adaptive Problem Solver" — a
layered, non-ML reactive control architecture, plus a live browser console
that streams its internal state over a WebSocket. Every module is a small,
real, runnable implementation of a specific mechanism (leaky-integrator
echo-state reservoir, delta-rule online predictor, habituation motif,
cosine-similarity episodic recall, bounded BFS symbolic search) — there are
no ML frameworks and no mocked data anywhere in the tick loop.

## Commands

```
bun install
bun run dev        # hot-reload dev server (bun run --hot server.ts)
bun run start      # plain server.ts run
bun run typecheck  # tsc --noEmit
```

There is no test suite and no lint script configured — `typecheck` is the
only automated check. Run it after touching anything under `src/core/`.

The server listens on `$PORT` (default 3000); open `http://localhost:3000`.
There's no build step: `Bun.serve` serves `public/index.html` directly via
the `routes` map in `server.ts`, and Bun transpiles the imported `.ts`/`.js`
on the fly.

## Architecture

**One tick = one pass through a fixed pipeline**, orchestrated by
`src/core/cell.ts::Cell.tick()`. The pipeline order matters and mirrors the
design doc's data flow — each stage consumes the previous stage's output:

```
stimulus (u_t)
  -> habituation gate (per-channel novelty filter, modulates input)
  -> reservoir step (r_t: leaky-integrator echo-state net, biased by memory)
  -> predictor step (theta_t: online linear model, predicts next r_t)
  -> adaptive memory update (m_t: decaying/reinforcible trace)
  -> episodic commit + retrieve (e_t: cosine-similarity store, high-value only)
  -> arbiter decision (react | predict | escalate)
  -> action synthesis (readout matrix Wout, modulated by decision + gate)
  -> safety governor (audits, may clamp action)
  -> CellSnapshot (everything above, streamed to the browser as JSON)
```

Key coupling to know before editing any single module:
- The habituation gate multiplies the raw stimulus *before* it reaches the
  reservoir (`cell.ts`: `gateModulatedInput`), and multiplies the action
  output again at the end — it's applied twice, once on the way in and once
  on the way out.
- The arbiter (`arbiter.ts`) checks episodic recall *first*— a matching
  high-value episode short-circuits straight to `predict` mode regardless of
  gate/error state, per the design doc's "recognize before recompute" intent.
- `errorEma` (slow-moving average of predictor error) drives escalation, not
  the instantaneous `error` — this is what makes escalation about *sustained*
  novelty rather than single-tick spikes.
- The safety governor (`governor.ts`) never changes behavior directly; it
  only watches for two named failure modes (habituation gate stuck near-zero
  under real input = "pathological habituation"; repeated exhausted symbolic
  escalations = "pathological perseveration") and clamps the action vector
  by norm if either fires.
- Shared state shape lives entirely in `src/core/types.ts` (`x_t = {r_t, m_t,
  theta_t, e_t}` plus the `CellSnapshot` sent to the client). Adding a new
  field to the pipeline means updating the relevant state interface here and
  the corresponding spot in `Cell.tick()`.

`server.ts` owns the WebSocket lifecycle and the tick timer (`tickMs`,
adjustable at runtime via a `set-speed` message) but has no simulation logic
of its own — it just calls `cell.tick()` on an interval and broadcasts the
snapshot, and forwards `inject`/`pause`/`resume` client messages into
`Cell.inject()` / the `running` flag.

`public/app.js` is a plain-JS, framework-free console: it keeps small
rolling buffers (`HISTORY = 240` ticks) per metric and redraws several
`<canvas>` views (a "membrane" signature view, trace plots, a layer-map
diagram) from each incoming snapshot. There's no client-side simulation
state — it is a pure renderer of what the server streams.

## Extending the simulation

Per the README, swapping in a different planner, reservoir size, or real
sensor input is meant to be a single-module replacement — the tick loop in
`cell.ts` and the typed contract in `types.ts` are the stable interface
everything else is built against. When adding a new layer, wire it into the
`Cell.tick()` sequence at the point that matches its place in the pipeline
above, extend `CellSnapshot`, and update `public/app.js` if it should be
visualized.

<!-- machine-git-policy -->
## Git workflow (machine policy, 2026-08-27)

Work on the default branch in this canonical checkout. Do not create
branches or worktrees by default; they are for tasks that genuinely need
isolation, or when Donald asks. Any worktree or topic branch created here
must be merged back into this checkout's default branch, the worktree
removed, and the branch deleted, before pushing and before the task is
called done. Full policy: `~/.claude/CLAUDE.md` (*Git discipline*).
<!-- /machine-git-policy -->
