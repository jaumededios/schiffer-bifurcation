const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (selector) => document.querySelector(selector);

const state = {
  lambda: 2.4,
  s: 0,
  phase: 0,
  maxMode: 4,
  solution: null,
  updateFrame: null,
  playing: false,
  playFrame: null,
  lastPlaySolve: 0,
};

const X_MIN = -5;
const X_MAX = 1.05;
const TWO_PI = Math.PI * 2;

function boundary(theta, parameters = state) {
  return parameters.s * Math.cos(theta - parameters.phase);
}

function inwardDistance(x, theta, parameters = state) {
  return boundary(theta, parameters) - x;
}

function radialBasis(d, k, lambda) {
  if (k === 1) {
    const frequency = Math.sqrt(Math.max(0, lambda - 1));
    return d * d * Math.cos(frequency * d);
  }
  const decay = Math.sqrt(Math.max(1e-8, k * k - lambda));
  return d * d * Math.exp(-decay * d);
}

function baseField(x, theta, parameters) {
  const d = inwardDistance(x, theta, parameters);
  return Math.cos(Math.sqrt(parameters.lambda) * d);
}

function basisField(x, theta, parameters, mode) {
  const d = inwardDistance(x, theta, parameters);
  const angle = mode.k * theta;
  const angular = mode.trig === "cos" ? Math.cos(angle) : Math.sin(angle);
  return radialBasis(d, mode.k, parameters.lambda) * angular;
}

function operatorValue(field, x, theta, lambda, epsilon = 0.0035) {
  const center = field(x, theta);
  const xx = (field(x + epsilon, theta) - 2 * center + field(x - epsilon, theta)) / (epsilon * epsilon);
  const tt = (field(x, theta + epsilon) - 2 * center + field(x, theta - epsilon)) / (epsilon * epsilon);
  return xx + tt + lambda * center;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const scale = augmented[column][column];
    if (Math.abs(scale) < 1e-13) continue;
    for (let j = column; j <= n; j++) augmented[column][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = column; j <= n; j++) augmented[row][j] -= factor * augmented[column][j];
    }
  }
  return augmented.map((row, i) => Number.isFinite(row[n]) ? row[n] : (i * 0));
}

function modalList(maxMode) {
  const modes = [];
  for (let k = 1; k <= maxMode; k++) {
    modes.push({ k, trig: "cos" }, { k, trig: "sin" });
  }
  return modes;
}

function solveModalField(parameters) {
  const modes = modalList(parameters.maxMode);
  const n = modes.length;
  const normal = Array.from({ length: n }, () => Array(n).fill(0));
  const rhs = Array(n).fill(0);
  const rows = [];
  const base = (x, theta) => baseField(x, theta, parameters);
  const basisFunctions = modes.map((mode) => (x, theta) => basisField(x, theta, parameters, mode));

  for (let angularIndex = 0; angularIndex < 28; angularIndex++) {
    const theta = -Math.PI + (angularIndex + 0.5) * TWO_PI / 28;
    for (let radialIndex = 0; radialIndex < 13; radialIndex++) {
      const d = 0.14 + radialIndex * 4.55 / 12;
      const x = boundary(theta, parameters) - d;
      const r0 = operatorValue(base, x, theta, parameters.lambda);
      const row = basisFunctions.map((field) => operatorValue(field, x, theta, parameters.lambda));
      rows.push({ x, theta, r0, row });
      for (let i = 0; i < n; i++) {
        rhs[i] -= row[i] * r0;
        for (let j = 0; j <= i; j++) normal[i][j] += row[i] * row[j];
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) normal[j][i] = normal[i][j];
  }
  const trace = normal.reduce((sum, row, i) => sum + row[i], 0);
  const ridge = Math.max(1e-8, trace / Math.max(1, n) * 2e-6);
  for (let i = 0; i < n; i++) normal[i][i] += ridge;
  const coefficients = solveLinearSystem(normal, rhs);

  const solution = { parameters: { ...parameters }, modes, coefficients, residual: 0, boundaryError: 0 };
  let residualSquared = 0;
  let scaleSquared = 0;
  rows.forEach(({ x, theta, r0, row }) => {
    const residual = r0 + row.reduce((sum, value, i) => sum + value * coefficients[i], 0);
    const value = fieldValue(x, theta, solution);
    residualSquared += residual * residual;
    scaleSquared += (parameters.lambda * value) ** 2 + 1e-8;
  });
  solution.residual = Math.sqrt(residualSquared / scaleSquared);

  let boundaryError = 0;
  for (let i = 0; i < 48; i++) {
    const theta = -Math.PI + i * TWO_PI / 48;
    const x = boundary(theta, parameters);
    const valueError = Math.abs(fieldValue(x, theta, solution) - 1);
    const epsilon = 1e-5;
    const derivativeError = Math.abs((fieldValue(x + epsilon, theta, solution) - fieldValue(x - epsilon, theta, solution)) / (2 * epsilon));
    boundaryError = Math.max(boundaryError, valueError, derivativeError);
  }
  solution.boundaryError = boundaryError;
  return solution;
}

function fieldValue(x, theta, solution = state.solution) {
  if (!solution) return 0;
  let value = baseField(x, theta, solution.parameters);
  for (let i = 0; i < solution.modes.length; i++) {
    value += solution.coefficients[i] * basisField(x, theta, solution.parameters, solution.modes[i]);
  }
  return value;
}

const COLOR_STOPS = [
  { t: 0, rgb: [18, 39, 66] },
  { t: .25, rgb: [42, 116, 125] },
  { t: .5, rgb: [234, 227, 205] },
  { t: .75, rgb: [239, 112, 71] },
  { t: 1, rgb: [166, 43, 73] },
];

function colorFor(value) {
  const t = Math.max(0, Math.min(1, (value + 1.15) / 2.3));
  let left = COLOR_STOPS[0];
  let right = COLOR_STOPS.at(-1);
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (t <= COLOR_STOPS[i].t) { left = COLOR_STOPS[i - 1]; right = COLOR_STOPS[i]; break; }
  }
  const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
  return left.rgb.map((channel, i) => Math.round(channel + (right.rgb[i] - channel) * local));
}

function canvasCoordinates(x, theta, width, height) {
  return [
    (x - X_MIN) / (X_MAX - X_MIN) * width,
    (Math.PI - theta) / TWO_PI * height,
  ];
}

function drawContours(context, width, height, solution) {
  const columns = 100;
  const rows = 76;
  const grid = [];
  for (let row = 0; row <= rows; row++) {
    const theta = Math.PI - row / rows * TWO_PI;
    const values = [];
    for (let column = 0; column <= columns; column++) {
      const x = X_MIN + column / columns * (X_MAX - X_MIN);
      values.push(x <= boundary(theta, solution.parameters) ? fieldValue(x, theta, solution) : null);
    }
    grid.push(values);
  }

  const interpolate = (a, b, va, vb, level) => {
    const t = Math.abs(vb - va) < 1e-9 ? .5 : (level - va) / (vb - va);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  context.save();
  context.strokeStyle = "rgba(244, 240, 228, .17)";
  context.lineWidth = 0.8;
  [-.8, -.55, -.3, -.05, .2, .45, .7, .95].forEach((level) => {
    context.beginPath();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const values = [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]];
        if (values.some((value) => value === null)) continue;
        const points = [
          [column / columns * width, row / rows * height],
          [(column + 1) / columns * width, row / rows * height],
          [(column + 1) / columns * width, (row + 1) / rows * height],
          [column / columns * width, (row + 1) / rows * height],
        ];
        const crossings = [];
        for (let edge = 0; edge < 4; edge++) {
          const next = (edge + 1) % 4;
          if ((values[edge] - level) * (values[next] - level) < 0) {
            crossings.push(interpolate(points[edge], points[next], values[edge], values[next], level));
          }
        }
        if (crossings.length >= 2) {
          context.moveTo(crossings[0][0], crossings[0][1]);
          context.lineTo(crossings[1][0], crossings[1][1]);
          if (crossings.length === 4) {
            context.moveTo(crossings[2][0], crossings[2][1]);
            context.lineTo(crossings[3][0], crossings[3][1]);
          }
        }
      }
    }
    context.stroke();
  });
  context.restore();
}

function renderHeatmap() {
  const canvas = $("#fieldCanvas");
  const wrap = $("#canvasWrap");
  const displayWidth = Math.max(420, wrap.clientWidth || 900);
  const displayHeight = Math.max(420, wrap.clientHeight || 580);
  const width = Math.min(820, Math.round(displayWidth * .88));
  const height = Math.min(570, Math.round(displayHeight * .88));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const theta = Math.PI - (y + .5) / height * TWO_PI;
    const wall = boundary(theta, state.solution.parameters);
    for (let xPixel = 0; xPixel < width; xPixel++) {
      const x = X_MIN + (xPixel + .5) / width * (X_MAX - X_MIN);
      const index = (y * width + xPixel) * 4;
      if (x > wall) {
        const stripe = ((xPixel + y) % 18) < 1 ? 2 : 0;
        image.data[index] = 12 + stripe;
        image.data[index + 1] = 22 + stripe;
        image.data[index + 2] = 27 + stripe;
        image.data[index + 3] = 255;
        continue;
      }
      const value = fieldValue(x, theta);
      const color = colorFor(value);
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  drawContours(context, width, height, state.solution);

  context.save();
  context.strokeStyle = "rgba(241,238,229,.15)";
  context.lineWidth = 1;
  context.setLineDash([4, 6]);
  const [zeroX] = canvasCoordinates(0, 0, width, height);
  context.beginPath(); context.moveTo(zeroX, 0); context.lineTo(zeroX, height); context.stroke();
  for (let tick = -2; tick <= 2; tick++) {
    const theta = tick * Math.PI / 2;
    const [, y] = canvasCoordinates(0, theta, width, height);
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  context.save();
  context.beginPath();
  for (let i = 0; i <= 220; i++) {
    const theta = Math.PI - i / 220 * TWO_PI;
    const point = canvasCoordinates(boundary(theta, state.solution.parameters), theta, width, height);
    if (i === 0) context.moveTo(point[0], point[1]); else context.lineTo(point[0], point[1]);
  }
  context.strokeStyle = "#fff4dc";
  context.shadowColor = "rgba(255,116,73,.85)";
  context.shadowBlur = 8;
  context.lineWidth = 2.5;
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = "rgba(241,238,229,.55)";
  context.font = "9px DM Mono, monospace";
  context.textBaseline = "top";
  context.fillText("θ = +π", 10, 9);
  context.fillText("θ = 0", 10, height / 2 + 8);
  context.fillText("θ = −π", 10, height - 19);
  context.fillStyle = "rgba(241,238,229,.38)";
  context.fillText("s = 0 wall", zeroX + 7, 10);
  context.restore();
}

function svgElement(name, attributes = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (parent) parent.appendChild(node);
  return node;
}

function drawBoundaryDiagram() {
  const svg = $("#boundaryDiagram");
  svg.replaceChildren();
  svgElement("rect", { x: 18, y: 15, width: 214, height: 158, fill: "none", stroke: "rgba(241,238,229,.08)" }, svg);
  for (let i = 0; i <= 4; i++) {
    const y = 15 + i * 158 / 4;
    svgElement("line", { x1: 18, y1: y, x2: 232, y2: y, stroke: "rgba(241,238,229,.09)" }, svg);
  }
  const centerX = 144;
  svgElement("line", { x1: centerX, y1: 15, x2: centerX, y2: 173, stroke: "rgba(241,238,229,.32)", "stroke-dasharray": "3 5" }, svg);
  const points = [];
  for (let i = 0; i <= 120; i++) {
    const theta = Math.PI - i / 120 * TWO_PI;
    points.push([centerX + state.s * 58 * Math.cos(theta - state.phase), 15 + i / 120 * 158]);
  }
  const data = `M ${points.map((point) => point.map((value) => value.toFixed(2)).join(" ")).join(" L ")}`;
  svgElement("path", { d: data, fill: "none", stroke: "#ff7449", "stroke-width": "3" }, svg);
  const label = svgElement("text", { x: 24, y: 186, fill: "rgba(241,238,229,.42)", "font-family": "DM Mono", "font-size": "8" }, svg);
  label.textContent = state.s === 0 ? "Γ₀ · flat wall" : `Γs · amplitude ${Math.abs(state.s).toFixed(2)}`;
}

function renderModeBars() {
  const container = $("#modeBars");
  container.replaceChildren();
  const grouped = [];
  for (let k = 1; k <= state.solution.parameters.maxMode; k++) {
    const cosIndex = state.solution.modes.findIndex((mode) => mode.k === k && mode.trig === "cos");
    const sinIndex = state.solution.modes.findIndex((mode) => mode.k === k && mode.trig === "sin");
    const magnitude = Math.hypot(state.solution.coefficients[cosIndex] || 0, state.solution.coefficients[sinIndex] || 0);
    grouped.push({ k, magnitude });
  }
  const maximum = Math.max(1e-6, ...grouped.map((item) => item.magnitude));
  grouped.forEach(({ k, magnitude }) => {
    const row = document.createElement("div");
    row.className = "mode-bar";
    const label = document.createElement("span");
    label.textContent = k === 1 ? "k 1 · crit" : `k ${k}`;
    const track = document.createElement("div");
    track.className = "mode-bar-track";
    const fill = document.createElement("div");
    fill.className = "mode-bar-fill";
    fill.style.width = `${Math.max(1, magnitude / maximum * 100)}%`;
    track.appendChild(fill);
    const output = document.createElement("output");
    output.textContent = magnitude < 1e-4 ? "0" : magnitude.toExponential(1);
    row.append(label, track, output);
    container.appendChild(row);
  });
}

function setRangeFill(input) {
  const value = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
  input.style.setProperty("--value", `${value}%`);
}

function updateReadouts() {
  $("#lambdaValue").textContent = state.lambda.toFixed(2);
  $("#sValue").textContent = `${state.s >= 0 ? "+" : ""}${state.s.toFixed(3)}`;
  $("#phaseValue").textContent = `${(state.phase / Math.PI).toFixed(2)}π`;
  $("#modeValue").textContent = `k ≤ ${state.maxMode}`;
  $("#residualValue").textContent = state.solution.residual.toExponential(2);
  $("#boundaryValue").textContent = state.solution.boundaryError < 1e-7 ? "< 10⁻⁷" : state.solution.boundaryError.toExponential(1);
  $("#decayValue").textContent = (1 / Math.sqrt(4 - state.lambda)).toFixed(2);
  $("#domainState").textContent = Math.abs(state.s) < .0025 ? "trivial cylinder · s = 0" : `moving boundary · s = ${state.s.toFixed(3)}`;
}

function solveAndRender() {
  const parameters = { lambda: state.lambda, s: state.s, phase: state.phase, maxMode: state.maxMode };
  state.solution = solveModalField(parameters);
  updateReadouts();
  renderHeatmap();
  renderModeBars();
  drawBoundaryDiagram();
  $("#solverBadge").classList.remove("visible");
}

function scheduleUpdate() {
  $("#solverBadge").classList.add("visible");
  if (state.updateFrame) cancelAnimationFrame(state.updateFrame);
  state.updateFrame = requestAnimationFrame(() => {
    state.updateFrame = null;
    solveAndRender();
  });
}

function stopPlayback() {
  state.playing = false;
  if (state.playFrame) cancelAnimationFrame(state.playFrame);
  state.playFrame = null;
  $("#playIcon").textContent = "▶";
  $("#playLabel").textContent = "Play bifurcation";
}

function togglePlayback() {
  if (state.playing) { stopPlayback(); return; }
  state.playing = true;
  state.lastPlaySolve = 0;
  $("#playIcon").textContent = "Ⅱ";
  $("#playLabel").textContent = "Pause";
  const start = performance.now() - Math.asin(Math.max(-1, Math.min(1, state.s / .75))) * 1450;
  const tick = (now) => {
    if (!state.playing) return;
    if (now - state.lastPlaySolve > 75) {
      state.s = .75 * Math.sin((now - start) / 1450);
      $("#sRange").value = state.s;
      setRangeFill($("#sRange"));
      solveAndRender();
      state.lastPlaySolve = now;
    }
    state.playFrame = requestAnimationFrame(tick);
  };
  state.playFrame = requestAnimationFrame(tick);
}

function bindRange(selector, key, transform = Number) {
  const input = $(selector);
  setRangeFill(input);
  input.addEventListener("input", () => {
    if (key === "s") stopPlayback();
    state[key] = transform(input.value);
    setRangeFill(input);
    scheduleUpdate();
  });
}

bindRange("#lambdaRange", "lambda");
bindRange("#sRange", "s");
bindRange("#phaseRange", "phase");
bindRange("#modeRange", "maxMode", (value) => Number.parseInt(value, 10));

$("#playButton").addEventListener("click", togglePlayback);
$("#resetButton").addEventListener("click", () => {
  stopPlayback();
  Object.assign(state, { lambda: 2.4, s: 0, phase: 0, maxMode: 4 });
  const values = { lambdaRange: state.lambda, sRange: state.s, phaseRange: state.phase, modeRange: state.maxMode };
  Object.entries(values).forEach(([id, value]) => { const input = $(`#${id}`); input.value = value; setRangeFill(input); });
  scheduleUpdate();
});

$("#methodButton").addEventListener("click", () => $("#methodDialog").showModal());
$("#closeMethod").addEventListener("click", () => $("#methodDialog").close());
$("#methodDialog").addEventListener("click", (event) => { if (event.target === $("#methodDialog")) $("#methodDialog").close(); });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.solution) renderHeatmap(); }, 120);
});

solveAndRender();
