const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (selector) => document.querySelector(selector);

const state = {
  lambda: 2.4,
  s: 0,
  phase: 0,
  maxMode: 10,
  view: "flat",
  solution: null,
  updateFrame: null,
  playing: false,
  playFrame: null,
  lastPlaySolve: 0,
};

const X_MIN = -5;
const X_MAX = 1.05;
const TWO_PI = Math.PI * 2;
const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

const threeState = {
  library: null,
  loading: null,
  renderer: null,
  scene: null,
  camera: null,
  group: null,
  pointer: null,
};

function boundary(theta, parameters = state) {
  return parameters.s * Math.cos(theta - parameters.phase);
}

function boundaryDerivative(theta, parameters = state) {
  return -parameters.s * Math.sin(theta - parameters.phase);
}

function radialJet(x, mode, parameters) {
  const { lambda } = parameters;
  if (mode.radial === "decay") {
    const decay = Math.sqrt(mode.k * mode.k - lambda);
    const value = Math.exp(decay * (x - Math.abs(parameters.s)));
    return { value, derivative: decay * value };
  }
  const frequency = mode.k === 0 ? Math.sqrt(lambda) : Math.sqrt(lambda - 1);
  if (mode.radial === "cos") {
    return { value: Math.cos(frequency * x), derivative: -frequency * Math.sin(frequency * x) };
  }
  if (frequency < 1e-8) return { value: x, derivative: 1 };
  return { value: Math.sin(frequency * x) / frequency, derivative: Math.cos(frequency * x) };
}

function angularJet(theta, mode) {
  if (mode.k === 0) return { value: 1, derivative: 0 };
  const angle = mode.k * theta;
  if (mode.trig === "cos") return { value: Math.cos(angle), derivative: -mode.k * Math.sin(angle) };
  return { value: Math.sin(angle), derivative: mode.k * Math.cos(angle) };
}

function basisJet(x, theta, parameters, mode) {
  const radial = radialJet(x, mode, parameters);
  const angular = angularJet(theta, mode);
  return {
    value: radial.value * angular.value,
    dx: radial.derivative * angular.value,
    dtheta: radial.value * angular.derivative,
  };
}

function solveLeastSquares(inputRows, inputTargets, ridge = 1e-12) {
  const columnCount = inputRows[0].length;
  const columnScales = Array(columnCount).fill(0);
  inputRows.forEach((row) => row.forEach((value, column) => { columnScales[column] += value * value; }));
  for (let column = 0; column < columnCount; column++) {
    columnScales[column] = Math.sqrt(columnScales[column]);
    if (columnScales[column] < 1e-14) columnScales[column] = 1;
  }

  const rows = inputRows.map((row) => row.map((value, column) => value / columnScales[column]));
  const targets = [...inputTargets];
  const ridgeScale = Math.sqrt(ridge);
  for (let column = 0; column < columnCount; column++) {
    const row = Array(columnCount).fill(0);
    row[column] = ridgeScale;
    rows.push(row);
    targets.push(0);
  }

  const rowCount = rows.length;
  for (let column = 0; column < columnCount; column++) {
    let norm = 0;
    for (let row = column; row < rowCount; row++) norm = Math.hypot(norm, rows[row][column]);
    if (norm < 1e-14) continue;
    const alpha = rows[column][column] >= 0 ? -norm : norm;
    const reflector = [];
    let reflectorNormSquared = 0;
    for (let row = column; row < rowCount; row++) {
      const value = row === column ? rows[row][column] - alpha : rows[row][column];
      reflector.push(value);
      reflectorNormSquared += value * value;
    }
    if (reflectorNormSquared < 1e-28) continue;
    const beta = 2 / reflectorNormSquared;
    for (let targetColumn = column; targetColumn < columnCount; targetColumn++) {
      let projection = 0;
      for (let row = column; row < rowCount; row++) projection += reflector[row - column] * rows[row][targetColumn];
      projection *= beta;
      for (let row = column; row < rowCount; row++) rows[row][targetColumn] -= projection * reflector[row - column];
    }
    let targetProjection = 0;
    for (let row = column; row < rowCount; row++) targetProjection += reflector[row - column] * targets[row];
    targetProjection *= beta;
    for (let row = column; row < rowCount; row++) targets[row] -= targetProjection * reflector[row - column];
    rows[column][column] = alpha;
    for (let row = column + 1; row < rowCount; row++) rows[row][column] = 0;
  }

  const scaledSolution = Array(columnCount).fill(0);
  for (let row = columnCount - 1; row >= 0; row--) {
    let value = targets[row];
    for (let column = row + 1; column < columnCount; column++) value -= rows[row][column] * scaledSolution[column];
    scaledSolution[row] = Math.abs(rows[row][row]) < 1e-13 ? 0 : value / rows[row][row];
  }
  return scaledSolution.map((value, column) => value / columnScales[column]);
}

function modalList(maxMode) {
  const modes = [
    { k: 0, trig: "const", radial: "cos" },
    { k: 0, trig: "const", radial: "sin" },
  ];
  for (const trig of ["cos", "sin"]) {
    modes.push({ k: 1, trig, radial: "cos" }, { k: 1, trig, radial: "sin" });
  }
  for (let k = 2; k <= maxMode; k++) {
    modes.push({ k, trig: "cos", radial: "decay" }, { k, trig: "sin", radial: "decay" });
  }
  return modes;
}

function solveModalField(parameters) {
  const modes = modalList(parameters.maxMode);
  const trainingCount = Math.max(256, 24 * (parameters.maxMode + 1));
  const rows = [];
  const targets = [];

  for (let angularIndex = 0; angularIndex < trainingCount; angularIndex++) {
    const theta = -Math.PI + (angularIndex + 0.5) * TWO_PI / trainingCount;
    const x = boundary(theta, parameters);
    const slope = boundaryDerivative(theta, parameters);
    const normalScale = Math.sqrt(1 + slope * slope);
    const jets = modes.map((mode) => basisJet(x, theta, parameters, mode));
    rows.push(jets.map((jet) => jet.value));
    targets.push(1);
    rows.push(jets.map((jet) => (jet.dx - slope * jet.dtheta) / normalScale));
    targets.push(0);
  }
  const coefficients = solveLeastSquares(rows, targets);

  const solution = {
    parameters: { ...parameters },
    modes,
    coefficients,
    interiorResidual: 0,
    dirichletL2: 0,
    neumannL2: 0,
    boundaryCombined: 0,
    boundaryMax: 0,
  };
  const validationCount = Math.max(512, 32 * (parameters.maxMode + 1));
  let dirichletSquared = 0;
  let neumannSquared = 0;
  for (let i = 0; i < validationCount; i++) {
    const theta = -Math.PI + (i + 0.173) * TWO_PI / validationCount;
    const x = boundary(theta, parameters);
    const slope = boundaryDerivative(theta, parameters);
    const jet = fieldJet(x, theta, solution);
    const dirichlet = jet.value - 1;
    const neumann = (jet.dx - slope * jet.dtheta) / Math.sqrt(1 + slope * slope);
    dirichletSquared += dirichlet * dirichlet;
    neumannSquared += neumann * neumann;
    solution.boundaryMax = Math.max(solution.boundaryMax, Math.abs(dirichlet), Math.abs(neumann));
  }
  solution.dirichletL2 = Math.sqrt(dirichletSquared / validationCount);
  solution.neumannL2 = Math.sqrt(neumannSquared / validationCount);
  solution.boundaryCombined = Math.sqrt((dirichletSquared + neumannSquared) / (2 * validationCount));
  return solution;
}

function fieldJet(x, theta, solution = state.solution) {
  const result = { value: 0, dx: 0, dtheta: 0 };
  if (!solution) return result;
  for (let i = 0; i < solution.modes.length; i++) {
    const jet = basisJet(x, theta, solution.parameters, solution.modes[i]);
    const coefficient = solution.coefficients[i];
    result.value += coefficient * jet.value;
    result.dx += coefficient * jet.dx;
    result.dtheta += coefficient * jet.dtheta;
  }
  return result;
}

function fieldValue(x, theta, solution = state.solution) {
  return fieldJet(x, theta, solution).value;
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

function buildCylinderMeshData(solution, axialSegments = 96, angularSegments = 96) {
  const positions = [];
  const colors = [];
  const indices = [];
  const rim = [];
  const referenceRim = [];
  const radius = 1.22;

  for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex++) {
    const theta = -Math.PI + angularIndex / angularSegments * TWO_PI;
    const wall = boundary(theta, solution.parameters);
    const cosine = Math.cos(theta);
    const sine = Math.sin(theta);
    for (let axialIndex = 0; axialIndex <= axialSegments; axialIndex++) {
      const fraction = axialIndex / axialSegments;
      const x = X_MIN + fraction * (wall - X_MIN);
      positions.push(x, radius * cosine, radius * sine);
      const color = colorFor(fieldValue(x, theta, solution));
      colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
    }
    rim.push(wall, radius * cosine, radius * sine);
    referenceRim.push(0, radius * cosine, radius * sine);
  }

  const rowLength = axialSegments + 1;
  for (let angularIndex = 0; angularIndex < angularSegments; angularIndex++) {
    for (let axialIndex = 0; axialIndex < axialSegments; axialIndex++) {
      const a = angularIndex * rowLength + axialIndex;
      const b = a + 1;
      const c = a + rowLength;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const latitudeLoops = [.2, .4, .6, .8].map((fraction) => {
    const points = [];
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex++) {
      const theta = -Math.PI + angularIndex / angularSegments * TWO_PI;
      const wall = boundary(theta, solution.parameters);
      const x = X_MIN + fraction * (wall - X_MIN);
      points.push(x, radius * Math.cos(theta), radius * Math.sin(theta));
    }
    return points;
  });

  const longitudeLines = Array.from({ length: 8 }, (_, lineIndex) => {
    const theta = -Math.PI + lineIndex / 8 * TWO_PI;
    const wall = boundary(theta, solution.parameters);
    const points = [];
    for (let axialIndex = 0; axialIndex <= 48; axialIndex++) {
      const x = X_MIN + axialIndex / 48 * (wall - X_MIN);
      points.push(x, radius * Math.cos(theta), radius * Math.sin(theta));
    }
    return points;
  });

  return { positions, colors, indices, rim, referenceRim, latitudeLoops, longitudeLines };
}

function disposeThreeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function threeLine(THREE, points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function resizeThreeRenderer() {
  if (!threeState.renderer || !threeState.camera) return;
  const wrap = $("#threeWrap");
  const width = Math.max(320, wrap.clientWidth || 900);
  const height = Math.max(320, wrap.clientHeight || 580);
  threeState.renderer.setSize(width, height, false);
  threeState.camera.aspect = width / height;
  threeState.camera.updateProjectionMatrix();
}

function renderThreeFrame() {
  if (threeState.renderer && threeState.scene && threeState.camera) {
    threeState.renderer.render(threeState.scene, threeState.camera);
  }
}

function installThreeInteraction(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    threeState.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!threeState.pointer || threeState.pointer.id !== event.pointerId || !threeState.group) return;
    const dx = event.clientX - threeState.pointer.x;
    const dy = event.clientY - threeState.pointer.y;
    threeState.group.rotation.y += dx * .006;
    threeState.group.rotation.x += dy * .006;
    threeState.pointer.x = event.clientX;
    threeState.pointer.y = event.clientY;
    renderThreeFrame();
  });
  const release = (event) => {
    if (threeState.pointer?.id === event.pointerId) threeState.pointer = null;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.08 : .92;
    const length = Math.max(6.2, Math.min(15, threeState.camera.position.length() * factor));
    threeState.camera.position.setLength(length);
    renderThreeFrame();
  }, { passive: false });
}

function setupThreeRenderer() {
  if (threeState.renderer) return;
  const THREE = threeState.library;
  const wrap = $("#threeWrap");
  threeState.scene = new THREE.Scene();
  threeState.scene.background = new THREE.Color(0x101b20);
  threeState.camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  threeState.camera.position.set(7.3, 4.2, 6.6);
  threeState.camera.lookAt(0, 0, 0);
  threeState.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.insertBefore(threeState.renderer.domElement, $("#threeLoading"));
  threeState.group = new THREE.Group();
  threeState.group.position.x = 2.1;
  threeState.group.rotation.x = -.18;
  threeState.group.rotation.y = -.16;
  threeState.scene.add(threeState.group);
  resizeThreeRenderer();
  installThreeInteraction(threeState.renderer.domElement);
}

function updateThreeMesh() {
  if (!threeState.library || !threeState.group || !state.solution) return;
  const THREE = threeState.library;
  while (threeState.group.children.length) {
    const child = threeState.group.children[0];
    threeState.group.remove(child);
    disposeThreeObject(child);
  }
  const data = buildCylinderMeshData(state.solution);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  threeState.group.add(new THREE.Mesh(geometry, material));
  data.latitudeLoops.forEach((points) => threeState.group.add(threeLine(THREE, points, 0xf1eee5, .16)));
  data.longitudeLines.forEach((points) => threeState.group.add(threeLine(THREE, points, 0xf1eee5, .12)));
  threeState.group.add(threeLine(THREE, data.referenceRim, 0x7f9293, .48));
  const rim = threeLine(THREE, data.rim, 0xfff4dc, 1);
  rim.material.linewidth = 2;
  threeState.group.add(rim);
  $("#threeLoading").hidden = true;
  renderThreeFrame();
}

async function ensureThreeRenderer() {
  if (threeState.library) return threeState.library;
  if (!threeState.loading) {
    threeState.loading = import(THREE_MODULE_URL).then((library) => {
      threeState.library = library;
      setupThreeRenderer();
      return library;
    });
  }
  return threeState.loading;
}

async function renderCylinder() {
  $("#threeLoading").hidden = false;
  try {
    await ensureThreeRenderer();
    resizeThreeRenderer();
    updateThreeMesh();
  } catch (error) {
    $("#threeLoading").textContent = "3D renderer could not be loaded";
    console.error(error);
  }
}

function renderActiveView() {
  if (state.view === "cylinder") renderCylinder();
  else renderHeatmap();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-button").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#fieldCanvas").hidden = view !== "flat";
  $("#threeWrap").hidden = view !== "cylinder";
  $("#axisDescription").textContent = view === "cylinder" ? "cylindrical surface (x, cos θ, sin θ)" : "unwrapped coordinates (x, θ)";
  renderActiveView();
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
  for (let k = 0; k <= state.solution.parameters.maxMode; k++) {
    const magnitude = Math.hypot(...state.solution.modes.map((mode, index) => mode.k === k ? state.solution.coefficients[index] : 0));
    grouped.push({ k, magnitude });
  }
  const maximum = Math.max(1e-6, ...grouped.map((item) => item.magnitude));
  grouped.forEach(({ k, magnitude }) => {
    const row = document.createElement("div");
    row.className = "mode-bar";
    const label = document.createElement("span");
    label.textContent = k === 0 ? "k 0 · base" : (k === 1 ? "k 1 · crit" : `k ${k}`);
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
  $("#interiorValue").textContent = "0 · analytic";
  $("#dirichletValue").textContent = state.solution.dirichletL2.toExponential(2);
  $("#neumannValue").textContent = state.solution.neumannL2.toExponential(2);
  $("#decayValue").textContent = (1 / Math.sqrt(4 - state.lambda)).toFixed(2);
  $("#domainState").textContent = Math.abs(state.s) < .0025 ? "trivial cylinder · s = 0" : `moving boundary · s = ${state.s.toFixed(3)}`;
}

function solveAndRender() {
  const parameters = { lambda: state.lambda, s: state.s, phase: state.phase, maxMode: state.maxMode };
  state.solution = solveModalField(parameters);
  updateReadouts();
  renderActiveView();
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
document.querySelectorAll(".view-button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

$("#playButton").addEventListener("click", togglePlayback);
$("#resetButton").addEventListener("click", () => {
  stopPlayback();
  Object.assign(state, { lambda: 2.4, s: 0, phase: 0, maxMode: 10 });
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
  resizeTimer = setTimeout(() => { if (state.solution) renderActiveView(); }, 120);
});

solveAndRender();
