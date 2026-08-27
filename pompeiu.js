/* Interactive figure for the introduction: the integral of cos(x1) over a disk.
 *
 * The field is drawn on a bounded window in the plane, and the disk is dragged
 * inside it. For a disk of radius r centred at t,
 *     int_{B_r(t)} cos(x_1) dx = 2 pi r J_1(r) cos(t_1),
 * so the value is fixed by the amplitude 2 pi r J_1(r) and by the centre. The
 * figure never says so; the reader moves the disk and reads it off.
 */
(() => {
  "use strict";

  const root = document.getElementById("pompeiuFigure");
  if (!root) return;

  const canvas = root.querySelector("#pompeiuCanvas");
  const valueOut = root.querySelector("#pompeiuValue");
  const radiusInput = root.querySelector("#pompeiuRadius");
  const radiusOut = root.querySelector("#pompeiuRadiusValue");
  const context = canvas && canvas.getContext("2d");
  if (!context || !valueOut || !radiusInput || !radiusOut) return;

  const FIRST_ZERO = 3.8317059702;
  const VIEW_Y = 7.4;
  const state = { radius: FIRST_ZERO, centre: { x: 0, y: 0 }, dragging: false };

  // The site's diverging field ramp, deep blue through paper to red.
  const STOPS = [
    { t: 0, rgb: [18, 39, 66] },
    { t: .25, rgb: [42, 116, 125] },
    { t: .5, rgb: [234, 227, 205] },
    { t: .75, rgb: [239, 112, 71] },
    { t: 1, rgb: [166, 43, 73] },
  ];
  function ramp(value) {
    const t = Math.max(0, Math.min(1, (value + 1.15) / 2.3));
    let left = STOPS[0], right = STOPS[STOPS.length - 1];
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i].t) { left = STOPS[i - 1]; right = STOPS[i]; break; }
    }
    const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
    return left.rgb.map((c, i) => Math.round(c + (right.rgb[i] - c) * local));
  }

  let field = null, width = 0, height = 0, scale = 1, dpr = 1;

  const toCanvasX = (value) => width / 2 + value * scale;
  const toCanvasY = (value) => height / 2 - value * scale;
  const toPlaneX = (px) => (px - width / 2) / scale;
  const toPlaneY = (py) => (height / 2 - py) / scale;

  function besselJ1(x) {
    const quarter = x * x / 4;
    let term = x / 2;
    let sum = term;
    for (let m = 1; m < 48; m++) {
      term *= -quarter / (m * (m + 1));
      sum += term;
      if (Math.abs(term) < 1e-16 * Math.max(1, Math.abs(sum))) break;
    }
    return sum;
  }

  function diskAmplitude(radius) {
    if (Math.abs(radius - FIRST_ZERO) < 1e-9) return 0;
    return 2 * Math.PI * radius * besselJ1(radius);
  }

  function updateSliderTrack(input) {
    const minimum = Number(input.min);
    const maximum = Number(input.max);
    const fraction = (Number(input.value) - minimum) / (maximum - minimum);
    input.style.setProperty("--value", `${(100 * fraction).toFixed(2)}%`);
  }

  function updateRadiusControl() {
    const isZero = Math.abs(state.radius - FIRST_ZERO) < 1e-7;
    window.SchifferMath?.render(radiusOut,
      isZero ? "r=\\rho_1=3.8317\\ldots" : `r=${state.radius.toFixed(2)}`);
    updateSliderTrack(radiusInput);
  }

  function buildField() {
    const image = context.createImageData(width, height);
    const data = image.data;
    // cos(x1) depends on the column only, so one ramp lookup per column.
    const column = new Uint8ClampedArray(width * 3);
    for (let px = 0; px < width; px++) {
      const rgb = ramp(Math.cos(toPlaneX(px + .5)));
      column[px * 3] = rgb[0]; column[px * 3 + 1] = rgb[1]; column[px * 3 + 2] = rgb[2];
    }
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const i = (py * width + px) * 4;
        data[i] = column[px * 3];
        data[i + 1] = column[px * 3 + 1];
        data[i + 2] = column[px * 3 + 2];
        data[i + 3] = 255;
      }
    }
    field = image;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const nextWidth = Math.max(120, Math.round(rect.width * dpr));
    const nextHeight = Math.max(120, Math.round(rect.height * dpr));
    if (nextWidth === width && nextHeight === height && field) { draw(); return; }
    width = nextWidth;
    height = nextHeight;
    scale = height / (2 * VIEW_Y);
    canvas.width = width;
    canvas.height = height;
    buildField();
    draw();
  }

  function clampCentre() {
    if (!width || !height) return;
    const xLimit = width / (2 * scale) - state.radius;
    const yLimit = height / (2 * scale) - state.radius;
    state.centre.x = Math.max(-xLimit, Math.min(xLimit, state.centre.x));
    state.centre.y = Math.max(-yLimit, Math.min(yLimit, state.centre.y));
  }

  function draw() {
    if (!field) return;
    context.putImageData(field, 0, 0);

    const cx = toCanvasX(state.centre.x);
    const cy = toCanvasY(state.centre.y);
    const cr = state.radius * scale;

    // Wash everything outside the disk so the region being integrated reads first.
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.arc(cx, cy, cr, 0, Math.PI * 2, true);
    context.fillStyle = "rgba(241,238,229,.58)";
    context.fill("evenodd");
    context.restore();

    // Ticks at multiples of pi along the bottom, so the wavelength is visible.
    context.save();
    context.strokeStyle = "rgba(19,33,38,.32)";
    context.fillStyle = "rgba(19,33,38,.5)";
    context.lineWidth = Math.max(1, dpr);
    context.font = `${10.5 * dpr}px "KaTeX_Main", serif`;
    context.textAlign = "center";
    const tickLimit = Math.floor(width / (2 * scale * Math.PI));
    for (let k = -tickLimit; k <= tickLimit; k++) {
      const px = toCanvasX(k * Math.PI);
      context.beginPath();
      context.moveTo(px, height);
      context.lineTo(px, height - 8 * dpr);
      context.stroke();
      const label = k === 0 ? "0" : (k === 1 ? "π" : k === -1 ? "−π" : `${k}π`);
      context.fillText(label, px, height - 13 * dpr);
    }
    context.restore();

    // The disk itself.
    context.save();
    context.beginPath();
    context.arc(cx, cy, cr, 0, Math.PI * 2);
    context.lineWidth = 2 * dpr;
    context.strokeStyle = "#132126";
    context.stroke();
    context.beginPath();
    context.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
    context.fillStyle = "#132126";
    context.fill();
    context.restore();

    const value = diskAmplitude(state.radius) * Math.cos(state.centre.x);
    const shown = Math.abs(value) < 5e-4 ? 0 : value;
    valueOut.textContent = `= ${shown.toFixed(3)}`;
    canvas.setAttribute("aria-label",
      `Disk of radius ${state.radius.toFixed(3)} centred at (${state.centre.x.toFixed(2)}, ${state.centre.y.toFixed(2)}); the integral of cosine of x one over it is ${shown.toFixed(3)}`);
  }

  function setRadius(radius) {
    if (!Number.isFinite(radius)) return;
    if (Math.abs(radius - FIRST_ZERO) <= .08) radius = FIRST_ZERO;
    state.radius = Math.max(Number(radiusInput.min), Math.min(Number(radiusInput.max), radius));
    radiusInput.value = String(state.radius);
    clampCentre();
    updateRadiusControl();
    draw();
  }

  function pointerTo(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    state.centre.x = toPlaneX((event.clientX - rect.left) / rect.width * width);
    state.centre.y = toPlaneY((event.clientY - rect.top) / rect.height * height);
    clampCentre();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    pointerTo(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => { if (state.dragging) pointerTo(event); });
  const release = (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 1 : .25;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (!move) return;
    state.centre.x += move[0];
    state.centre.y += move[1];
    clampCentre();
    draw();
    event.preventDefault();
  });

  radiusInput.addEventListener("input", () => setRadius(Number(radiusInput.value)));

  setRadius(FIRST_ZERO);
  const disclosure = root.closest("details");
  if (disclosure) disclosure.addEventListener("toggle", () => {
    if (disclosure.open) requestAnimationFrame(resize);
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  resize();
})();

/* The one-dimensional version of the same measurement problem. For an
 * interval of length L centred at t,
 *     int cos(x) dx = 2 sin(L/2) cos(t).
 * The full-period interval is therefore blind at every position. */
(() => {
  "use strict";

  const root = document.getElementById("lineProbeFigure");
  if (!root) return;
  const canvas = root.querySelector("#lineProbeCanvas");
  const context = canvas && canvas.getContext("2d");
  const valueOut = root.querySelector("#lineProbeValue");
  const lengthInput = root.querySelector("#lineProbeLength");
  const lengthOut = root.querySelector("#lineProbeLengthValue");
  if (!context || !valueOut || !lengthInput || !lengthOut) return;

  const VIEW = 4 * Math.PI;
  const state = { length: 2 * Math.PI, centre: 0, dragging: false };
  let width = 0, height = 0, dpr = 1;

  const STOPS = [
    { t: 0, rgb: [18, 39, 66] },
    { t: .25, rgb: [42, 116, 125] },
    { t: .5, rgb: [234, 227, 205] },
    { t: .75, rgb: [239, 112, 71] },
    { t: 1, rgb: [166, 43, 73] },
  ];
  function ramp(value, alpha = 1) {
    const t = Math.max(0, Math.min(1, (value + 1.15) / 2.3));
    let left = STOPS[0], right = STOPS[STOPS.length - 1];
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i].t) { left = STOPS[i - 1]; right = STOPS[i]; break; }
    }
    const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
    const rgb = left.rgb.map((c, i) => Math.round(c + (right.rgb[i] - c) * local));
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  const toPixel = (x) => (x + VIEW) / (2 * VIEW) * width;
  const toField = (px) => px / width * (2 * VIEW) - VIEW;

  function clampCentre() {
    const half = state.length / 2;
    state.centre = Math.max(-VIEW + half, Math.min(VIEW - half, state.centre));
  }

  function updateSliderTrack(input) {
    const minimum = Number(input.min);
    const maximum = Number(input.max);
    const fraction = (Number(input.value) - minimum) / (maximum - minimum);
    input.style.setProperty("--value", `${(100 * fraction).toFixed(2)}%`);
  }

  function updateLengthControl() {
    const atTwoPi = Math.abs(state.length - 2 * Math.PI) < 1e-7;
    const source = atTwoPi ? "L=2\\pi" : `L=${state.length.toFixed(2)}`;
    window.SchifferMath?.render(lengthOut, source);
    updateSliderTrack(lengthInput);
  }

  function updateReadout() {
    const value = 2 * Math.sin(state.length / 2) * Math.cos(state.centre);
    const shown = Math.abs(value) < 5e-4 ? 0 : value;
    valueOut.textContent = `= ${shown.toFixed(3)}`;
    canvas.setAttribute("aria-label", `Interval of length ${state.length.toFixed(3)} centred at ${state.centre.toFixed(2)}; its integral of cosine x is ${shown.toFixed(3)}`);
  }

  function draw() {
    if (!width || !height) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);

    context.fillStyle = "#e9e3d3";
    context.fillRect(0, 0, width, height);
    for (let px = 0; px < width; px += 2) {
      context.fillStyle = ramp(Math.cos(toField(px + 1)), .78);
      context.fillRect(px, 0, 2.5, height);
    }

    const left = toPixel(state.centre - state.length / 2);
    const right = toPixel(state.centre + state.length / 2);
    context.fillStyle = "rgba(241,238,229,.70)";
    context.fillRect(0, 0, left, height);
    context.fillRect(right, 0, width - right, height);

    const mid = height * .47;
    const amplitude = Math.min(72, height * .25);
    context.beginPath();
    for (let px = 0; px <= width; px += 2) {
      const y = mid - amplitude * Math.cos(toField(px));
      if (px === 0) context.moveTo(px, y); else context.lineTo(px, y);
    }
    context.strokeStyle = "#132126";
    context.lineWidth = 2;
    context.stroke();

    context.strokeStyle = "rgba(19,33,38,.35)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, mid); context.lineTo(width, mid);
    context.stroke();

    context.strokeStyle = "#ff7449";
    context.fillStyle = "#ff7449";
    context.lineWidth = 2.5;
    [left, right].forEach((x) => {
      context.beginPath(); context.moveTo(x, 12); context.lineTo(x, height - 25); context.stroke();
    });
    context.beginPath();
    context.moveTo(left, height - 28); context.lineTo(right, height - 28);
    context.moveTo(left, height - 35); context.lineTo(left, height - 21);
    context.moveTo(right, height - 35); context.lineTo(right, height - 21);
    context.stroke();
    context.font = '500 11px "KaTeX_Main", serif';
    context.textAlign = "center";
    const lengthLabel = Math.abs(state.length - 2 * Math.PI) < 1e-7
      ? "L = 2π"
      : `L = ${state.length.toFixed(2)}`;
    context.fillText(lengthLabel, (left + right) / 2, height - 8);

    context.fillStyle = "rgba(19,33,38,.55)";
    for (let k = -3; k <= 3; k++) {
      const x = toPixel(k * Math.PI);
      const label = k === 0 ? "0" : (k === 1 ? "π" : k === -1 ? "−π" : `${k}π`);
      context.fillText(label, x, mid + 17);
    }
    updateReadout();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(120, Math.round(width * dpr));
    canvas.height = Math.max(100, Math.round(height * dpr));
    draw();
  }

  function pointerTo(event) {
    const rect = canvas.getBoundingClientRect();
    state.centre = toField((event.clientX - rect.left) / rect.width * width);
    clampCentre();
    draw();
  }

  function setLength(length) {
    if (!Number.isFinite(length)) return;
    if (Math.abs(length - 2 * Math.PI) <= .15) length = 2 * Math.PI;
    state.length = Math.max(Number(lengthInput.min), Math.min(Number(lengthInput.max), length));
    lengthInput.value = String(state.length);
    clampCentre();
    updateLengthControl();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    pointerTo(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => { if (state.dragging) pointerTo(event); });
  const release = (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    state.centre += direction * (event.shiftKey ? .75 : .2);
    clampCentre();
    draw();
    event.preventDefault();
  });
  lengthInput.addEventListener("input", () => setLength(Number(lengthInput.value)));
  const disclosure = root.closest("details");
  if (disclosure) disclosure.addEventListener("toggle", () => {
    if (disclosure.open) requestAnimationFrame(resize);
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  setLength(2 * Math.PI);
  resize();
})();

/* A live plot of the first three radial Neumann modes of the unit disk. The
 * frequencies are the first three positive zeros of J_1. Drawing concentric
 * annuli keeps the animation inexpensive while evaluating the actual J_0
 * profile in the browser. */
(() => {
  "use strict";

  const root = document.getElementById("schifferModeFigure");
  if (!root) return;
  const canvas = root.querySelector("#schifferModeCanvas");
  const context = canvas && canvas.getContext("2d");
  const playButton = root.querySelector("#schifferModePlay");
  const modeButtons = [...root.querySelectorAll("[data-radial-mode]")];
  if (!context || !playButton) return;

  const MODES = [
    { n: 1, rho: 3.8317059702, nodes: [2.4048255577] },
    { n: 2, rho: 7.0155866698, nodes: [2.4048255577, 5.5200781103] },
    { n: 3, rho: 10.1734681351, nodes: [2.4048255577, 5.5200781103, 8.6537279129] },
  ];
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { mode: MODES[2], running: !reducedMotion, visible: true, phase: 0, previous: 0 };
  let width = 0, height = 0, dpr = 1, frame = 0;

  function besselJ0(x) {
    const quarter = x * x / 4;
    let term = 1, sum = 1;
    for (let m = 1; m < 42; m++) {
      term *= -quarter / (m * m);
      sum += term;
      if (Math.abs(term) < 1e-13) break;
    }
    return sum;
  }

  const STOPS = [
    { t: 0, rgb: [18, 39, 66] },
    { t: .25, rgb: [42, 116, 125] },
    { t: .5, rgb: [234, 227, 205] },
    { t: .75, rgb: [239, 112, 71] },
    { t: 1, rgb: [166, 43, 73] },
  ];
  function ramp(value) {
    const t = Math.max(0, Math.min(1, (value + 1.05) / 2.1));
    let left = STOPS[0], right = STOPS[STOPS.length - 1];
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i].t) { left = STOPS[i - 1]; right = STOPS[i]; break; }
    }
    const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
    const rgb = left.rgb.map((c, i) => Math.round(c + (right.rgb[i] - c) * local));
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }

  function draw() {
    if (!width || !height) return;
    const temporal = Math.cos(state.phase);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);
    context.fillStyle = "#e8e1cf";
    context.fillRect(0, 0, width, height);

    const cx = width * .285;
    const cy = height * .49;
    const radius = Math.min(height * .37, width * .225);
    const rings = 150;
    for (let i = rings; i >= 1; i--) {
      const radial = i / rings;
      context.beginPath();
      context.arc(cx, cy, radius * radial + .8, 0, Math.PI * 2);
      context.fillStyle = ramp(besselJ0(state.mode.rho * radial) * temporal);
      context.fill();
    }
    context.strokeStyle = "#132126";
    context.lineWidth = 2;
    context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = "rgba(241,238,229,.82)";
    context.lineWidth = 1.2;
    state.mode.nodes.forEach((zero) => {
      context.beginPath(); context.arc(cx, cy, radius * zero / state.mode.rho, 0, Math.PI * 2); context.stroke();
    });

    const graphLeft = width * .57;
    const graphRight = width * .95;
    const graphMid = height * .50;
    const graphAmplitude = height * .29;
    context.strokeStyle = "rgba(19,33,38,.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(graphLeft, graphMid); context.lineTo(graphRight, graphMid);
    context.moveTo(graphLeft, height * .16); context.lineTo(graphLeft, height * .84);
    context.stroke();

    context.beginPath();
    for (let i = 0; i <= 180; i++) {
      const radial = i / 180;
      const x = graphLeft + (graphRight - graphLeft) * radial;
      const y = graphMid - graphAmplitude * besselJ0(state.mode.rho * radial) * temporal;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = "#ff7449";
    context.lineWidth = 2.4;
    context.stroke();

    const rimValue = besselJ0(state.mode.rho) * temporal;
    const rimY = graphMid - graphAmplitude * rimValue;
    context.setLineDash([4, 4]);
    context.strokeStyle = "rgba(19,33,38,.45)";
    context.beginPath(); context.moveTo(graphRight, graphMid); context.lineTo(graphRight, rimY); context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#132126";
    context.beginPath(); context.arc(graphRight, rimY, 3.2, 0, Math.PI * 2); context.fill();

    context.fillStyle = "rgba(19,33,38,.62)";
    context.font = '500 11px "DM Mono", ui-monospace, monospace';
    context.textAlign = "left";
    context.fillText("centre", graphLeft, height * .91);
    context.textAlign = "right";
    context.fillText("rim", graphRight, height * .91);
    context.textAlign = "left";
    context.fillText("selected radial profile", graphLeft, height * .11);
    context.fillStyle = "#ff7449";
    context.fillText("radial profile at this instant", graphLeft, height * .96);
    canvas.setAttribute("aria-label", `Animated radial Neumann mode ${state.mode.n} on the disk, with frequency parameter ${state.mode.rho.toFixed(4)}`);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width;
    height = rect.height;
    dpr = Math.min(1.75, window.devicePixelRatio || 1);
    canvas.width = Math.max(240, Math.round(width * dpr));
    canvas.height = Math.max(150, Math.round(height * dpr));
    draw();
  }

  function syncPlayButton() {
    playButton.textContent = state.running ? "pause" : "play";
    playButton.setAttribute("aria-label", state.running ? "Pause radial mode animation" : "Play radial mode animation");
    playButton.setAttribute("aria-pressed", String(!state.running));
  }

  function animate(now) {
    if (!state.previous) state.previous = now;
    const elapsed = Math.min(80, now - state.previous);
    state.previous = now;
    if (state.running && state.visible) {
      state.phase = (state.phase + elapsed * Math.PI / 2000) % (2 * Math.PI);
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  playButton.addEventListener("click", () => {
    state.running = !state.running;
    state.previous = performance.now();
    syncPlayButton();
    draw();
  });
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    const mode = MODES.find((entry) => entry.n === Number(button.dataset.radialMode));
    if (!mode) return;
    state.mode = mode;
    state.phase = 0;
    modeButtons.forEach((entry) => entry.setAttribute("aria-pressed", String(entry === button)));
    draw();
  }));
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => { state.visible = entries[0].isIntersecting; }, { rootMargin: "120px" }).observe(root);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  syncPlayButton();
  resize();
  frame = requestAnimationFrame(animate);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
})();
