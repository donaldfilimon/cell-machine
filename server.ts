import { Cell } from "./src/core/cell";
import index from "./public/index.html";

const cell = new Cell();
const sockets = new Set<import("bun").ServerWebSocket<unknown>>();

let tickMs = 90;
let timer: ReturnType<typeof setInterval> | null = null;
let running = true;

function broadcast(payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of sockets) ws.send(msg);
}

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (!running) return;
    const snapshot = cell.tick();
    broadcast({ type: "tick", snapshot });
  }, tickMs);
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/*": index,
  },
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (srv.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
      ws.send(JSON.stringify({ type: "hello", tickMs, running }));
    },
    close(ws) {
      sockets.delete(ws);
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw)) as { type: string; value?: unknown };
        switch (msg.type) {
          case "inject":
            if (
              msg.value === "novel" ||
              msg.value === "context-shift" ||
              msg.value === "rare-event" ||
              msg.value === "repeat"
            ) {
              cell.inject(msg.value);
            }
            break;
          case "set-speed":
            tickMs = Math.max(15, Math.min(1000, Number(msg.value) || tickMs));
            startLoop();
            break;
          case "pause":
            running = false;
            break;
          case "resume":
            running = true;
            break;
        }
      } catch {
        // Ignore malformed client messages; this is a demo console, not a public API.
      }
    },
  },
});

startLoop();

console.log(`Cell-State Adaptive Problem Solver running at ${server.url}`);
