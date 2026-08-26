/* Interactive figure for the introduction: the integral of cos(x1) over a disk.
 *
 * The field is drawn on a bounded square of the plane, and the disk is dragged
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
  const meterFill = root.querySelector("#pompeiuMeterFill");
  const buttons = [...root.querySelectorAll(".pompeiu-choice")];
  const context = canvas && canvas.getContext("2d");
  if (!context) return;

  // Radii: well inside the first zero of J_1, exactly at it, and halfway to the
  // second. The amplitudes are 2*pi*r*J_1(r), computed once.
  const DISKS = [
    { key: "small", radius: 1.2, amplitude: 3.757011 },
    { key: "zero", radius: 3.8317059702, amplitude: 0 },
    { key: "large", radius: 5.4236463200, amplitude: -11.747124 },
  ];
  const METER_MAX = 11.747124;
  const VIEW = 11.5;                     // the square is [-VIEW, VIEW]^2
  const TICKS = 3;                       // labelled multiples of pi either side

  const state = { disk: DISKS[1], centre: { x: 0, y: 0 }, dragging: false };

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

  let field = null, size = 0, dpr = 1;

  const toCanvas = (value) => (value + VIEW) / (2 * VIEW) * size;
  const toPlaneX = (px) => px / size * (2 * VIEW) - VIEW;
  const toPlaneY = (py) => VIEW - py / size * (2 * VIEW);

  function buildField() {
    const image = context.createImageData(size, size);
    const data = image.data;
    // cos(x1) depends on the column only, so one ramp lookup per column.
    const column = new Uint8ClampedArray(size * 3);
    for (let px = 0; px < size; px++) {
      const rgb = ramp(Math.cos(toPlaneX(px + .5)));
      column[px * 3] = rgb[0]; column[px * 3 + 1] = rgb[1]; column[px * 3 + 2] = rgb[2];
    }
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const i = (py * size + px) * 4;
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
    const side = Math.min(rect.width, rect.height) || rect.width;
    if (!side) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const next = Math.max(80, Math.round(side * dpr));
    if (next === size && field) { draw(); return; }
    size = next;
    canvas.width = size;
    canvas.height = size;
    buildField();
    draw();
  }

  function clampCentre() {
    const r = state.disk.radius;
    const limit = VIEW - r;
    state.centre.x = Math.max(-limit, Math.min(limit, state.centre.x));
    state.centre.y = Math.max(-limit, Math.min(limit, state.centre.y));
  }

  function draw() {
    if (!field) return;
    context.putImageData(field, 0, 0);

    const cx = toCanvas(state.centre.x);
    const cy = size - toCanvas(state.centre.y);
    const cr = state.disk.radius / (2 * VIEW) * size;

    // Wash everything outside the disk so the region being integrated reads first.
    context.save();
    context.beginPath();
    context.rect(0, 0, size, size);
    context.arc(cx, cy, cr, 0, Math.PI * 2, true);
    context.fillStyle = "rgba(241,238,229,.58)";
    context.fill("evenodd");
    context.restore();

    // Ticks at multiples of pi along the bottom, so the wavelength is visible.
    context.save();
    context.strokeStyle = "rgba(19,33,38,.32)";
    context.fillStyle = "rgba(19,33,38,.5)";
    context.lineWidth = Math.max(1, dpr);
    context.font = `${10.5 * dpr}px "DM Mono", ui-monospace, monospace`;
    context.textAlign = "center";
    for (let k = -TICKS; k <= TICKS; k++) {
      const px = toCanvas(k * Math.PI);
      context.beginPath();
      context.moveTo(px, size);
      context.lineTo(px, size - 8 * dpr);
      context.stroke();
      const label = k === 0 ? "0" : (k === 1 ? "π" : k === -1 ? "−π" : `${k}π`);
      context.fillText(label, px, size - 13 * dpr);
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

    const value = state.disk.amplitude * Math.cos(state.centre.x);
    const shown = Math.abs(value) < 5e-4 ? 0 : value;
    valueOut.textContent = shown.toFixed(3);
    const fraction = Math.min(1, Math.abs(value) / METER_MAX);
    meterFill.style.width = `${(fraction * 50).toFixed(2)}%`;
    meterFill.style.left = value >= 0 ? "50%" : `${(50 - fraction * 50).toFixed(2)}%`;
    meterFill.style.background = Math.abs(value) < 5e-4 ? "var(--teal)" : (value > 0 ? "#a62b49" : "#2a747d");
    canvas.setAttribute("aria-label",
      `Disk of radius ${state.disk.radius.toFixed(3)} centred at (${state.centre.x.toFixed(2)}, ${state.centre.y.toFixed(2)}); the integral of cosine of x one over it is ${shown.toFixed(3)}`);
  }

  function selectDisk(key) {
    const next = DISKS.find((d) => d.key === key);
    if (!next) return;
    state.disk = next;
    clampCentre();
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.disk === key)));
    draw();
  }

  function pointerTo(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    state.centre.x = toPlaneX((event.clientX - rect.left) / rect.width * size);
    state.centre.y = toPlaneY((event.clientY - rect.top) / rect.height * size);
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

  buttons.forEach((button) => {
    button.addEventListener("click", () => selectDisk(button.dataset.disk));
  });

  selectDisk("zero");
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  resize();
})();
