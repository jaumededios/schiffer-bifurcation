const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  mode: "schiffer",
  lambda: 2.42,
  amplitude: 0.34,
  N: 37.42,
  playing: false,
  animationFrame: null,
};

const COLORS = {
  ink: "#14201d",
  soft: "#78837f",
  paper: "#f2f1e9",
  line: "rgba(20,32,29,.14)",
  accent: "#f06432",
  accent2: "#c52f54",
  mint: "#b7d8c8",
};

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (parent) parent.appendChild(node);
  return node;
}

function path(points, close = false) {
  if (!points.length) return "";
  return `M ${points.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")}${close ? " Z" : ""}`;
}

function phaseFunction(c) {
  return Math.sqrt(c * c - 1) - Math.acos(1 / c);
}

function invertPhase(target) {
  let lo = 1.000001;
  let hi = 5;
  while (phaseFunction(hi) < target) hi *= 1.5;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (phaseFunction(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function frac(x) {
  return x - Math.floor(x);
}

function phaseData(N, mode = state.mode) {
  const c = mode === "schiffer" ? Math.sqrt(state.lambda) : 1.56 + 0.045 * Math.sin(state.lambda * 1.7);
  const n = Math.max(1, Math.round((N * c) / Math.PI - 0.25));
  const beta = Math.PI * (n + 0.25);
  const firstZero = beta - 3 / (8 * beta);

  const m = Math.max(1, Math.round((N * phaseFunction(c)) / Math.PI + 0.25));
  const target = (Math.PI * (m - 0.25)) / N;
  const ratio = invertPhase(Math.max(0.00001, target));
  let bulkZero = N * ratio;

  if (mode === "berenstein") {
    // The rectangle lens compares the same phase clocks after periodic unfolding.
    bulkZero += 0.11 * Math.sin(Math.PI * N) / Math.sqrt(N);
  }

  return {
    c,
    n,
    m,
    firstZero,
    bulkZero,
    gap: firstZero - bulkZero,
    phaseA: frac((N * c) / Math.PI - 0.25),
    phaseB: frac((N * phaseFunction(c)) / Math.PI + 0.25),
  };
}

function setRangeFill(input) {
  const value = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.style.setProperty("--value", `${value}%`);
}

function ellipsePoint(cx, cy, rx, ry, angle) {
  return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
}

function boundaryPoints(cx, cy, rx, ry, amplitude, count = 160) {
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = (i / count) * Math.PI * 2;
    const wave = 1 + amplitude * 0.20 * Math.cos(t);
    pts.push(ellipsePoint(cx, cy, rx * wave, ry * wave, t));
  }
  return pts;
}

function boundaryArc(cx, cy, rx, ry, amplitude, start, end, count = 80) {
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = start + (i / count) * (end - start);
    const wave = 1 + amplitude * 0.20 * Math.cos(t);
    pts.push(ellipsePoint(cx, cy, rx * wave, ry * wave, t));
  }
  return pts;
}

function drawSchifferGeometry(root) {
  const t = (state.lambda - 1.05) / 2.9;
  const a = state.amplitude;
  const topY = 130 + t * 42;
  const bottomY = 438;
  const topRx = 250 - t * 175;
  const bottomRx = 250;
  const topRy = topRx * 0.25;
  const bottomRy = 62;
  const centerX = 438;

  el("ellipse", { cx: centerX, cy: 330, rx: 240, ry: 84, fill: COLORS.accent, opacity: ".09", filter: "url(#softShadow)" }, root);

  const topFront = boundaryArc(centerX, topY, topRx, topRy, a * .25, 0, Math.PI, 80);
  const bottomFront = boundaryArc(centerX, bottomY, bottomRx, bottomRy, a, Math.PI, 0, 80);
  const surface = [...topFront, ...bottomFront];
  el("path", { d: path(surface, true), fill: "url(#surfaceGradient)", stroke: "rgba(242,241,233,.18)", "stroke-width": "1" }, root);

  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    const top = ellipsePoint(centerX, topY, topRx, topRy, angle);
    const bottom = ellipsePoint(centerX, bottomY, bottomRx * (1 + a * .2 * Math.cos(angle)), bottomRy * (1 + a * .2 * Math.cos(angle)), angle);
    el("path", { d: path([top, bottom]), fill: "none", stroke: "rgba(242,241,233,.12)", "stroke-width": "1" }, root);
  }

  for (let j = 1; j < 6; j++) {
    const u = j / 6;
    const cy = topY + (bottomY - topY) * u;
    const rx = topRx + (bottomRx - topRx) * u;
    const ry = topRy + (bottomRy - topRy) * u;
    const localAmp = a * u * .15;
    const pts = boundaryPoints(centerX, cy, rx, ry, localAmp, 100);
    el("path", { d: path(pts), fill: "none", stroke: "rgba(242,241,233,.10)", "stroke-width": "1" }, root);
  }

  el("path", { d: path(boundaryPoints(centerX, topY, topRx, topRy, a * .25)), fill: "rgba(20,32,29,.5)", stroke: "rgba(242,241,233,.44)", "stroke-width": "1.1" }, root);
  el("path", { d: path(boundaryPoints(centerX, bottomY, bottomRx, bottomRy, a)), fill: "rgba(20,32,29,.2)", stroke: "url(#accentGradient)", "stroke-width": "4" }, root);

  const axis = el("g", { opacity: ".55" }, root);
  el("line", { x1: centerX, y1: topY - 75, x2: centerX, y2: bottomY + 85, stroke: COLORS.paper, "stroke-dasharray": "3 7", "stroke-width": "1" }, axis);
  el("circle", { cx: centerX, cy: topY - 75, r: "3", fill: COLORS.accent }, axis);

  const label = el("g", {}, root);
  el("line", { x1: 86, y1: bottomY, x2: 178, y2: bottomY, stroke: COLORS.paper, opacity: ".35" }, label);
  const text = el("text", { x: 86, y: bottomY - 12, fill: COLORS.paper, opacity: ".55", "font-family": "DM Mono", "font-size": "10" }, label);
  text.textContent = a * a < .002 ? "s = 0 · symmetric branch" : "s ≠ 0 · first mode wakes";
}

function drawBerensteinGeometry(root) {
  const t = (state.lambda - 1.05) / 2.9;
  const a = state.amplitude;
  const left = 142;
  const right = 704;
  const top = 140;
  const bottom = 455;
  const squeeze = 46 * t;

  el("rect", { x: left, y: top, width: right - left, height: bottom - top, fill: "url(#surfaceGradient)", stroke: "rgba(242,241,233,.25)" }, root);
  for (let i = 1; i < 9; i++) {
    const x = left + ((right - left) * i) / 9;
    el("line", { x1: x, y1: top, x2: x, y2: bottom, stroke: "rgba(242,241,233,.10)" }, root);
  }
  for (let j = 1; j < 5; j++) {
    const y = top + ((bottom - top) * j) / 5;
    el("line", { x1: left, y1: y, x2: right, y2: y, stroke: "rgba(242,241,233,.10)" }, root);
  }

  const upper = [];
  const lower = [];
  for (let i = 0; i <= 180; i++) {
    const u = i / 180;
    const x = left + u * (right - left);
    const wave = a * 42 * Math.cos(u * Math.PI * 2);
    upper.push([x, top + squeeze * Math.sin(Math.PI * u) + wave * .18]);
    lower.push([x, bottom - squeeze * Math.sin(Math.PI * u) + wave]);
  }
  el("path", { d: path(upper), fill: "none", stroke: "rgba(242,241,233,.55)", "stroke-width": "2" }, root);
  el("path", { d: path(lower), fill: "none", stroke: "url(#accentGradient)", "stroke-width": "4" }, root);
  el("path", { d: `M ${left} ${top - 32} C ${left - 58} ${top + 20}, ${left - 58} ${bottom - 20}, ${left} ${bottom + 32}`, fill: "none", stroke: COLORS.accent, "stroke-width": "1.5", "stroke-dasharray": "3 6" }, root);
  el("path", { d: `M ${right} ${top - 32} C ${right + 58} ${top + 20}, ${right + 58} ${bottom - 20}, ${right} ${bottom + 32}`, fill: "none", stroke: COLORS.accent, "stroke-width": "1.5", "stroke-dasharray": "3 6" }, root);
  const text = el("text", { x: 350, y: 520, fill: COLORS.paper, opacity: ".55", "font-family": "DM Mono", "font-size": "10" }, root);
  text.textContent = "periodic edges identify → cylinder";
}

function drawGeometry() {
  const root = $("#geometryDrawing");
  root.replaceChildren();
  if (state.mode === "schiffer") drawSchifferGeometry(root);
  else drawBerensteinGeometry(root);

  $("#lambdaValue").textContent = state.lambda.toFixed(2);
  $("#amplitudeValue").textContent = state.amplitude.toFixed(2);
  const R0 = 24 + 0.55 * (state.lambda - 1);
  const gamma = 1.6 + 0.45 * Math.sqrt(Math.max(0, state.lambda - 1));
  $("#orderReadout").textContent = (R0 - .5 * gamma * state.amplitude ** 2).toFixed(2);
  $("#dropReadout").textContent = (.5 * gamma * state.amplitude ** 2).toFixed(3);
  $("#modeReadout").textContent = state.mode === "schiffer" ? "k = 1" : "periodic k = 1";
  $("#stageState").textContent = Math.abs(state.amplitude) < .03 ? "TRIVIAL BRANCH · s = 0" : "NON-TRIVIAL BRANCH · s ≠ 0";
}

function dimensions(svg) {
  const box = svg.viewBox.baseVal;
  return { w: box.width, h: box.height };
}

function drawGrid(svg, pad, xLines = 6, yLines = 4) {
  const { w, h } = dimensions(svg);
  const g = el("g", {}, svg);
  for (let i = 0; i <= xLines; i++) {
    const x = pad.l + ((w - pad.l - pad.r) * i) / xLines;
    el("line", { x1: x, y1: pad.t, x2: x, y2: h - pad.b, stroke: COLORS.line }, g);
  }
  for (let i = 0; i <= yLines; i++) {
    const y = pad.t + ((h - pad.t - pad.b) * i) / yLines;
    el("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: COLORS.line }, g);
  }
}

function sampleGaps(start = 8, end = 120, count = 1300) {
  const samples = [];
  for (let i = 0; i <= count; i++) {
    const N = start + ((end - start) * i) / count;
    samples.push({ N, ...phaseData(N) });
  }
  return samples;
}

function findRoots(samples) {
  const roots = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (Math.sign(a.gap) === Math.sign(b.gap)) continue;
    let lo = a.N;
    let hi = b.N;
    let dlo = phaseData(lo).gap;
    for (let j = 0; j < 30; j++) {
      const mid = (lo + hi) / 2;
      const dm = phaseData(mid).gap;
      if (Math.sign(dm) === Math.sign(dlo)) { lo = mid; dlo = dm; } else hi = mid;
    }
    const N = (lo + hi) / 2;
    if (!roots.length || Math.abs(N - roots.at(-1).N) > .04) roots.push({ N, ...phaseData(N) });
  }
  return roots;
}

function drawWholePlot(samples) {
  const svg = $("#wholePlot");
  svg.replaceChildren();
  const { w, h } = dimensions(svg);
  const pad = { l: 22, r: 14, t: 14, b: 12 };
  drawGrid(svg, pad, 7, 4);
  const maxGap = Math.max(1, ...samples.map((d) => Math.abs(d.gap))) * 1.05;
  const x = (N) => pad.l + ((N - 8) / 112) * (w - pad.l - pad.r);
  const y = (gap) => pad.t + ((maxGap - gap) / (2 * maxGap)) * (h - pad.t - pad.b);
  el("line", { x1: pad.l, y1: y(0), x2: w - pad.r, y2: y(0), stroke: COLORS.ink, "stroke-width": "1", opacity: ".52" }, svg);

  const segments = [];
  let current = [];
  samples.forEach((d, i) => {
    if (i && Math.abs(d.gap - samples[i - 1].gap) > maxGap * .9) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push([x(d.N), y(d.gap)]);
  });
  if (current.length > 1) segments.push(current);
  segments.forEach((segment) => el("path", { d: path(segment), fill: "none", stroke: COLORS.accent, "stroke-width": "2.2", "stroke-linejoin": "round" }, svg));

  const roots = findRoots(samples);
  roots.forEach((d) => el("circle", { cx: x(d.N), cy: y(0), r: "2.2", fill: COLORS.ink }, svg));

  const currentData = phaseData(state.N);
  const cx = x(state.N);
  const cy = y(Math.max(-maxGap, Math.min(maxGap, currentData.gap)));
  el("line", { x1: cx, y1: pad.t, x2: cx, y2: h - pad.b, stroke: COLORS.ink, "stroke-width": "1", "stroke-dasharray": "3 5", opacity: ".6" }, svg);
  el("circle", { cx, cy, r: "7", fill: COLORS.paper, stroke: COLORS.accent, "stroke-width": "3" }, svg);
  return roots;
}

function drawZoomPlot(roots) {
  const svg = $("#zoomPlot");
  svg.replaceChildren();
  const { w, h } = dimensions(svg);
  const pad = { l: 40, r: 15, t: 14, b: 12 };
  drawGrid(svg, pad, 4, 5);
  const x = (d) => pad.l + (Math.min(d, .18) / .18) * (w - pad.l - pad.r);
  const y = (N) => h - pad.b - ((N - 8) / 112) * (h - pad.t - pad.b);
  el("line", { x1: x(0), y1: pad.t, x2: x(0), y2: h - pad.b, stroke: COLORS.ink, "stroke-width": "1.5", "stroke-dasharray": "4 5" }, svg);

  const near = roots.filter((d) => frac(d.N) < .18);
  near.forEach((d, index) => {
    const distance = frac(d.N);
    el("line", { x1: x(0), y1: y(d.N), x2: x(distance), y2: y(d.N), stroke: COLORS.accent, opacity: ".22" }, svg);
    el("circle", { cx: x(distance), cy: y(d.N), r: index === near.length - 1 ? "5" : "3.3", fill: COLORS.accent, opacity: (.5 + .5 * (d.N / 120)).toFixed(2) }, svg);
  });

  const currentDistance = frac(state.N);
  if (currentDistance <= .18) {
    el("circle", { cx: x(currentDistance), cy: y(state.N), r: "9", fill: "none", stroke: COLORS.accent2, "stroke-width": "2" }, svg);
  }

  const wallLabel = el("text", { x: x(0) + 7, y: 27, fill: COLORS.ink, opacity: ".56", "font-family": "DM Mono", "font-size": "9" }, svg);
  wallLabel.textContent = "INTEGER CONE";
}

function drawOrbit(data) {
  const svg = $("#orbitSvg");
  svg.replaceChildren();
  const cx = 90, cy = 90, r = 63;
  el("circle", { cx, cy, r, fill: "none", stroke: COLORS.line, "stroke-width": "1" }, svg);
  el("circle", { cx, cy, r: 40, fill: "none", stroke: COLORS.line, "stroke-width": "1" }, svg);
  el("line", { x1: 20, y1: cy, x2: 160, y2: cy, stroke: COLORS.line }, svg);
  el("line", { x1: cx, y1: 20, x2: cx, y2: 160, stroke: COLORS.line }, svg);
  const pA = ellipsePoint(cx, cy, r, r, data.phaseA * Math.PI * 2 - Math.PI / 2);
  const pB = ellipsePoint(cx, cy, 40, 40, data.phaseB * Math.PI * 2 - Math.PI / 2);
  el("line", { x1: pA[0], y1: pA[1], x2: pB[0], y2: pB[1], stroke: COLORS.accent, opacity: ".5" }, svg);
  el("circle", { cx: pA[0], cy: pA[1], r: "6", fill: COLORS.accent }, svg);
  el("circle", { cx: pB[0], cy: pB[1], r: "5", fill: COLORS.ink }, svg);
}

function drawLimitStrip(roots) {
  const container = $("#limitStrip");
  container.replaceChildren();
  const candidates = roots.filter((d) => frac(d.N) < .35).sort((a, b) => frac(b.N) - frac(a.N)).slice(-5);
  const fallback = [12.31, 24.19, 46.11, 73.055, 111.018].map((N) => ({ N }));
  const items = candidates.length >= 5 ? candidates : fallback;
  items.forEach((item, index) => {
    const frame = document.createElement("div");
    frame.className = "limit-frame";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 180 150");
    const d = Math.min(.35, frac(item.N));
    const apexY = 24 + d * 50;
    const amp = .25 * (1 - index / 6);
    el("path", { d: `M 90 ${apexY} L ${26 + amp * 20} 126 Q 90 ${135 + amp * 10} ${154 - amp * 20} 126 Z`, fill: "rgba(183,216,200,.32)", stroke: COLORS.ink, "stroke-width": "1" }, svg);
    el("path", { d: `M ${26 + amp * 20} 126 Q 90 ${112 - amp * 17} ${154 - amp * 20} 126 Q 90 ${143 + amp * 16} ${26 + amp * 20} 126`, fill: "none", stroke: COLORS.accent, "stroke-width": "2.5" }, svg);
    el("line", { x1: 90, y1: 14, x2: 90, y2: 142, stroke: COLORS.line, "stroke-dasharray": "3 5" }, svg);
    frame.appendChild(svg);
    const p = document.createElement("p");
    p.innerHTML = `<span>N ≈ ${item.N.toFixed(2)}</span><span>δ ${d.toFixed(3)}</span>`;
    frame.appendChild(p);
    container.appendChild(frame);
  });
}

function drawCoincidences() {
  const samples = sampleGaps();
  const roots = drawWholePlot(samples);
  drawZoomPlot(roots);
  drawLimitStrip(roots);
  const data = phaseData(state.N);
  drawOrbit(data);
  $("#nValue").textContent = state.N.toFixed(3);
  $("#phaseA").textContent = data.phaseA.toFixed(3);
  $("#phaseB").textContent = data.phaseB.toFixed(3);
  $("#gapValue").textContent = Math.abs(data.gap).toFixed(4);
  const close = Math.abs(data.gap) < .035;
  $("#sampleTitle").textContent = close ? "The phases coincide." : "Almost, but not yet.";
  $("#sampleCopy").textContent = close
    ? `At N ≈ ${state.N.toFixed(3)}, the two asymptotic clocks meet. This is the spectral crossing from which the branch emerges.`
    : "The two phase clocks are still separated. Move N until the orange trace crosses the horizontal axis.";
}

function updateMode(mode) {
  state.mode = mode;
  $$(".mode-button").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#geometryTitle").textContent = mode === "schiffer" ? "The Schiffer lens" : "The Berenstein lens";
  $("#modeDescription").textContent = mode === "schiffer"
    ? "Start at the symmetric cone-cylinder model. The critical Fourier mode is dormant on the trivial branch."
    : "Unroll the cylinder into a periodic rectangle. The same first mode appears as a wave joining the identified edges.";
  $("#stageFormula").textContent = mode === "schiffer" ? "R(s) ≈ R₀ − ½ Γ(λ)s²" : "periodic x ∼ x + 2πR";
  drawGeometry();
  drawCoincidences();
}

function stopAnimation() {
  state.playing = false;
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  $("#playBranch .play-icon").textContent = "▶";
  $("#playBranch span:last-child").textContent = "Play the bifurcation";
}

function playAnimation() {
  if (state.playing) { stopAnimation(); return; }
  state.playing = true;
  $("#playBranch .play-icon").textContent = "Ⅱ";
  $("#playBranch span:last-child").textContent = "Pause";
  const start = performance.now();
  function tick(now) {
    if (!state.playing) return;
    state.amplitude = .68 * Math.sin((now - start) / 1150);
    $("#amplitudeRange").value = state.amplitude;
    setRangeFill($("#amplitudeRange"));
    drawGeometry();
    state.animationFrame = requestAnimationFrame(tick);
  }
  state.animationFrame = requestAnimationFrame(tick);
}

$("#lambdaRange").addEventListener("input", (event) => {
  state.lambda = Number(event.target.value);
  setRangeFill(event.target);
  drawGeometry();
  drawCoincidences();
});

$("#amplitudeRange").addEventListener("input", (event) => {
  stopAnimation();
  state.amplitude = Number(event.target.value);
  setRangeFill(event.target);
  drawGeometry();
});

$("#nRange").addEventListener("input", (event) => {
  state.N = Number(event.target.value);
  setRangeFill(event.target);
  drawCoincidences();
});

$("#nearestButton").addEventListener("click", () => {
  const roots = findRoots(sampleGaps());
  const nearest = roots.reduce((best, candidate) => Math.abs(candidate.N - state.N) < Math.abs(best.N - state.N) ? candidate : best, roots[0]);
  if (!nearest) return;
  state.N = nearest.N;
  $("#nRange").value = state.N;
  setRangeFill($("#nRange"));
  drawCoincidences();
});

$$(".mode-button").forEach((button) => button.addEventListener("click", () => updateMode(button.dataset.mode)));
$("#playBranch").addEventListener("click", playAnimation);
$("#aboutButton").addEventListener("click", () => $("#aboutDialog").showModal());
$("#closeAbout").addEventListener("click", () => $("#aboutDialog").close());
$("#aboutDialog").addEventListener("click", (event) => {
  if (event.target === $("#aboutDialog")) $("#aboutDialog").close();
});

["#lambdaRange", "#amplitudeRange", "#nRange"].forEach((selector) => setRangeFill($(selector)));
drawGeometry();
drawCoincidences();
