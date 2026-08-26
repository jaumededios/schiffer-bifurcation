/* Interactive figure for the introduction: the integral of cos(x1) over a disk.
 *
 * For a disk of radius r centred at t,
 *     int_{B_r(t)} cos(x_1) dx = 2 pi r J_1(r) cos(t_1),
 * so the value is fixed by the amplitude 2 pi r J_1(r) and the position of the
 * centre. The figure never says so; the reader moves the disk and reads it off.
 */
(() => {
  "use strict";

  const root = document.getElementById("pompeiuFigure");
  if (!root) return;

  const canvas = root.querySelector("#pompeiuCanvas");
  const valueOut = root.querySelector("#pompeiuValue");
  const meterFill = root.querySelector("#pompeiuMeterFill");
  const buttons = [...root.querySelectorAll(".pompeiu-choice")];
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  // Radii: well inside the first Bessel zero, exactly at it, and halfway to the
  // second. The amplitudes are 2*pi*r*J_1(r), computed once.
  const DISKS = [
    { key: "small", radius: 1.2, amplitude: 3.757011 },
    { key: "zero", radius: 3.8317059702, amplitude: 0 },
    { key: "large", radius: 5.4236463200, amplitude: -11.747124 },
  ];
  const METER_MAX = 11.747124;

  const VIEW_X = 15.4;                       // half-width of the plotted region
  const VIEW_Y = 7;                          // half-height
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
    let left = STOPS[0], right = STOPS.at(-1);
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i].t) { left = STOPS[i - 1]; right = STOPS[i]; break; }
    }
    const local = (t - left.t) / Math.max(1e-8, right.t - left.t);
    return left.rgb.map((c, i) => Math.round(c + (right.rgb[i] - c) * local));
  }

  let field = null, width = 0, height = 0, dpr = 1;

  const toCanvasX = (x) => (x + VIEW_X) / (2 * VIEW_X) * width;
  const toCanvasY = (y) => (VIEW_Y - y) / (2 * VIEW_Y) * height;
  const toPlaneX = (px) => px / width * (2 * VIEW_X) - VIEW_X;
  const toPlaneY = (py) => VIEW_Y - py / height * (2 * VIEW_Y);

  function buildField() {
    const image = context.createImageData(width, height);
    const data = image.data;
    // cos(x1) depends on the column only, so one ramp lookup per column.
    const column = new Uint8ClampedArray(width * 3);
    for (let px = 0; px < width; px++) {
      const [r, g, b] = ramp(Math.cos(toPlaneX(px + .5)));
      column[px * 3] = r; column[px * 3 + 1] = g; column[px * 3 + 2] = b;
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
    if (!rect.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.round(rect.width * dpr);
    height = Math.round(rect.height * dpr);
    canvas.width = width;
    canvas.height = height;
    buildField();
    draw();
  }

  function clampCentre() {
    const r = state.disk.radius;
    state.centre.x = Math.max(-VIEW_X + r, Math.min(VIEW_X - r, state.centre.x));
    state.centre.y = Math.max(-VIEW_Y + r, Math.min(VIEW_Y - r, state.centre.y));
  }

  function integralValue() {
    return state.disk.amplitude * Math.cos(state.centre.x);
  }

  function draw() {
    if (!field) return;
    context.putImageData(field, 0, 0);

    const cx = toCanvasX(state.centre.x);
    const cy = toCanvasY(state.centre.y);
    const pixelsPerUnit = width / (2 * VIEW_X);
    const cr = state.disk.radius * pixelsPerUnit;

    // Wash everything outside the disk so the region being integrated reads first.
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.arc(cx, cy, cr, 0, Math.PI * 2, true);
    context.fillStyle = "rgba(241,238,229,.62)";
    context.fill("evenodd");
    context.restore();

    // Ticks at multiples of pi along the bottom, so the wavelength is visible.
    context.save();
    context.strokeStyle = "rgba(19,33,38,.30)";
    context.fillStyle = "rgba(19,33,38,.45)";
    context.lineWidth = Math.max(1, dpr);
    context.font = `${11 * dpr}px "DM Mono", monospace`;
    context.textAlign = "center";
    for (let k = -4; k <= 4; k++) {
      const x = k * Math.PI;
      if (Math.abs(x) > VIEW_X - .4) continue;
      const px = toCanvasX(x);
      context.beginPath();
      context.moveTo(px, height);
      context.lineTo(px, height - 9 * dpr);
      context.stroke();
      const label = k === 0 ? "0" : (k === 1 ? "π" : (k === -1 ? "−π" : `${k}π`));
      context.fillText(label, px, height - 14 * dpr);
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
    context.arc(cx, cy, 3.5 * dpr, 0, Math.PI * 2);
    context.fillStyle = "#132126";
    context.fill();
    context.restore();

    const value = integralValue();
    const shown = Math.abs(value) < 5e-4 ? 0 : value;
    valueOut.textContent = shown.toFixed(3);
    const fraction = Math.min(1, Math.abs(value) / METER_MAX);
    meterFill.style.width = `${(fraction * 50).toFixed(2)}%`;
    meterFill.style.left = value >= 0 ? "50%" : `${(50 - fraction * 50).toFixed(2)}%`;
    meterFill.style.background = Math.abs(value) < 5e-4
      ? "var(--teal)"
      : (value > 0 ? "#a62b49" : "#2a747d");
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
    state.centre.x = toPlaneX((event.clientX - rect.left) * (width / rect.width));
    state.centre.y = toPlaneY((event.clientY - rect.top) * (height / rect.height));
    clampCentre();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    canvas.setPointerCapture(event.pointerId);
    pointerTo(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => { if (state.dragging) pointerTo(event); });
  const release = (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
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

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  selectDisk("zero");
  resize();
})();
