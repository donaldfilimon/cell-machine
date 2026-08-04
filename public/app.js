const HISTORY = 240;

const COLORS = {
  react: { hex: "#4fd1ae", rgb: "79,209,174" },
  predict: { hex: "#d9b54a", rgb: "217,181,74" },
  escalate: { hex: "#e8654a", rgb: "232,101,74" },
};

const buffers = {
  norm: [],
  gate: [],
  errorRaw: [],
  errorEma: [],
  memory: [],
};

function pushBuffer(name, value) {
  const buf = buffers[name];
  buf.push(value);
  if (buf.length > HISTORY) buf.shift();
}

// ---------- Canvas: membrane (signature element) ----------

const membraneCanvas = document.getElementById("membrane");
const membraneCtx = membraneCanvas.getContext("2d");

function drawMembrane(snapshot) {
  const w = membraneCanvas.width;
  const h = membraneCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const color = COLORS[snapshot.arbiter.mode] ?? COLORS.react;

  membraneCtx.clearRect(0, 0, w, h);

  const r = 76 + Math.min(70, snapshot.fast.norm * 45);
  membraneCtx.beginPath();
  membraneCtx.arc(cx, cy, r, 0, Math.PI * 2);
  membraneCtx.fillStyle = `rgba(${color.rgb}, 0.10)`;
  membraneCtx.fill();
  membraneCtx.lineWidth = 2;
  membraneCtx.strokeStyle = color.hex;
  membraneCtx.stroke();

  const gateR = 22 + snapshot.habituation.avgGate * 34;
  membraneCtx.beginPath();
  membraneCtx.arc(cx, cy, gateR, 0, Math.PI * 2);
  membraneCtx.fillStyle = `rgba(${color.rgb}, 0.4)`;
  membraneCtx.fill();

  if (snapshot.episodic.retrieved) {
    membraneCtx.beginPath();
    membraneCtx.arc(cx, cy, r + 16, 0, Math.PI * 2);
    membraneCtx.strokeStyle = "rgba(217,181,74,0.9)";
    membraneCtx.lineWidth = 1.5;
    membraneCtx.setLineDash([2, 4]);
    membraneCtx.stroke();
    membraneCtx.setLineDash([]);
  }

  if (snapshot.governor.clamped) {
    membraneCtx.beginPath();
    membraneCtx.arc(cx, cy, r + 26, 0, Math.PI * 2);
    membraneCtx.strokeStyle = "#e8654a";
    membraneCtx.lineWidth = 3;
    membraneCtx.setLineDash([6, 6]);
    membraneCtx.stroke();
    membraneCtx.setLineDash([]);
  }
}

// ---------- Canvas: trace strips ----------

function drawTrace(canvas, seriesList, range) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(168,172,159,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  for (const s of seriesList) {
    const data = s.data;
    if (data.length < 2) continue;
    const max = range?.max ?? Math.max(0.05, ...data);
    const min = range?.min ?? 0;
    const denom = Math.max(1, data.length - 1);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / denom) * w;
      const norm = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      const y = h - norm * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

const traceNorm = document.getElementById("trace-norm");
const traceGate = document.getElementById("trace-gate");
const traceError = document.getElementById("trace-error");
const traceMemory = document.getElementById("trace-memory");

function redrawTraces() {
  drawTrace(traceNorm, [{ data: buffers.norm, color: "#4fd1ae" }]);
  drawTrace(traceGate, [{ data: buffers.gate, color: "#d9b54a" }], { min: 0, max: 1 });
  drawTrace(
    traceError,
    [
      { data: buffers.errorRaw, color: "rgba(232,101,74,0.55)" },
      { data: buffers.errorEma, color: "#e8654a" },
    ],
    null,
  );
  drawTrace(traceMemory, [{ data: buffers.memory, color: "#d9b54a" }], { min: 0, max: 1 });
}

// ---------- Architecture diagram ----------

const archNodes = document.querySelectorAll("#arch-nodes rect");

function updateArchitecture(snapshot) {
  archNodes.forEach((n) => n.setAttribute("class", ""));
  const set = (id, cls) => {
    const node = document.querySelector(`#arch-nodes rect[data-node="${id}"]`);
    if (node) node.setAttribute("class", cls);
  };
  set("sense", "active");
  set("fast", "active");
  set("arbiter", "active");
  if (snapshot.arbiter.mode === "react") set("react", "active");
  if (snapshot.arbiter.mode === "predict") set("predict", "active");
  if (snapshot.arbiter.mode === "escalate") {
    set("predict", "active");
    set("escalate", "active-escalate");
  }
  if (snapshot.memory.salience > 0.15) set("memory", "active-memory");
  if (snapshot.episodic.retrieved) set("episodic", "active-memory");
  if (snapshot.governor.clamped) set("governor", "active-escalate");
}

// ---------- Vitals + mode readout ----------

const modeLabel = document.getElementById("mode-label");
const modeReason = document.getElementById("mode-reason");
const vitalT = document.getElementById("vital-t");
const vitalNorm = document.getElementById("vital-norm");
const vitalGate = document.getElementById("vital-gate");
const vitalMemory = document.getElementById("vital-memory");
const vitalEpisodic = document.getElementById("vital-episodic");

function updateVitals(snapshot) {
  const color = COLORS[snapshot.arbiter.mode] ?? COLORS.react;
  modeLabel.textContent = snapshot.arbiter.mode;
  modeLabel.style.color = color.hex;
  modeReason.textContent = snapshot.arbiter.reason;
  vitalT.textContent = snapshot.t;
  vitalNorm.textContent = snapshot.fast.norm.toFixed(2);
  vitalGate.textContent = snapshot.habituation.avgGate.toFixed(2);
  vitalMemory.textContent = snapshot.memory.salience.toFixed(2);
  vitalEpisodic.textContent = snapshot.episodic.storeSize;
}

// ---------- Event log ----------

const logList = document.getElementById("log-list");
let lastMode = null;
let lastEpisodicSize = 0;
let logCount = 0;

function log(text, cls) {
  const entry = document.createElement("div");
  entry.className = `log-entry${cls ? " " + cls : ""}`;
  const t = document.createElement("span");
  t.className = "log-t";
  t.textContent = String(logCount);
  const msg = document.createElement("span");
  msg.textContent = text;
  entry.appendChild(t);
  entry.appendChild(msg);
  logList.appendChild(entry);
  while (logList.children.length > 80) logList.removeChild(logList.firstChild);
}

function maybeLog(snapshot) {
  logCount = snapshot.t;

  if (snapshot.stimulus.origin === "novel") log("Novel burst detected on an unhabituated channel", "log-inject");
  if (snapshot.stimulus.origin === "context-shift") log("Context shift — ambient baseline invalidated", "log-inject");
  if (snapshot.stimulus.origin === "rare-event") log("Rare high-value event observed", "log-inject");

  if (snapshot.arbiter.mode !== lastMode) {
    const cls = snapshot.arbiter.mode === "escalate" ? "log-escalate" : "";
    log(`Arbiter switched to ${snapshot.arbiter.mode}: ${snapshot.arbiter.reason}`, cls);
    lastMode = snapshot.arbiter.mode;
  }

  if (snapshot.symbolic.invoked) {
    if (snapshot.symbolic.budgetExceeded) {
      log(`Symbolic planner exhausted its budget (${snapshot.symbolic.stepsExplored} nodes) — holding conservatively`, "log-escalate");
    } else if (snapshot.symbolic.plan && snapshot.symbolic.plan.length > 0) {
      log(`Symbolic planner found a ${snapshot.symbolic.plan.length}-step correction: ${snapshot.symbolic.plan.join(" → ")}`);
    }
  }

  if (snapshot.episodic.storeSize !== lastEpisodicSize) {
    log(`Episodic store committed a new trace (now ${snapshot.episodic.storeSize})`);
    lastEpisodicSize = snapshot.episodic.storeSize;
  }

  if (snapshot.governor.pathologicalHabituation) {
    log("Governor: pathological habituation — gate has stayed closed under sustained salient input", "log-governor");
  }
  if (snapshot.governor.pathologicalPerseveration) {
    log("Governor: pathological perseveration — repeated escalation without resolution", "log-governor");
  }
}

// ---------- WebSocket ----------

const connIndicator = document.getElementById("conn-indicator");
const connLabel = document.getElementById("conn-label");

function setConnState(state) {
  connIndicator.dataset.state = state;
  connLabel.textContent = state === "open" ? "streaming" : state === "closed" ? "disconnected" : "connecting…";
}

let socket = null;

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws`);

  socket.addEventListener("open", () => setConnState("open"));
  socket.addEventListener("close", () => {
    setConnState("closed");
    setTimeout(connect, 1200);
  });
  socket.addEventListener("error", () => socket.close());

  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "tick") {
      const snapshot = msg.snapshot;
      pushBuffer("norm", snapshot.fast.norm);
      pushBuffer("gate", snapshot.habituation.avgGate);
      pushBuffer("errorRaw", snapshot.predictor.error);
      pushBuffer("errorEma", snapshot.predictor.errorEma);
      pushBuffer("memory", snapshot.memory.salience);

      drawMembrane(snapshot);
      redrawTraces();
      updateArchitecture(snapshot);
      updateVitals(snapshot);
      maybeLog(snapshot);
    }
  });
}

connect();

// ---------- Controls ----------

const btnToggle = document.getElementById("btn-toggle");
let running = true;

btnToggle.addEventListener("click", () => {
  running = !running;
  btnToggle.textContent = running ? "Pause" : "Resume";
  socket?.send(JSON.stringify({ type: running ? "resume" : "pause" }));
});

const speed = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");

speed.addEventListener("input", () => {
  speedValue.textContent = `${speed.value} ms`;
  socket?.send(JSON.stringify({ type: "set-speed", value: Number(speed.value) }));
});

document.querySelectorAll(".btn-inject").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.dataset.inject;
    socket?.send(JSON.stringify({ type: "inject", value: kind }));
    log(`Injected: ${kind.replace("-", " ")}`, "log-inject");
  });
});
