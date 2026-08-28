/* The normal graph used in the linearized shape calculation. The arrows show
 * the fixed velocity f nu at t=0; the slider moves the current boundary in
 * either direction through that reference shape. */
(() => {
  "use strict";

  const root = document.getElementById("shapeVariationFigure");
  if (!root) return;
  const svg = root.querySelector("#shapeVariationSvg");
  const reference = root.querySelector("#shapeVariationReference");
  const current = root.querySelector("#shapeVariationCurrent");
  const arrowAnchors = root.querySelector("#shapeVariationArrowAnchors");
  const arrows = root.querySelector("#shapeVariationArrows");
  const displacement = root.querySelector("#shapeVariationDisplacement");
  const point = root.querySelector("#shapeVariationPoint");
  const movedPoint = root.querySelector("#shapeVariationMovedPoint");
  const pointLabelBox = root.querySelector("#shapeVariationPointLabelBox");
  const pointLabel = root.querySelector("#shapeVariationPointLabel");
  const domainLabel = root.querySelector("#shapeVariationDomainLabel");
  const slider = root.querySelector("#shapeVariationSlider");
  const output = root.querySelector("#shapeVariationValue");
  if (!svg || !reference || !current || !arrowAnchors || !arrows || !displacement || !point ||
      !movedPoint || !pointLabelBox || !pointLabel || !domainLabel || !slider || !output) return;

  const NS = "http://www.w3.org/2000/svg";
  const CX = 310;
  const CY = 195;
  const RADIUS = 121;
  const DISPLACEMENT = 28;
  const ARROW_SCALE = 50;

  // A smooth, deliberately asymmetric profile. It is fixed throughout the
  // interaction; the slider changes only the signed deformation parameter.
  const profile = (theta) => .62 * Math.cos(2 * theta)
    + .27 * Math.sin(3 * theta) + .18 * Math.cos(theta) - .10;

  function boundaryPoint(theta, tau = 0) {
    const radius = RADIUS + tau * DISPLACEMENT * profile(theta);
    return {
      x: CX + radius * Math.cos(theta),
      y: CY + radius * Math.sin(theta),
    };
  }

  function boundaryPath(tau) {
    const points = [];
    for (let i = 0; i < 240; i++) {
      const theta = 2 * Math.PI * i / 240;
      points.push(boundaryPoint(theta, tau));
    }
    return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
  }

  reference.setAttribute("d", boundaryPath(0));
  for (let i = 0; i < 12; i++) {
    const theta = 2 * Math.PI * i / 12;
    const velocity = profile(theta);
    if (Math.abs(velocity) < .30) continue;
    const start = boundaryPoint(theta, 0);
    const endRadius = RADIUS + ARROW_SCALE * velocity;
    const anchor = document.createElementNS(NS, "circle");
    anchor.setAttribute("cx", start.x.toFixed(2));
    anchor.setAttribute("cy", start.y.toFixed(2));
    anchor.setAttribute("r", "2.7");
    arrowAnchors.appendChild(anchor);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", start.x.toFixed(2));
    line.setAttribute("y1", start.y.toFixed(2));
    line.setAttribute("x2", (CX + endRadius * Math.cos(theta)).toFixed(2));
    line.setAttribute("y2", (CY + endRadius * Math.sin(theta)).toFixed(2));
    arrows.appendChild(line);
  }

  function setLine(line, a, b) {
    line.setAttribute("x1", a.x.toFixed(2));
    line.setAttribute("y1", a.y.toFixed(2));
    line.setAttribute("x2", b.x.toFixed(2));
    line.setAttribute("y2", b.y.toFixed(2));
  }

  function setCircle(circle, p) {
    circle.setAttribute("cx", p.x.toFixed(2));
    circle.setAttribute("cy", p.y.toFixed(2));
  }

  function update(rawTau) {
    let tau = Math.max(-1, Math.min(1, Number(rawTau)));
    if (Math.abs(tau) <= .035) tau = 0;
    slider.value = String(tau);
    current.setAttribute("d", boundaryPath(tau));

    const base = boundaryPoint(0, 0);
    const moved = boundaryPoint(0, tau);
    setLine(displacement, base, moved);
    setCircle(point, base);
    setCircle(movedPoint, moved);
    pointLabelBox.setAttribute("x", (moved.x + 8).toFixed(2));
    pointLabelBox.setAttribute("y", (moved.y - 23).toFixed(2));
    window.SchifferMath?.render(pointLabel, tau === 0 ? "p_0" : "p_t", { serif: true });
    window.SchifferMath?.render(domainLabel, tau === 0 ? "\\Omega_0" : "\\Omega_t", { serif: true });
    reference.style.opacity = tau === 0 ? ".24" : ".88";

    const source = tau === 0 ? "t=0" : `t=${tau > 0 ? "+" : ""}${tau.toFixed(2)}\\varepsilon`;
    window.SchifferMath?.render(output, source);
    const position = 50 * (tau + 1);
    const low = Math.min(50, position).toFixed(2);
    const high = Math.max(50, position).toFixed(2);
    slider.style.background = `linear-gradient(to right, rgba(19,33,38,.16) 0%, rgba(19,33,38,.16) ${low}%, var(--orange) ${low}%, var(--orange) ${high}%, rgba(19,33,38,.16) ${high}%, rgba(19,33,38,.16) 100%)`;
    svg.setAttribute("aria-label", `Normal deformation at t divided by epsilon equal to ${tau.toFixed(2)}. The dashed reference boundary and orange current boundary are shown with fixed normal-velocity arrows.`);
  }

  slider.addEventListener("input", () => update(slider.value));
  update(0);
})();

/* Interactive figure for the introduction: the integral of cos(x1) over a disk.
 *
 * The field is drawn on a bounded window in the plane, and the disk is dragged
 * inside it. For a disk of radius r centred at t,
 *     int_{B_r(t)} cos(x_1) dx = 2 pi r J_1(r) cos(t_1),
 * so the value is fixed by the amplitude 2 pi r J_1(r) and by the centre. The
 * live readout keeps both factors visible while the reader moves the disk.
 */
(() => {
  "use strict";

  const root = document.getElementById("pompeiuFigure");
  if (!root) return;

  const canvas = root.querySelector("#pompeiuCanvas");
  const valueOut = root.querySelector("#pompeiuValue");
  const coefficientOut = root.querySelector("#pompeiuCoefficient");
  const identityReadout = root.querySelector(".pompeiu-identity-readout");
  const primaryIdentity = root.querySelector("#pompeiuIdentity") || valueOut?.closest(".measurement-identity");
  const secondaryIdentity = root.querySelector("#pompeiuCoefficientIdentity") || coefficientOut?.closest(".measurement-identity");
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

  function renderMath(element, source) {
    if (!element) return;
    if (window.SchifferMath?.render) {
      window.SchifferMath.render(element, source);
    } else {
      element.textContent = source;
    }
  }

  function renderIdentityParts(integralText, coefficientText) {
    const parts = [
      ["integral", "\\int_{B_r(t)}\\cos(x_1)\\,dx"],
      ["factor", "C(r)\\cos(t_1)"],
      ["coefficient", "C(r)"],
      ["coefficient-formula", "2\\pi r J_1(r)"],
    ];
    parts.forEach(([name, source]) => {
      root.querySelectorAll(`[data-pompeiu-math="${name}"]`).forEach((element) => renderMath(element, source));
    });
    root.querySelectorAll('[data-pompeiu-math="equals"]').forEach((element) => renderMath(element, "="));
    renderMath(valueOut, integralText);
    renderMath(coefficientOut, coefficientText);
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
    context.font = `${(window.SCHIFFER_VISUAL_THEME?.labelPixels || 11) * dpr}px "KaTeX_Main", serif`;
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

    const coefficient = diskAmplitude(state.radius);
    const value = coefficient * Math.cos(state.centre.x);
    const shownCoefficient = Math.abs(coefficient) < 5e-4 ? 0 : coefficient;
    const shown = Math.abs(value) < 5e-4 ? 0 : value;
    const integralText = shown.toFixed(3);
    const coefficientText = shownCoefficient.toFixed(3);
    if (identityReadout) {
      renderIdentityParts(integralText, coefficientText);
      primaryIdentity?.setAttribute("aria-label",
        `Integral over the translated disk equals C of r times cosine of t one, which is ${integralText}`);
      secondaryIdentity?.setAttribute("aria-label",
        `C of r equals two pi r times J one of r, which is ${coefficientText}`);
    } else {
      valueOut.textContent = `= ${integralText}`;
    }
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
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events used by layout tests do not create an
        // active browser pointer, so capture is best-effort.
      }
    }
    pointerTo(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => { if (state.dragging) pointerTo(event); });
  const release = (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Matching the capture guard above, release is best-effort for tests.
      }
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
  const marginToggle = document.getElementById("pompeiu-model-note");
  if (marginToggle) marginToggle.addEventListener("change", () => {
    if (marginToggle.checked) requestAnimationFrame(resize);
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

    context.fillStyle = "#f1eee5";
    context.fillRect(0, 0, width, height);

    const left = toPixel(state.centre - state.length / 2);
    const right = toPixel(state.centre + state.length / 2);
    const mid = height * .47;
    const amplitude = Math.min(112, height * .30);
    const curveY = (px) => mid - amplitude * Math.cos(toField(px));

    // Conventional axes and light guide lines for the graph y = cos(x).
    context.strokeStyle = "rgba(19,33,38,.12)";
    context.lineWidth = 1;
    [-1, 1].forEach((value) => {
      const y = mid - value * amplitude;
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    });
    context.strokeStyle = "rgba(19,33,38,.34)";
    context.beginPath(); context.moveTo(0, mid); context.lineTo(width, mid); context.stroke();
    const zeroX = toPixel(0);
    context.beginPath(); context.moveTo(zeroX, 18); context.lineTo(zeroX, height - 50); context.stroke();

    // Shade only the signed area over the selected interval. Positive and
    // negative pieces use the two sides of the site's diverging palette.
    for (let px = Math.max(0, left); px < Math.min(width, right); px += 2) {
      const value = Math.cos(toField(px + 1));
      const y = mid - amplitude * value;
      context.fillStyle = value >= 0 ? "rgba(255,116,73,.22)" : "rgba(42,116,125,.20)";
      context.fillRect(px, Math.min(mid, y), 2.5, Math.abs(mid - y));
    }

    // Draw the graph itself after the area so its geometry remains crisp.
    context.beginPath();
    for (let px = 0; px <= width; px += 2) {
      const y = curveY(px);
      if (px === 0) context.moveTo(px, y); else context.lineTo(px, y);
    }
    context.strokeStyle = "#132126";
    context.lineWidth = 2;
    context.stroke();

    context.strokeStyle = "#ff7449";
    context.fillStyle = "#ff7449";
    context.lineWidth = 2.5;
    const intervalY = height - 29;
    context.beginPath();
    context.moveTo(left, intervalY); context.lineTo(right, intervalY);
    context.moveTo(left, intervalY - 7); context.lineTo(left, intervalY + 7);
    context.moveTo(right, intervalY - 7); context.lineTo(right, intervalY + 7);
    context.stroke();
    context.font = `500 ${window.SCHIFFER_VISUAL_THEME?.labelPixels || 11}px "KaTeX_Main", serif`;
    context.textAlign = "center";
    const lengthLabel = Math.abs(state.length - 2 * Math.PI) < 1e-7
      ? "L = 2π"
      : `L = ${state.length.toFixed(2)}`;
    context.fillText(lengthLabel, (left + right) / 2, height - 8);

    context.fillStyle = "rgba(19,33,38,.55)";
    for (let k = -3; k <= 3; k++) {
      const x = toPixel(k * Math.PI);
      const label = k === 0 ? "0" : (k === 1 ? "π" : k === -1 ? "−π" : `${k}π`);
      context.beginPath(); context.moveTo(x, mid - 4); context.lineTo(x, mid + 4); context.strokeStyle = "rgba(19,33,38,.32)"; context.lineWidth = 1; context.stroke();
      context.fillText(label, x, mid + 17);
    }
    context.textAlign = "left";
    context.fillText("1", 8, mid - amplitude - 7);
    context.fillText("−1", 8, mid + amplitude + 14);
    context.textAlign = "right";
    context.fillStyle = "rgba(19,33,38,.72)";
    context.fillText("f(x) = cos x", width - 12, 22);
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
 * frequencies are the first three positive zeros of J_1. The left panel is a
 * shallow oblique projection of the actual radial graph z=J_0(rho r)cos(t),
 * while the right panel shows the same profile in radial coordinates. */
(() => {
  "use strict";

  const root = document.getElementById("schifferModeFigure");
  if (!root) return;
  const canvas = root.querySelector("#schifferModeCanvas");
  const context = canvas && canvas.getContext("2d");
  const playButton = root.querySelector("#schifferModePlay");
  const modeButtons = [...root.querySelectorAll("[data-radial-mode]")];
  if (!context || !playButton) return;
  const visualTheme = window.SCHIFFER_VISUAL_THEME || { background: "#e8e1cf" };

  const MODES = [
    { n: 1, rho: 3.8317059702, nodes: [2.4048255577] },
    { n: 2, rho: 7.0155866698, nodes: [2.4048255577, 5.5200781103] },
    { n: 3, rho: 10.1734681351, nodes: [2.4048255577, 5.5200781103, 8.6537279129] },
  ];
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { mode: MODES[2], running: !reducedMotion, visible: true, phase: 0, previous: 0, lastDraw: 0 };
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
  function rampRgb(value) {
    const t = Math.max(0, Math.min(1, (value + 1.05) / 2.1));
    let left = STOPS[0], right = STOPS[STOPS.length - 1];
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i].t) { left = STOPS[i - 1]; right = STOPS[i]; break; }
    }
    const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
    return left.rgb.map((c, i) => Math.round(c + (right.rgb[i] - c) * local));
  }

  function surfaceColour(value, light) {
    const rgb = rampRgb(value);
    const lit = rgb.map((channel) => {
      if (light >= 1) return channel + (255 - channel) * Math.min(.28, light - 1);
      return channel * Math.max(.72, light);
    }).map((channel) => Math.round(Math.max(0, Math.min(255, channel))));
    return `rgb(${lit[0]},${lit[1]},${lit[2]})`;
  }

  function membranePath(points) {
    context.beginPath();
    points.forEach((point, index) => {
      if (index) context.lineTo(point.x, point.y);
      else context.moveTo(point.x, point.y);
    });
  }

  function drawMembrane(temporal) {
    const cx = width * .285;
    const cy = height * .535;
    const radiusX = Math.min(height * .35, width * .225);
    const radiusY = radiusX * .43;
    const verticalScale = radiusX * .135;
    const radialSteps = 30;
    const angularSteps = 72;
    const profile = Array.from(
      { length: radialSteps + 1 },
      (_, index) => besselJ0(state.mode.rho * index / radialSteps) * temporal,
    );

    const project = (radial, theta, value) => ({
      x: cx + radiusX * radial * Math.cos(theta),
      y: cy + radiusY * radial * Math.sin(theta) - verticalScale * value,
    });

    // A restrained shadow fixes the orientation without making the membrane
    // look like a thick plate.
    context.fillStyle = "rgba(19,33,38,.13)";
    context.beginPath();
    context.ellipse(cx, cy + radiusY * .88 + verticalScale * .62, radiusX * .9, radiusY * .22, 0, 0, Math.PI * 2);
    context.fill();

    const cells = [];
    for (let radialIndex = 0; radialIndex < radialSteps; radialIndex++) {
      const radial0 = radialIndex / radialSteps;
      const radial1 = (radialIndex + 1) / radialSteps;
      for (let angularIndex = 0; angularIndex < angularSteps; angularIndex++) {
        const theta0 = Math.PI * 2 * angularIndex / angularSteps;
        const theta1 = Math.PI * 2 * (angularIndex + 1) / angularSteps;
        const points = [
          project(radial0, theta0, profile[radialIndex]),
          project(radial1, theta0, profile[radialIndex + 1]),
          project(radial1, theta1, profile[radialIndex + 1]),
          project(radial0, theta1, profile[radialIndex]),
        ];
        const thetaMid = (theta0 + theta1) / 2;
        const value = (profile[radialIndex] + profile[radialIndex + 1]) / 2;
        const slope = (profile[radialIndex + 1] - profile[radialIndex]) * radialSteps;
        const light = .92 + .13 * Math.cos(thetaMid + .85) - .035 * Math.tanh(slope * .4);
        cells.push({
          points,
          depth: points.reduce((sum, point) => sum + point.y, 0) / points.length,
          colour: surfaceColour(value, light),
        });
      }
    }
    cells.sort((left, right) => left.depth - right.depth);
    context.lineJoin = "round";
    cells.forEach((cell) => {
      membranePath(cell.points);
      context.closePath();
      context.fillStyle = cell.colour;
      context.fill();
    });

    // Sparse coordinate curves make the vertical displacement legible while
    // preserving the smooth appearance of the radial graph.
    context.strokeStyle = "rgba(19,33,38,.16)";
    context.lineWidth = .65;
    for (let angularIndex = 0; angularIndex < 16; angularIndex++) {
      const theta = Math.PI * 2 * angularIndex / 16;
      const points = [];
      for (let radialIndex = 0; radialIndex <= radialSteps; radialIndex++) {
        points.push(project(radialIndex / radialSteps, theta, profile[radialIndex]));
      }
      membranePath(points);
      context.stroke();
    }
    for (let radialIndex = 5; radialIndex < radialSteps; radialIndex += 5) {
      const radial = radialIndex / radialSteps;
      const points = [];
      for (let angularIndex = 0; angularIndex <= angularSteps; angularIndex++) {
        const theta = Math.PI * 2 * angularIndex / angularSteps;
        points.push(project(radial, theta, profile[radialIndex]));
      }
      membranePath(points);
      context.closePath();
      context.stroke();
    }

    // The nodal circles remain at zero height throughout the motion.
    context.strokeStyle = "rgba(248,244,230,.9)";
    context.lineWidth = 1.15;
    state.mode.nodes.forEach((zero) => {
      const radial = zero / state.mode.rho;
      const points = [];
      for (let angularIndex = 0; angularIndex <= angularSteps; angularIndex++) {
        points.push(project(radial, Math.PI * 2 * angularIndex / angularSteps, 0));
      }
      membranePath(points);
      context.closePath();
      context.stroke();
    });

    // Radiality makes the boundary value independent of angle, while
    // J_1(rho_n)=0 makes the radial slope vanish there. The whole rim is one
    // ellipse translated by a single vertical amount.
    const rimValue = profile[radialSteps];
    const rim = [];
    for (let angularIndex = 0; angularIndex <= angularSteps; angularIndex++) {
      rim.push(project(1, Math.PI * 2 * angularIndex / angularSteps, rimValue));
    }
    membranePath(rim);
    context.closePath();
    context.strokeStyle = "#132126";
    context.lineWidth = 2;
    context.stroke();

    const rimPoint = project(1, 0, rimValue);
    context.setLineDash([3, 3]);
    context.strokeStyle = "rgba(19,33,38,.42)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rimPoint.x, cy);
    context.lineTo(rimPoint.x, rimPoint.y);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#ff7449";
    context.beginPath();
    context.arc(rimPoint.x, rimPoint.y, 3, 0, Math.PI * 2);
    context.fill();

    if (!visualTheme.paperEdition) {
      context.fillStyle = "rgba(19,33,38,.62)";
      context.font = '500 11px "DM Mono", ui-monospace, monospace';
      context.textAlign = "left";
      context.fillText("shallow 3D displacement", width * .06, height * .11);
      context.fillStyle = "#ff7449";
      context.fillText("constant value along the rim", width * .06, height * .92);
    }
  }

  function draw() {
    if (!width || !height) return;
    const temporal = Math.cos(state.phase);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);
    context.fillStyle = visualTheme.background;
    context.fillRect(0, 0, width, height);

    drawMembrane(temporal);

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
    context.font = window.SCHIFFER_VISUAL_THEME?.labelFont || '500 11px "DM Mono", ui-monospace, monospace';
    context.textAlign = "left";
    context.fillText("centre", graphLeft, height * .91);
    context.textAlign = "right";
    context.fillText("rim", graphRight, height * .91);
    canvas.setAttribute("aria-label", `Shallow three-dimensional animation of radial Neumann mode ${state.mode.n} on the disk, with frequency parameter ${state.mode.rho.toFixed(4)}`);
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
      state.phase = (state.phase + elapsed * Math.PI / 4000) % (2 * Math.PI);
      if (!state.lastDraw || now - state.lastDraw >= 1000 / 30) {
        state.lastDraw = now;
        draw();
      }
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
