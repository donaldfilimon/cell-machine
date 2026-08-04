import type { SymbolicResult } from "./types";

const ACTIONS = ["dampen", "reroute", "stabilize"] as const;
type Action = (typeof ACTIONS)[number];

function applyAction(state: number, action: Action): number {
  switch (action) {
    case "dampen":
      return Math.round(state * 0.5);
    case "reroute":
      return state - Math.sign(state || 1);
    case "stabilize":
      return state + (state < 0 ? 1 : state > 0 ? -1 : 0);
  }
}

export const NOT_INVOKED: SymbolicResult = {
  invoked: false,
  plan: null,
  stepsExplored: 0,
  budgetExceeded: false,
};

/**
 * The slowest, most deliberate layer — only recruited when the faster
 * layers (reservoir reaction, prediction, episodic recall) can't resolve
 * the current uncertainty. Deliberately a small, explicit bounded search
 * rather than a learned policy: an explored-node budget stands in for the
 * real cost of invoking a heavyweight tool, and running out of budget is a
 * legitimate, reportable outcome rather than a silent fallback.
 */
export class SymbolicPlanner {
  solve(deviation: number, budget = 48): SymbolicResult {
    const start = Math.max(-6, Math.min(6, Math.round(deviation * 4)));
    if (start === 0) return { invoked: true, plan: [], stepsExplored: 0, budgetExceeded: false };

    const visited = new Set<number>([start]);
    const queue: { state: number; path: Action[] }[] = [{ state: start, path: [] }];
    let explored = 0;

    while (queue.length > 0) {
      if (explored >= budget) {
        return { invoked: true, plan: null, stepsExplored: explored, budgetExceeded: true };
      }
      const node = queue.shift()!;
      explored++;
      if (node.state === 0) {
        return { invoked: true, plan: node.path, stepsExplored: explored, budgetExceeded: false };
      }
      if (node.path.length >= 8) continue;
      for (const action of ACTIONS) {
        const next = applyAction(node.state, action);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ state: next, path: [...node.path, action] });
        }
      }
    }
    return { invoked: true, plan: null, stepsExplored: explored, budgetExceeded: true };
  }
}
