# CLAUDE.md

Canonical agent guidance; `AGENTS.md` points here.

## Commands

```sh
bun run dev        # bun run --hot server.ts
bun run start      # bun run server.ts
bun run typecheck  # tsc --noEmit
# Headless smoke, without a server or browser:
bun -e 'import { Cell } from "./src/core/cell"; const c = new Cell(); let s; for (let i = 0; i < 200; i++) s = c.tick(); console.log(s.t, s.arbiter.mode, s.predictor.errorEma)'
```

- Use Bun and `bun.lock`; there is no runtime version pin in `package.json`.
- `typecheck` is the only configured automated check. There is no test suite,
  lint script, build script, or CI workflow. A headless smoke is not a test suite.
- `tsconfig.json` checks TypeScript with strict indexed access; it does not
  check the plain-JS browser console in `public/app.js`.
- `Bun.serve` imports `public/index.html` directly; no Vite or `dist/` step.
  `PORT` defaults to 3000. Server changes also need an HTTP/WebSocket smoke:
  `/ws` sends `hello` on connection and `tick` messages with `snapshot` afterward.

## Architecture and coupling

- This is a server-side reactive-control reference implementation with synthetic
  stimuli, a reservoir, online predictor, episodic recall, and a bounded toy BFS.
  It is not the React/WebGPU app in sibling `cell-state-adaptive-bun-validated`,
  despite their identical package names.
- `src/core/cell.ts::Cell.tick()` is authoritative for execution order:
  stimulus -> habituation -> reservoir -> predictor -> adaptive memory ->
  episodic commit/retrieve -> arbiter -> action/planner -> governor -> snapshot.
- Habituation gates the stimulus before the reservoir and gates the initial
  action readout again. Predict mode then blends in the predicted readout.
- `arbiter.ts` checks episodic recall first, short-circuiting to `predict`.
  Escalation uses `errorEma`, not instantaneous predictor error.
- `symbolic.ts` runs only for escalation; an exhausted plan causes conservative
  action dampening in `Cell.tick()`, not an unbounded retry.
- `governor.ts` audits prolonged low-gate input and exhausted escalations;
  flagged actions are norm-clamped. It does not choose the arbiter mode.
- `src/core/types.ts` defines state/snapshot contracts. Extend the producing
  stage in `Cell.tick()` and consuming views in `public/app.js` together.
- `server.ts` owns one shared `Cell`, timer, and running flag for all sockets.
  `inject`, `pause`, `resume`, and `set-speed` affect everyone, not a client session.
  Tick speed is clamped to 15-1000 ms; the simulation runs without clients.
- `public/app.js` renders snapshots into canvas views and rolling histories;
  it does not run the simulation. Core changes can be exercised headlessly.

## Git workflow

Use this canonical checkout's default branch; branches/worktrees are opt-in
under the machine policy in `~/.claude/CLAUDE.md`, not the default workflow.
