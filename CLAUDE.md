# CLAUDE.md

Canonical agent guidance; `AGENTS.md` points here.

## Commands

```sh
bun run dev        # bun run --hot server.ts
bun run start      # bun run server.ts
bun run typecheck  # tsc --noEmit
bun run test       # bun test src
bun run lint       # bunx oxlint@1.76.0 . (fetched by bunx, not a dependency)
bun run check      # lint, typecheck, then test -- the gate
# Headless smoke, without a server or browser:
bun -e 'import { Cell } from "./src/core/cell"; const c = new Cell(); let s; for (let i = 0; i < 200; i++) s = c.tick(); console.log(s.t, s.arbiter.mode, s.predictor.errorEma)'
```

- Use Bun and `bun.lock`; there is no runtime version pin in `package.json`.
- `check` is the gate: `lint` then `typecheck` then `test`. `lint` runs oxlint
  through `bunx` pinned to 1.76.0 (the version donald-filimon-sites uses), so it
  is not in `package.json` or `bun.lock` and needs the npm registry or bunx's
  cache. oxlint currently reports only `unicorn(no-new-array)` warnings, which do
  not fail it. There is no build script or CI workflow.
- The suite covers the numeric helpers (`math.test.ts`), `Cell.tick()` stage
  order via recording spies plus the arbiter's episodic short-circuit and the
  governor's perseveration clamp (`cell.test.ts`), and an HTTP/WebSocket smoke
  (`src/server.test.ts`). Reservoir, habituation, predictor and memory numerics
  are exercised only through the order test, not asserted.
- `tsconfig.json` checks TypeScript with strict indexed access; it does not
  check the plain-JS browser console in `public/app.js`.
- `Bun.serve` imports `public/index.html` directly; no Vite or `dist/` step.
  `PORT` defaults to 3000. `/ws` sends `hello` on connection and `tick` messages
  with `snapshot` afterward; `src/server.test.ts` asserts that on an ephemeral port
  through the exported `startServer(port)` (auto-start is guarded by
  `import.meta.main`).

## Architecture and coupling

- This is a server-side reactive-control reference implementation with synthetic
  stimuli, a reservoir, online predictor, episodic recall, and a bounded toy BFS.
  It is not the React/WebGPU app `cell-state-adaptive-bun-validated` (archived
  since 2026-09-18). The two once shared a package name; this one is now
  `cell-machine`. `bun.lock` still records the old root name until the lockfile
  is next regenerated; Bun 1.4.3 installs cleanly (`--frozen-lockfile` too) with
  the mismatch.
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
- Each `startServer()` call owns one shared `Cell`, timer, and running flag for all its sockets.
  `inject`, `pause`, `resume`, and `set-speed` affect everyone, not a client session.
  Tick speed is clamped to 15-1000 ms; the simulation runs without clients.
- `public/app.js` renders snapshots into canvas views and rolling histories;
  it does not run the simulation. Core changes can be exercised headlessly.

## Git workflow

Use this canonical checkout's default branch; branches/worktrees are opt-in
under the machine policy in `~/.claude/CLAUDE.md`, not the default workflow.
