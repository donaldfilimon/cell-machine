import { afterEach, expect, test } from "bun:test";
import { startServer } from "../server";

let stopServer: (() => void) | null = null;

afterEach(() => {
  stopServer?.();
  stopServer = null;
});

interface Message {
  type: string;
  snapshot?: { t: number; action: number[] };
  tickMs?: number;
  running?: boolean;
}

test("HTTP and /ws smoke: page served, then hello, then a tick with a snapshot", async () => {
  const { server, stop } = startServer(0);
  stopServer = stop;

  const page = await fetch(new URL("/", server.url));
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type") ?? "").toContain("text/html");

  const ws = new WebSocket(`ws://${server.hostname}:${server.port}/ws`);
  const messages: Message[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`no tick after hello; got ${JSON.stringify(messages)}`)), 5000);
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("websocket error"));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as Message;
        messages.push(msg);
        if (msg.type === "tick") {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  } finally {
    ws.close();
  }

  expect(messages[0]).toEqual({ type: "hello", tickMs: 90, running: true });
  const tick = messages.find((m) => m.type === "tick");
  expect(tick?.snapshot).toBeDefined();
  expect(typeof tick?.snapshot?.t).toBe("number");
  expect(Array.isArray(tick?.snapshot?.action)).toBe(true);
});
