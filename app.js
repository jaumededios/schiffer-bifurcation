const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (selector) => document.querySelector(selector);
const setMath = (elementOrSelector, source, options) => window.SchifferMath?.render(elementOrSelector, source, options);

/* Every renderer reads the same visual theme.  The content markup selects the
   edition once, on <body>; individual applets do not choose their own panel
   colour, border colour, or annotation contrast. */
const SCHIFFER_VISUAL_THEME = (() => {
  const paperEdition = document.body.classList.contains("tufte-site");
  const rootStyle = getComputedStyle(document.documentElement);
  const rootSize = parseFloat(rootStyle.fontSize) || 16;
  const tokenPixels = (name, fallback) => {
    const value = parseFloat(rootStyle.getPropertyValue(name));
    return Number.isFinite(value) ? value * rootSize : fallback;
  };
  const monoFamily = rootStyle.getPropertyValue("--mono").trim() || "DM Mono, monospace";
  const serifFamily = rootStyle.getPropertyValue("--serif").trim() || "Georgia, serif";
  const typography = {
    labelFont: `${tokenPixels("--type-label", 11)}px ${monoFamily}`,
    captionFont: `${tokenPixels("--type-caption", 16)}px ${serifFamily}`,
    titleFont: `italic 400 ${tokenPixels("--type-subsection", 25)}px ${serifFamily}`,
    labelPixels: tokenPixels("--type-label", 11),
    serifFamily,
  };
  const theme = paperEdition ? {
    paperEdition: true,
    background: "#fffff8",
    backgroundAlt: "#f4f1e8",
    backgroundRgb: [255, 255, 248],
    backgroundAltRgb: [244, 241, 232],
    ink: "#111111",
    inkHex: 0x111111,
    backgroundHex: 0xfffff8,
    line: "rgba(17,17,17,.14)",
    lineStrong: "rgba(17,17,17,.34)",
    muted: "rgba(17,17,17,.55)",
    faint: "rgba(17,17,17,.34)",
    panel: "rgba(255,255,248,0)",
    tooltip: "rgba(255,255,248,.96)",
    ...typography,
  } : {
    paperEdition: false,
    background: "#101b20",
    backgroundAlt: "#17282e",
    backgroundRgb: [12, 22, 27],
    backgroundAltRgb: [15, 27, 32],
    ink: "#fff4dc",
    inkHex: 0xfff4dc,
    backgroundHex: 0x101b20,
    line: "rgba(241,238,229,.12)",
    lineStrong: "rgba(241,238,229,.28)",
    muted: "rgba(241,238,229,.55)",
    faint: "rgba(241,238,229,.34)",
    panel: "rgba(12,22,27,.65)",
    tooltip: "rgba(10,19,23,.96)",
    ...typography,
  };
  window.SCHIFFER_VISUAL_THEME = Object.freeze(theme);
  return window.SCHIFFER_VISUAL_THEME;
})();

function setCanvasFormula(wrapSelector, id, source, position = {}) {
  const wrap = $(wrapSelector);
  if (!wrap) return null;
  let label = document.getElementById(id);
  if (!label) {
    label = document.createElement("span");
    label.id = id;
    label.className = "canvas-tex-label";
    label.setAttribute("aria-hidden", "true");
    wrap.appendChild(label);
  }
  if (label.dataset.tex !== source) {
    label.dataset.tex = source;
    setMath(label, source, { serif: true });
  }
  ["left", "right", "top", "bottom"].forEach((property) => {
    label.style[property] = position[property] === undefined ? "" : `${position[property]}px`;
  });
  label.style.textAlign = position.textAlign || "left";
  label.style.color = position.color || "";
  label.style.transform = position.transform || "";
  return label;
}

function removeCanvasFormula(id) {
  document.getElementById(id)?.remove();
}

const state = {
  lambda: 2.4,
  s: 0,
  phase: 0,
  maxMode: 10,
  view: typeof WebGLRenderingContext === "undefined" ? "flat" : "cylinder",
  solution: null,
  updateFrame: null,
  playing: false,
  playFrame: null,
  lastPlaySolve: 0,
};

const X_MIN = -5;
const X_MAX = 1.05;
const THREE_X_MIN = -16;
const THREE_CAMERA_FIT_ASPECT = 1.5;
const THREE_RIM_WORLD_X = 8;
const THREE_CAMERA_TARGET_X = THREE_RIM_WORLD_X - 1;
const THREE_CAMERA_OFFSET = { x: 5.9, y: 3.9, z: 12.4 };
const THREE_ZOOM_MIN = .62;
const THREE_ZOOM_MAX = 1.55;
const TWO_PI = Math.PI * 2;
const CYLINDER_WALL_MODES = [2, 3];
const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

const threeState = {
  library: null,
  loading: null,
  renderer: null,
  scene: null,
  camera: null,
  group: null,
  pointer: null,
  zoom: THREE_ZOOM_MIN,
};

function boundary(theta, parameters = state) {
  const shifted = theta - parameters.phase;
  let value = parameters.s * Math.cos(shifted);
  CYLINDER_WALL_MODES.forEach((mode) => {
    value += (parameters.wallCoefficients?.[mode] || 0) * Math.cos(mode * shifted);
  });
  return value;
}

function boundaryDerivative(theta, parameters = state) {
  const shifted = theta - parameters.phase;
  let value = -parameters.s * Math.sin(shifted);
  CYLINDER_WALL_MODES.forEach((mode) => {
    value -= mode * (parameters.wallCoefficients?.[mode] || 0) * Math.sin(mode * shifted);
  });
  return value;
}

function parametersWithWall(parameters, higherCoefficients = [0, 0]) {
  const wallCoefficients = [0, parameters.s, ...higherCoefficients];
  return {
    ...parameters,
    wallCoefficients,
    // This is only a column rescaling of the decaying basis. Keep it fixed
    // while h2 and h3 move so the nonlinear Jacobian differentiates the
    // This scaling retains the physical boundary dependence.
    radialShift: Math.abs(parameters.s) + .9,
  };
}

function radialJet(x, mode, parameters) {
  const { lambda } = parameters;
  if (mode.radial === "decay") {
    const decay = Math.sqrt(mode.k * mode.k - lambda);
    const value = Math.exp(decay * (x - (parameters.radialShift ?? Math.abs(parameters.s))));
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
  const value = radial.value * angular.value;
  return {
    value,
    dx: radial.derivative * angular.value,
    dtheta: radial.value * angular.derivative,
    dxx: (mode.k * mode.k - parameters.lambda) * value,
    dxtheta: radial.derivative * angular.derivative,
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

function fitFieldAtWall(parameters, modes, trainingCount) {
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
  return { parameters, modes, coefficients };
}

function boundaryResidualVector(solution, count, offset) {
  const residuals = [];
  for (let index = 0; index < count; index++) {
    const theta = -Math.PI + (index + offset) * TWO_PI / count;
    const x = boundary(theta, solution.parameters);
    const slope = boundaryDerivative(theta, solution.parameters);
    const jet = fieldJet(x, theta, solution);
    residuals.push(jet.value - 1);
    residuals.push((jet.dx - slope * jet.dtheta) / Math.sqrt(1 + slope * slope));
  }
  return residuals;
}

function residualMeanSquare(solution, count, offset = .5) {
  const residuals = boundaryResidualVector(solution, count, offset);
  return residuals.reduce((sum, value) => sum + value * value, 0) / residuals.length;
}

function cylinderGaussNewtonSystem(solution, count) {
  const rows = [];
  const targets = [];
  const fieldColumnCount = solution.modes.length;
  for (let index = 0; index < count; index++) {
    const theta = -Math.PI + (index + .5) * TWO_PI / count;
    const shifted = theta - solution.parameters.phase;
    const x = boundary(theta, solution.parameters);
    const slope = boundaryDerivative(theta, solution.parameters);
    const normalScale = Math.sqrt(1 + slope * slope);
    const jets = solution.modes.map((mode) => basisJet(x, theta, solution.parameters, mode));
    const field = { value: 0, dx: 0, dtheta: 0, dxx: 0, dxtheta: 0 };
    jets.forEach((jet, modeIndex) => {
      const coefficient = solution.coefficients[modeIndex];
      field.value += coefficient * jet.value;
      field.dx += coefficient * jet.dx;
      field.dtheta += coefficient * jet.dtheta;
      field.dxx += coefficient * jet.dxx;
      field.dxtheta += coefficient * jet.dxtheta;
    });

    const dirichlet = field.value - 1;
    const dirichletRow = jets.map((jet) => jet.value);
    CYLINDER_WALL_MODES.forEach((mode) => {
      dirichletRow.push(field.dx * Math.cos(mode * shifted));
    });
    rows.push(dirichletRow);
    targets.push(-dirichlet);

    const normalNumerator = field.dx - slope * field.dtheta;
    const neumann = normalNumerator / normalScale;
    const neumannRow = jets.map((jet) => (jet.dx - slope * jet.dtheta) / normalScale);
    CYLINDER_WALL_MODES.forEach((mode) => {
      const wallValueDerivative = Math.cos(mode * shifted);
      const wallSlopeDerivative = -mode * Math.sin(mode * shifted);
      const numeratorDerivative = (field.dxx - slope * field.dxtheta) * wallValueDerivative
        - wallSlopeDerivative * field.dtheta;
      neumannRow.push(numeratorDerivative / normalScale
        - normalNumerator * slope * wallSlopeDerivative / (normalScale ** 3));
    });
    rows.push(neumannRow);
    targets.push(-neumann);
  }
  return { rows, targets, fieldColumnCount };
}

function cylinderStep(solution, delta, amount, fieldColumnCount) {
  const coefficients = solution.coefficients.map((value, index) => value + amount * delta[index]);
  const wallCoefficients = [...solution.parameters.wallCoefficients];
  CYLINDER_WALL_MODES.forEach((mode, index) => {
    wallCoefficients[mode] += amount * delta[fieldColumnCount + index];
  });
  const parameters = {
    ...solution.parameters,
    wallCoefficients,
  };
  return { parameters, modes: solution.modes, coefficients };
}

function solveModalField(parameters) {
  const modes = modalList(parameters.maxMode);
  const trainingCount = Math.max(256, 24 * (parameters.maxMode + 1));
  let solution = fitFieldAtWall(parametersWithWall(parameters), modes, trainingCount);
  let trainingLoss = residualMeanSquare(solution, trainingCount);
  let wallIterations = 0;

  if (Math.abs(parameters.s) > 1e-8) {
    for (let iteration = 0; iteration < 7; iteration++) {
      const system = cylinderGaussNewtonSystem(solution, trainingCount);
      const delta = solveLeastSquares(system.rows, system.targets, 2e-10);
      if (delta.some((value) => !Number.isFinite(value))) break;

      const wallStepLimit = Math.max(.015, .32 * Math.abs(parameters.s));
      CYLINDER_WALL_MODES.forEach((mode, index) => {
        const column = system.fieldColumnCount + index;
        delta[column] = Math.max(-wallStepLimit, Math.min(wallStepLimit, delta[column]));
      });

      let accepted = null;
      let acceptedLoss = trainingLoss;
      for (const amount of [1, .5, .25, .125, .0625]) {
        const candidate = cylinderStep(solution, delta, amount, system.fieldColumnCount);
        const higherWallIsSafe = CYLINDER_WALL_MODES.every((mode) => Math.abs(candidate.parameters.wallCoefficients[mode]) <= .45);
        if (!higherWallIsSafe) continue;
        const candidateLoss = residualMeanSquare(candidate, trainingCount);
        if (candidateLoss < acceptedLoss * (1 - 1e-9)) {
          accepted = candidate;
          acceptedLoss = candidateLoss;
          break;
        }
      }
      if (!accepted) break;
      solution = accepted;
      trainingLoss = acceptedLoss;
      wallIterations = iteration + 1;
      if (trainingLoss < 1e-24) break;
    }
  }

  // At the fixed nonlinear boundary iterate, finish with the exact linear
  // least-squares minimizer in the separated field coefficients.
  solution = fitFieldAtWall(solution.parameters, modes, trainingCount);

  Object.assign(solution, {
    interiorResidual: 0,
    dirichletL2: 0,
    neumannL2: 0,
    boundaryCombined: 0,
    boundaryMax: 0,
    wallIterations,
    trainingCombined: Math.sqrt(residualMeanSquare(solution, trainingCount)),
  });
  const validationCount = Math.max(512, 32 * (parameters.maxMode + 1));
  let dirichletSquared = 0;
  let neumannSquared = 0;
  for (let i = 0; i < validationCount; i++) {
    const theta = -Math.PI + (i + 0.173) * TWO_PI / validationCount;
    const x = boundary(theta, solution.parameters);
    const slope = boundaryDerivative(theta, solution.parameters);
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
  const result = { value: 0, dx: 0, dtheta: 0, dxx: 0, dxtheta: 0 };
  if (!solution) return result;
  for (let i = 0; i < solution.modes.length; i++) {
    const jet = basisJet(x, theta, solution.parameters, solution.modes[i]);
    const coefficient = solution.coefficients[i];
    result.value += coefficient * jet.value;
    result.dx += coefficient * jet.dx;
    result.dtheta += coefficient * jet.dtheta;
    result.dxx += coefficient * jet.dxx;
    result.dxtheta += coefficient * jet.dxtheta;
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

function buildCylinderMeshData(solution, axialSegments = 160, angularSegments = 96) {
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
      const x = THREE_X_MIN + fraction * (wall - THREE_X_MIN);
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

  const latitudeLoops = Array.from({ length: 9 }, (_, index) => (index + 1) / 10).map((fraction) => {
    const points = [];
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex++) {
      const theta = -Math.PI + angularIndex / angularSegments * TWO_PI;
      const wall = boundary(theta, solution.parameters);
      const x = THREE_X_MIN + fraction * (wall - THREE_X_MIN);
      points.push(x, radius * Math.cos(theta), radius * Math.sin(theta));
    }
    return points;
  });

  const longitudeLines = Array.from({ length: 8 }, (_, lineIndex) => {
    const theta = -Math.PI + lineIndex / 8 * TWO_PI;
    const wall = boundary(theta, solution.parameters);
    const points = [];
    for (let axialIndex = 0; axialIndex <= 120; axialIndex++) {
      const x = THREE_X_MIN + axialIndex / 120 * (wall - THREE_X_MIN);
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
  const width = Math.max(1, wrap.clientWidth || 900);
  const height = Math.max(1, wrap.clientHeight || 580);
  threeState.renderer.setSize(width, height, false);
  threeState.camera.aspect = width / height;
  // Keep the cylinder's horizontal scale stable when the paper layout crops
  // the viewport vertically.  Fitting only portrait canvases made a shallower
  // landscape viewport shrink the model along with its empty background.
  const aspectFit = THREE_CAMERA_FIT_ASPECT / threeState.camera.aspect;
  const cameraScale = aspectFit * threeState.zoom;
  threeState.camera.position.set(
    THREE_CAMERA_TARGET_X + THREE_CAMERA_OFFSET.x * cameraScale,
    THREE_CAMERA_OFFSET.y * cameraScale,
    THREE_CAMERA_OFFSET.z * cameraScale,
  );
  threeState.camera.lookAt(THREE_CAMERA_TARGET_X, 0, 0);
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
    threeState.zoom = Math.max(THREE_ZOOM_MIN, Math.min(THREE_ZOOM_MAX, threeState.zoom * factor));
    resizeThreeRenderer();
    renderThreeFrame();
  }, { passive: false });
}

function setupThreeRenderer() {
  if (threeState.renderer) return;
  const THREE = threeState.library;
  const wrap = $("#threeWrap");
  threeState.scene = new THREE.Scene();
  threeState.scene.background = new THREE.Color(SCHIFFER_VISUAL_THEME.backgroundHex);
  threeState.camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  threeState.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.insertBefore(threeState.renderer.domElement, $("#threeLoading"));
  threeState.group = new THREE.Group();
  // Cylinder vertices use x=0 at the rim, so the group's local rotation
  // origin is the rim. The camera looks one unit into the collar.
  threeState.group.position.x = THREE_RIM_WORLD_X;
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
  data.latitudeLoops.forEach((points) => threeState.group.add(threeLine(THREE, points, SCHIFFER_VISUAL_THEME.inkHex, .16)));
  data.longitudeLines.forEach((points) => threeState.group.add(threeLine(THREE, points, SCHIFFER_VISUAL_THEME.inkHex, .12)));
  threeState.group.add(threeLine(THREE, data.referenceRim, 0x7f9293, .48));
  const rim = threeLine(THREE, data.rim, SCHIFFER_VISUAL_THEME.inkHex, 1);
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
  setMath("#axisDescription", view === "cylinder"
    ? "\\text{cylindrical surface }(x,\\cos\\theta,\\sin\\theta)"
    : "\\text{unwrapped coordinates }(x,\\theta)");
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
  const displayWidth = Math.max(1, wrap.clientWidth || 900);
  const displayHeight = Math.max(1, wrap.clientHeight || 580);
  const backingScale = Math.min(1, 820 / displayWidth, 570 / displayHeight);
  const width = Math.max(1, Math.round(displayWidth * backingScale));
  const height = Math.max(1, Math.round(displayHeight * backingScale));
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
        image.data[index] = SCHIFFER_VISUAL_THEME.backgroundRgb[0] - stripe;
        image.data[index + 1] = SCHIFFER_VISUAL_THEME.backgroundRgb[1] - stripe;
        image.data[index + 2] = SCHIFFER_VISUAL_THEME.backgroundRgb[2] - stripe;
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
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
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
  context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
  context.shadowColor = "rgba(255,116,73,.85)";
  context.shadowBlur = 8;
  context.lineWidth = 2.5;
  context.stroke();
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
  svgElement("rect", { x: 18, y: 15, width: 214, height: 158, fill: "none", stroke: SCHIFFER_VISUAL_THEME.line }, svg);
  for (let i = 0; i <= 4; i++) {
    const y = 15 + i * 158 / 4;
    svgElement("line", { x1: 18, y1: y, x2: 232, y2: y, stroke: SCHIFFER_VISUAL_THEME.line }, svg);
  }
  const centerX = 144;
  svgElement("line", { x1: centerX, y1: 15, x2: centerX, y2: 173, stroke: SCHIFFER_VISUAL_THEME.lineStrong, "stroke-dasharray": "3 5" }, svg);
  const solvedParameters = state.solution?.parameters || state;
  const criticalPoints = [];
  const points = [];
  for (let i = 0; i <= 120; i++) {
    const theta = Math.PI - i / 120 * TWO_PI;
    criticalPoints.push([centerX + state.s * 58 * Math.cos(theta - state.phase), 15 + i / 120 * 158]);
    points.push([centerX + boundary(theta, solvedParameters) * 58, 15 + i / 120 * 158]);
  }
  const criticalData = `M ${criticalPoints.map((point) => point.map((value) => value.toFixed(2)).join(" ")).join(" L ")}`;
  svgElement("path", { d: criticalData, fill: "none", stroke: "rgba(77,162,163,.58)", "stroke-width": "1.2", "stroke-dasharray": "4 4" }, svg);
  const data = `M ${points.map((point) => point.map((value) => value.toFixed(2)).join(" ")).join(" L ")}`;
  svgElement("path", { d: data, fill: "none", stroke: "#ff7449", "stroke-width": "3" }, svg);
  const label = svgElement("text", { x: 24, y: 186, fill: SCHIFFER_VISUAL_THEME.muted, "font-family": "DM Mono", "font-size": "8" }, svg);
  const h2 = solvedParameters.wallCoefficients?.[2] || 0;
  const h3 = solvedParameters.wallCoefficients?.[3] || 0;
  setMath(label, state.s === 0
    ? "\\Gamma_0\\quad\\text{flat boundary}"
    : `\\Gamma_s\\qquad h_2=${h2.toFixed(3)}\\qquad h_3=${h3.toFixed(3)}`);
  svg.setAttribute("aria-label", state.s === 0
    ? "Flat cylinder boundary"
    : `Computed boundary with first mode ${state.s.toFixed(3)}, second mode ${h2.toFixed(4)}, and third mode ${h3.toFixed(4)}. The dashed curve is the first-mode approximation.`);
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
    setMath(label, k === 0 ? "k=0\\;\\text{(base)}" : (k === 1 ? "k=1\\;\\text{(critical)}" : `k=${k}`));
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
  setMath("#phaseValue", `${(state.phase / Math.PI).toFixed(2)}\\pi`);
  setMath("#modeValue", `k\\le ${state.maxMode}`);
  $("#interiorValue").textContent = "0 · analytic";
  $("#wallMode2Value").textContent = state.solution.parameters.wallCoefficients[2].toExponential(2);
  $("#wallMode3Value").textContent = state.solution.parameters.wallCoefficients[3].toExponential(2);
  $("#dirichletValue").textContent = state.solution.dirichletL2.toExponential(2);
  $("#neumannValue").textContent = state.solution.neumannL2.toExponential(2);
  $("#decayValue").textContent = (1 / Math.sqrt(4 - state.lambda)).toFixed(2);
  $("#domainState").textContent = Math.abs(state.s) < .0025 ? "trivial cylinder at the branch origin" : "boundary and field solved simultaneously";
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
  $("#playLabel").textContent = "Animate";
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
document.querySelectorAll(".view-button[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

$("#playButton").addEventListener("click", togglePlayback);
$("#resetButton").addEventListener("click", () => {
  stopPlayback();
  Object.assign(state, { lambda: 2.4, s: 0, phase: 0, maxMode: 10 });
  const values = { lambdaRange: state.lambda, sRange: state.s, phaseRange: state.phase, modeRange: state.maxMode };
  Object.entries(values).forEach(([id, value]) => { const input = $(`#${id}`); input.value = value; setRangeFill(input); });
  scheduleUpdate();
});

$("#methodButton")?.addEventListener("click", () => $("#methodDialog").showModal());
$("#closeMethod").addEventListener("click", () => $("#methodDialog").close());
$("#methodDialog").addEventListener("click", (event) => { if (event.target === $("#methodDialog")) $("#methodDialog").close(); });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.solution) renderActiveView(); }, 120);
});

solveAndRender();
setView(state.view);

// ─────────────────────────────────────────────────────────────────────────────
// Finite-cone continuation. The nonlinear branch records and radial Bessel
// tables are generated offline; all interpolation, geometry, and rendering run
// locally in the browser.

const coneNumerics = window.CONE_NUMERICS;
const coneState = {
  progress: 0,
  depth: .08,
  view: "slice",
  solution: null,
  updateFrame: null,
  playing: false,
  playFrame: null,
};

const coneThreeState = {
  renderer: null,
  scene: null,
  camera: null,
  group: null,
  pointer: null,
  lastDepth: null,
};

function interpolateNumber(left, right, amount) {
  return left + (right - left) * amount;
}

function interpolateArray(left, right, amount) {
  return left.map((value, index) => interpolateNumber(value, right[index], amount));
}

function coneRecordAt(progress) {
  const targetS = Math.max(0, Math.min(1, progress)) * coneNumerics.landingS;
  const records = coneNumerics.records;
  if (targetS <= records[0].s) return { ...records[0], h: [...records[0].h], a: [...records[0].a] };
  if (targetS >= records.at(-1).s) return { ...records.at(-1), h: [...records.at(-1).h], a: [...records.at(-1).a] };
  let upperIndex = 1;
  while (records[upperIndex].s < targetS) upperIndex++;
  const left = records[upperIndex - 1];
  const right = records[upperIndex];
  const amount = (targetS - left.s) / (right.s - left.s);
  return {
    s: targetS,
    R: interpolateNumber(left.R, right.R, amount),
    lambda: interpolateNumber(left.lambda, right.lambda, amount),
    h: interpolateArray(left.h, right.h, amount),
    a: interpolateArray(left.a, right.a, amount),
    criticalProfile: interpolateArray(left.criticalProfile, right.criticalProfile, amount),
    criticalRim: interpolateNumber(left.criticalRim, right.criticalRim, amount),
    dirichlet_rms: interpolateNumber(left.dirichlet_rms, right.dirichlet_rms, amount),
    neumann_rms: interpolateNumber(left.neumann_rms, right.neumann_rms, amount),
    max_residual: interpolateNumber(left.max_residual, right.max_residual, amount),
  };
}

function coneBoundaryGraph(psi, solution = coneState.solution) {
  let value = 0;
  for (let k = 0; k < solution.h.length; k++) value += solution.h[k] * Math.cos(k * psi);
  return value;
}

function tableValue(grid, values, q) {
  if (q <= grid[0]) return values[0];
  if (q >= grid.at(-1)) return values.at(-1);
  const scaled = (q - grid[0]) / (grid.at(-1) - grid[0]) * (grid.length - 1);
  const index = Math.min(grid.length - 2, Math.max(0, Math.floor(scaled)));
  return interpolateNumber(values[index], values[index + 1], scaled - index);
}

function coneRadialValue(mode, q, solution = coneState.solution) {
  if (mode === 1 && solution.criticalProfile) {
    return tableValue(coneNumerics.profileGrid, solution.criticalProfile, q);
  }
  const orderAmount = Math.max(0, Math.min(1,
    (coneNumerics.RStar - solution.R) / (coneNumerics.RStar - coneNumerics.targetN)
  ));
  const crossing = tableValue(coneNumerics.profileGrid, coneNumerics.profiles.crossing[mode], q);
  const landing = tableValue(coneNumerics.profileGrid, coneNumerics.profiles.landing[mode], q);
  return interpolateNumber(crossing, landing, orderAmount);
}

function coneFieldValue(radius, psi, solution = coneState.solution) {
  const q = Math.max(0, radius / solution.R);
  let value = 0;
  for (let k = 0; k < solution.a.length; k++) {
    value += solution.a[k] * coneRadialValue(k, q, solution) * Math.cos(k * psi);
  }
  return value;
}

function coneColorFor(value) {
  return colorFor(Math.max(-2, Math.min(2, value)) * 1.15 / 2);
}

function resizeConeCanvas() {
  const canvas = $("#coneCanvas");
  const wrap = $("#coneCanvasWrap");
  const displayWidth = Math.max(1, wrap.clientWidth || 900);
  const displayHeight = Math.max(1, wrap.clientHeight || 620);
  const renderScale = Math.min(1, 760 / displayWidth, 650 / displayHeight);
  canvas.width = Math.max(1, Math.round(displayWidth * renderScale));
  canvas.height = Math.max(1, Math.round(displayHeight * renderScale));
  return { canvas, width: canvas.width, height: canvas.height };
}

function renderConeSlice() {
  const { canvas, width, height } = resizeConeCanvas();
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const xMin = -5;
  const xMax = .62;
  const solution = coneState.solution;

  for (let row = 0; row < height; row++) {
    const psi = Math.PI - (row + .5) / height * TWO_PI;
    const wall = -coneBoundaryGraph(psi, solution);
    for (let column = 0; column < width; column++) {
      const x = xMin + (column + .5) / width * (xMax - xMin);
      const pixel = (row * width + column) * 4;
      if (x > wall) {
        const stripe = ((column + row) % 18) < 1 ? 2 : 0;
        image.data[pixel] = SCHIFFER_VISUAL_THEME.backgroundRgb[0] - stripe;
        image.data[pixel + 1] = SCHIFFER_VISUAL_THEME.backgroundRgb[1] - stripe;
        image.data[pixel + 2] = SCHIFFER_VISUAL_THEME.backgroundRgb[2] - stripe;
        image.data[pixel + 3] = 255;
      } else {
        const color = coneColorFor(coneFieldValue(solution.R + x, psi, solution));
        image.data[pixel] = color[0];
        image.data[pixel + 1] = color[1];
        image.data[pixel + 2] = color[2];
        image.data[pixel + 3] = 255;
      }
    }
  }
  context.putImageData(image, 0, 0);

  const xToPixel = (x) => (x - xMin) / (xMax - xMin) * width;
  context.save();
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = 1;
  context.setLineDash([4, 6]);
  [-4, -3, -2, -1, 0].forEach((x) => {
    context.beginPath(); context.moveTo(xToPixel(x), 0); context.lineTo(xToPixel(x), height); context.stroke();
  });
  for (let tick = -2; tick <= 2; tick++) {
    const y = height * (.5 - tick / 4);
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  context.save();
  context.beginPath();
  for (let index = 0; index <= 260; index++) {
    const psi = Math.PI - index / 260 * TWO_PI;
    const x = xToPixel(-coneBoundaryGraph(psi, solution));
    const y = index / 260 * height;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
  context.shadowColor = "rgba(255,116,73,.9)";
  context.shadowBlur = 9;
  context.lineWidth = 2.5;
  context.stroke();
  context.restore();

}

function unfoldedCoordinates(angle, solution) {
  const gap = TWO_PI * (1 - coneNumerics.targetN / solution.R);
  let normalized = angle;
  if (normalized < 0) normalized += TWO_PI;
  const start = gap / 2;
  const end = TWO_PI - gap / 2;
  if (normalized < start || normalized > end) return null;
  const psi = ((normalized - start) * solution.R) % TWO_PI;
  return { psi, gap, start, end };
}

function drawUnfoldedSeamInset(context, width, solution, gap) {
  const boxWidth = Math.min(178, width * .28);
  const boxHeight = 126;
  const left = width - boxWidth - 15;
  const top = 15;
  context.save();
  context.fillStyle = SCHIFFER_VISUAL_THEME.tooltip;
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = 1;
  context.fillRect(left, top, boxWidth, boxHeight);
  context.strokeRect(left, top, boxWidth, boxHeight);
  context.fillStyle = SCHIFFER_VISUAL_THEME.muted;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText("SEAM MAGNIFIER", left + 11, top + 16);
  const centerX = left + boxWidth / 2;
  const centerY = top + boxHeight - 12;
  const magnification = 50;
  const shownGap = Math.min(.72, gap * magnification);
  context.strokeStyle = gap < 1e-8 ? "#4da2a3" : "#ff7449";
  context.lineWidth = 2;
  [-shownGap / 2, shownGap / 2].forEach((angle) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + 90 * Math.sin(angle), centerY - 90 * Math.cos(angle));
    context.stroke();
  });
  context.fillStyle = gap < 1e-8 ? "#4da2a3" : SCHIFFER_VISUAL_THEME.ink;
  context.fillText(gap < 1e-8 ? "SEAM CLOSED" : `×${magnification} · actual gap ${(gap * 180 / Math.PI).toFixed(3)}°`, left + 11, top + 34);
  context.restore();
}

function renderConeUnfolded() {
  const { canvas, width, height } = resizeConeCanvas();
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const solution = coneState.solution;
  const centerX = width * .49;
  const centerY = height * .51;
  const diskRadius = Math.min(width, height) * .425;
  const gap = Math.max(0, TWO_PI * (1 - coneNumerics.targetN / solution.R));

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const dx = column + .5 - centerX;
      const dy = centerY - row - .5;
      const radiusRatio = Math.hypot(dx, dy) / diskRadius;
      const pixel = (row * width + column) * 4;
      const coordinates = unfoldedCoordinates(Math.atan2(dy, dx), solution);
      if (!coordinates || radiusRatio > 1.025) {
        image.data[pixel] = SCHIFFER_VISUAL_THEME.backgroundRgb[0];
        image.data[pixel + 1] = SCHIFFER_VISUAL_THEME.backgroundRgb[1];
        image.data[pixel + 2] = SCHIFFER_VISUAL_THEME.backgroundRgb[2];
        image.data[pixel + 3] = 255;
        continue;
      }
      const wallRatio = 1 - coneBoundaryGraph(coordinates.psi, solution) / solution.R;
      if (radiusRatio > wallRatio) {
        image.data[pixel] = SCHIFFER_VISUAL_THEME.backgroundAltRgb[0];
        image.data[pixel + 1] = SCHIFFER_VISUAL_THEME.backgroundAltRgb[1];
        image.data[pixel + 2] = SCHIFFER_VISUAL_THEME.backgroundAltRgb[2];
        image.data[pixel + 3] = 255;
        continue;
      }
      const color = coneColorFor(coneFieldValue(radiusRatio * solution.R, coordinates.psi, solution));
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  context.save();
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = .7;
  for (let copy = 0; copy <= coneNumerics.targetN; copy++) {
    const angle = gap / 2 + copy * TWO_PI / solution.R;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + diskRadius * Math.cos(angle), centerY - diskRadius * Math.sin(angle));
    context.stroke();
  }
  context.strokeStyle = gap < 1e-8 ? "#4da2a3" : "#ff7449";
  context.lineWidth = 2;
  [gap / 2, TWO_PI - gap / 2].forEach((angle) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + diskRadius * 1.08 * Math.cos(angle), centerY - diskRadius * 1.08 * Math.sin(angle));
    context.stroke();
  });
  context.restore();

  context.save();
  context.beginPath();
  const outlineSamples = 28 * 28;
  for (let index = 0; index <= outlineSamples; index++) {
    const angle = gap / 2 + index / outlineSamples * (TWO_PI - gap);
    const coordinates = unfoldedCoordinates(angle, solution);
    if (!coordinates) continue;
    const radius = diskRadius * (1 - coneBoundaryGraph(coordinates.psi, solution) / solution.R);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY - radius * Math.sin(angle);
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
  context.shadowColor = "rgba(255,116,73,.75)";
  context.shadowBlur = 6;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
  drawUnfoldedSeamInset(context, width, solution, gap);
}

function buildConeMeshData(solution, depth, radialSegments = 96, angularSegments = 112) {
  const positions = [];
  const colors = [];
  const indices = [];
  const rim = [];
  const referenceRim = [];
  const rings = [];
  const generators = [];
  const collarDepth = 5 + Math.pow(depth, 1.35) * (solution.R - 5);
  const innerRadius = Math.max(.035, solution.R - collarDepth);
  const axialFactor = Math.sqrt(1 - 1 / (solution.R * solution.R));
  const centerRadius = (innerRadius + solution.R) / 2;

  for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex++) {
    const psi = -Math.PI + angularIndex / angularSegments * TWO_PI;
    const wallRadius = solution.R - coneBoundaryGraph(psi, solution);
    for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex++) {
      const fraction = radialIndex / radialSegments;
      const radius = innerRadius + fraction * (wallRadius - innerRadius);
      const embeddedRadius = radius / solution.R;
      const axial = (radius - centerRadius) * axialFactor;
      positions.push(axial, embeddedRadius * Math.cos(psi), embeddedRadius * Math.sin(psi));
      const color = coneColorFor(coneFieldValue(radius, psi, solution));
      colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
    }
    const wallEmbedded = wallRadius / solution.R;
    rim.push((wallRadius - centerRadius) * axialFactor, wallEmbedded * Math.cos(psi), wallEmbedded * Math.sin(psi));
    referenceRim.push((solution.R - centerRadius) * axialFactor, Math.cos(psi), Math.sin(psi));
  }

  const rowLength = radialSegments + 1;
  for (let angularIndex = 0; angularIndex < angularSegments; angularIndex++) {
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex++) {
      const a = angularIndex * rowLength + radialIndex;
      const b = a + 1;
      const c = a + rowLength;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  [.2, .4, .6, .8].forEach((fraction) => {
    const points = [];
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex++) {
      const psi = -Math.PI + angularIndex / angularSegments * TWO_PI;
      const wallRadius = solution.R - coneBoundaryGraph(psi, solution);
      const radius = innerRadius + fraction * (wallRadius - innerRadius);
      const embeddedRadius = radius / solution.R;
      points.push((radius - centerRadius) * axialFactor, embeddedRadius * Math.cos(psi), embeddedRadius * Math.sin(psi));
    }
    rings.push(points);
  });
  for (let line = 0; line < 8; line++) {
    const psi = -Math.PI + line / 8 * TWO_PI;
    const wallRadius = solution.R - coneBoundaryGraph(psi, solution);
    const points = [];
    for (let radialIndex = 0; radialIndex <= 64; radialIndex++) {
      const radius = innerRadius + radialIndex / 64 * (wallRadius - innerRadius);
      const embeddedRadius = radius / solution.R;
      points.push((radius - centerRadius) * axialFactor, embeddedRadius * Math.cos(psi), embeddedRadius * Math.sin(psi));
    }
    generators.push(points);
  }
  return { positions, colors, indices, rim, referenceRim, rings, generators, collarDepth };
}

function resizeConeThreeRenderer() {
  if (!coneThreeState.renderer || !coneThreeState.camera) return;
  const wrap = $("#coneThreeWrap");
  const width = Math.max(1, wrap.clientWidth || 900);
  const height = Math.max(1, wrap.clientHeight || 620);
  coneThreeState.renderer.setSize(width, height, false);
  coneThreeState.camera.aspect = width / height;
  coneThreeState.camera.updateProjectionMatrix();
}

function renderConeThreeFrame() {
  if (coneThreeState.renderer && coneThreeState.scene && coneThreeState.camera) {
    coneThreeState.renderer.render(coneThreeState.scene, coneThreeState.camera);
  }
}

function installConeThreeInteraction(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    coneThreeState.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!coneThreeState.pointer || coneThreeState.pointer.id !== event.pointerId || !coneThreeState.group) return;
    const dx = event.clientX - coneThreeState.pointer.x;
    const dy = event.clientY - coneThreeState.pointer.y;
    coneThreeState.group.rotation.y += dx * .006;
    coneThreeState.group.rotation.x += dy * .006;
    coneThreeState.pointer.x = event.clientX;
    coneThreeState.pointer.y = event.clientY;
    renderConeThreeFrame();
  });
  const release = (event) => { if (coneThreeState.pointer?.id === event.pointerId) coneThreeState.pointer = null; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.08 : .92;
    const length = Math.max(4.5, Math.min(55, coneThreeState.camera.position.length() * factor));
    coneThreeState.camera.position.setLength(length);
    renderConeThreeFrame();
  }, { passive: false });
}

function setupConeThreeRenderer() {
  if (coneThreeState.renderer) return;
  const THREE = threeState.library;
  const wrap = $("#coneThreeWrap");
  coneThreeState.scene = new THREE.Scene();
  coneThreeState.scene.background = new THREE.Color(SCHIFFER_VISUAL_THEME.backgroundHex);
  coneThreeState.camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
  coneThreeState.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  coneThreeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.insertBefore(coneThreeState.renderer.domElement, $("#coneThreeLoading"));
  coneThreeState.group = new THREE.Group();
  coneThreeState.group.rotation.x = -.22;
  coneThreeState.group.rotation.y = -.12;
  coneThreeState.scene.add(coneThreeState.group);
  resizeConeThreeRenderer();
  installConeThreeInteraction(coneThreeState.renderer.domElement);
}

function updateConeCamera(depth, force = false) {
  if (!coneThreeState.camera || (!force && Math.abs((coneThreeState.lastDepth ?? -1) - depth) < 1e-5)) return;
  const span = 5 + Math.pow(depth, 1.35) * (coneState.solution.R - 5);
  const distance = Math.max(7.2, span * 1.35);
  coneThreeState.camera.position.set(distance * .72, distance * .30, distance * .66);
  coneThreeState.camera.lookAt(0, 0, 0);
  coneThreeState.lastDepth = depth;
}

function updateConeThreeMesh() {
  if (!threeState.library || !coneThreeState.group || !coneState.solution) return;
  const THREE = threeState.library;
  while (coneThreeState.group.children.length) {
    const child = coneThreeState.group.children[0];
    coneThreeState.group.remove(child);
    disposeThreeObject(child);
  }
  const data = buildConeMeshData(coneState.solution, coneState.depth);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  coneThreeState.group.add(new THREE.Mesh(geometry, material));
  data.rings.forEach((points) => coneThreeState.group.add(threeLine(THREE, points, SCHIFFER_VISUAL_THEME.inkHex, .15)));
  data.generators.forEach((points) => coneThreeState.group.add(threeLine(THREE, points, SCHIFFER_VISUAL_THEME.inkHex, .10)));
  coneThreeState.group.add(threeLine(THREE, data.referenceRim, 0x7f9293, .45));
  coneThreeState.group.add(threeLine(THREE, data.rim, SCHIFFER_VISUAL_THEME.inkHex, 1));
  updateConeCamera(coneState.depth);
  $("#coneThreeLoading").hidden = true;
  renderConeThreeFrame();
}

async function renderConeThree() {
  $("#coneThreeLoading").hidden = false;
  try {
    await ensureThreeRenderer();
    setupConeThreeRenderer();
    resizeConeThreeRenderer();
    updateConeThreeMesh();
  } catch (error) {
    $("#coneThreeLoading").textContent = "3D renderer could not be loaded";
    console.error(error);
  }
}

function updateConeReadouts() {
  const solution = coneState.solution;
  const gapDegrees = Math.max(0, 360 * (1 - coneNumerics.targetN / solution.R));
  $("#coneProgressValue").textContent = `${Math.round(coneState.progress * 100)}%`;
  setMath("#coneSInline", `s=${solution.s.toFixed(4)}`);
  $("#coneRValue").textContent = solution.R.toFixed(6);
  $("#coneLambdaValue").textContent = solution.lambda.toFixed(6);
  $("#coneGapValue").textContent = gapDegrees < 5e-5 ? "0° · closed" : `${gapDegrees.toFixed(3)}°`;
  $("#coneDirichletValue").textContent = solution.dirichlet_rms === 0 ? "0 · exact base" : solution.dirichlet_rms.toExponential(2);
  $("#coneNeumannValue").textContent = solution.neumann_rms === 0 ? "0 · exact base" : solution.neumann_rms.toExponential(2);
  $("#coneDomainState").textContent = coneState.progress > .999
    ? "integral order reached · planar lift defined"
    : (coneState.progress < .001 ? "nonintegral crossing · angular gap present" : "computed cone branch");
  const depthUnits = 5 + Math.pow(coneState.depth, 1.35) * (solution.R - 5);
  $("#coneZoomValue").textContent = coneState.depth < .16 ? "boundary" : (coneState.depth > .94 ? "cone point" : `${depthUnits.toFixed(1)} units`);
}

function updateConeAxis() {
  const left = $("#coneAxisLeft");
  const center = $("#coneAxisDescription");
  const right = $("#coneAxisRight");
  if (coneState.view === "slice") {
    setMath(left, "x=-5");
    setMath(center, "\\psi\\in[-\\pi,\\pi]");
    setMath(right, "x=0\\;\\text{(boundary)}");
  } else if (coneState.view === "cone") {
    left.textContent = coneState.depth < .16 ? "boundary collar" : "toward the cone point";
    center.textContent = "metric cone surface · drag / zoom";
    right.textContent = "boundary";
  } else {
    left.textContent = "28 copies";
    setMath(center, "\\text{sector angle}=2\\pi/R");
    right.textContent = coneState.progress > .999 ? "seam closed" : "seam magnified ×50";
  }
}

function renderConeActiveView() {
  if (coneState.view === "slice") renderConeSlice();
  else if (coneState.view === "unfolded") renderConeUnfolded();
  else renderConeThree();
}

function solveAndRenderCone() {
  coneState.solution = coneRecordAt(coneState.progress);
  updateConeReadouts();
  updateConeAxis();
  renderConeActiveView();
}

function scheduleConeUpdate() {
  if (coneState.updateFrame) cancelAnimationFrame(coneState.updateFrame);
  coneState.updateFrame = requestAnimationFrame(() => {
    coneState.updateFrame = null;
    solveAndRenderCone();
  });
}

function setConeView(view) {
  coneState.view = view;
  document.querySelectorAll(".cone-view-button").forEach((button) => {
    const active = button.dataset.coneView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".cone-note").forEach((button) => button.classList.toggle("active", button.dataset.coneTarget === view));
  $("#coneCanvas").hidden = view === "cone";
  $("#coneThreeWrap").hidden = view !== "cone";
  updateConeAxis();
  renderConeActiveView();
}

function stopConePlayback() {
  coneState.playing = false;
  if (coneState.playFrame) cancelAnimationFrame(coneState.playFrame);
  coneState.playFrame = null;
  $("#conePlayIcon").textContent = "▶";
  $("#conePlayLabel").textContent = coneState.progress > .999 ? "Repeat" : "Animate";
}

function toggleConePlayback() {
  if (coneState.playing) { stopConePlayback(); return; }
  if (coneState.progress > .999) coneState.progress = 0;
  coneState.playing = true;
  $("#conePlayIcon").textContent = "Ⅱ";
  $("#conePlayLabel").textContent = "Pause";
  const startProgress = coneState.progress;
  const start = performance.now();
  const duration = Math.max(800, 5200 * (1 - startProgress));
  const tick = (now) => {
    if (!coneState.playing) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = t * t * (3 - 2 * t);
    coneState.progress = startProgress + (1 - startProgress) * eased;
    $("#coneProgressRange").value = coneState.progress;
    setRangeFill($("#coneProgressRange"));
    solveAndRenderCone();
    if (t >= 1) { stopConePlayback(); return; }
    coneState.playFrame = requestAnimationFrame(tick);
  };
  coneState.playFrame = requestAnimationFrame(tick);
}

document.querySelectorAll(".cone-view-button").forEach((button) => button.addEventListener("click", () => setConeView(button.dataset.coneView)));
document.querySelectorAll(".cone-note").forEach((button) => button.addEventListener("click", () => setConeView(button.dataset.coneTarget)));

setRangeFill($("#coneProgressRange"));
setRangeFill($("#coneZoomRange"));
$("#coneProgressRange").addEventListener("input", (event) => {
  stopConePlayback();
  coneState.progress = Number(event.target.value);
  setRangeFill(event.target);
  scheduleConeUpdate();
});
$("#coneZoomRange").addEventListener("input", (event) => {
  coneState.depth = Number(event.target.value);
  coneThreeState.lastDepth = null;
  setRangeFill(event.target);
  updateConeReadouts();
  if (coneState.view === "cone") scheduleConeUpdate();
});
$("#conePlayButton").addEventListener("click", toggleConePlayback);
$("#coneResetButton").addEventListener("click", () => {
  stopConePlayback();
  coneState.progress = 0;
  coneState.depth = .08;
  $("#coneProgressRange").value = coneState.progress;
  $("#coneZoomRange").value = coneState.depth;
  setRangeFill($("#coneProgressRange"));
  setRangeFill($("#coneZoomRange"));
  solveAndRenderCone();
});

let coneResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(coneResizeTimer);
  coneResizeTimer = setTimeout(() => { if (coneState.solution) renderConeActiveView(); }, 140);
});

solveAndRenderCone();

// ─────────────────────────────────────────────────────────────────────────────
// Global-to-local angular zoom. All three scales use the same interpolated
// nonlinear cone record and the same precomputed Fourier–Bessel field.

const modesState = {
  progress: .62,
  crop: 0,
  depth: 5,
  solution: null,
  playing: false,
  playFrame: null,
};

const MODES_COLORS = {
  cyan: "#4da2a3",
  orange: "#ff7449",
  white: SCHIFFER_VISUAL_THEME.ink,
  gray: SCHIFFER_VISUAL_THEME.faint,
  grid: SCHIFFER_VISUAL_THEME.line,
  text: SCHIFFER_VISUAL_THEME.muted,
  faint: SCHIFFER_VISUAL_THEME.faint,
};

function modesCanvasMetrics() {
  const canvas = $("#modesCanvas");
  const wrap = $("#modesCanvasWrap");
  const width = Math.max(1, wrap.clientWidth || 900);
  const height = Math.max(1, wrap.clientHeight || 620);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { canvas, context, width, height };
}

function drawModesPanelGrid(context, rect) {
  context.save();
  context.strokeStyle = MODES_COLORS.grid;
  context.lineWidth = 1;
  context.setLineDash([3, 6]);
  [-1, -.5, 0, .5, 1].forEach((value) => {
    const y = rect.top + (1.15 - value) / 2.3 * rect.height;
    context.beginPath();
    context.moveTo(rect.left, y);
    context.lineTo(rect.left + rect.width, y);
    context.stroke();
  });
  [0, .25, .5, .75, 1].forEach((amount) => {
    const x = rect.left + amount * rect.width;
    context.beginPath();
    context.moveTo(x, rect.top);
    context.lineTo(x, rect.top + rect.height);
    context.stroke();
  });
  context.setLineDash([]);
  context.strokeStyle = SCHIFFER_VISUAL_THEME.lineStrong;
  context.beginPath();
  const zeroY = rect.top + rect.height / 2;
  context.moveTo(rect.left, zeroY);
  context.lineTo(rect.left + rect.width, zeroY);
  context.stroke();
  context.restore();
}

function drawModesSeries(context, rect, values, color, width = 1.5, dash = []) {
  context.save();
  context.beginPath();
  values.forEach((value, index) => {
    const x = rect.left + index / (values.length - 1) * rect.width;
    const clipped = Math.max(-1.15, Math.min(1.15, value));
    const y = rect.top + (1.15 - clipped) / 2.3 * rect.height;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.strokeStyle = color;
  context.lineWidth = width;
  context.setLineDash(dash);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
  context.restore();
}

function drawModesPanelLabel(context, rect, title, equation, detail) {
  const compact = rect.width < 480;
  context.save();
  context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText(title.toUpperCase(), rect.left, rect.top - 33);
  context.fillStyle = MODES_COLORS.text;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText(equation, rect.left, rect.top - 17);
  if (!compact) {
    context.fillStyle = MODES_COLORS.faint;
    context.font = SCHIFFER_VISUAL_THEME.labelFont;
    context.textAlign = "right";
    context.fillText(detail, rect.left + rect.width, rect.top - 17);
  }
  context.restore();
}

function drawModesRim(context, rect, label) {
  const x = rect.left + rect.width;
  context.save();
  context.strokeStyle = SCHIFFER_VISUAL_THEME.muted;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, rect.top);
  context.lineTo(x, rect.top + rect.height);
  context.stroke();
  context.translate(x - 5, rect.top + 10);
  context.rotate(-Math.PI / 2);
  context.fillStyle = MODES_COLORS.faint;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.textAlign = "right";
  context.fillText(label.toUpperCase(), 0, 0);
  context.restore();
}

function drawAngularStrip(context, rect) {
  drawModesPanelGrid(context, rect);
  const values = [];
  const sampleCount = 480;
  for (let index = 0; index < sampleCount; index++) {
    const psi = -Math.PI + index / (sampleCount - 1) * TWO_PI;
    values.push(Math.cos(modesState.k * psi));
  }
  drawModesSeries(context, rect, values, MODES_COLORS.white, 2.1);
  context.save();
  context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText("SHARED ANGULAR FACTOR", rect.left, rect.top - 12);
  context.fillStyle = MODES_COLORS.faint;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText("−π", rect.left, rect.top + rect.height + 17);
  context.textAlign = "center";
  context.fillText("0", rect.left + rect.width / 2, rect.top + rect.height + 17);
  context.textAlign = "right";
  context.fillText("+π", rect.left + rect.width, rect.top + rect.height + 17);
  context.restore();
}

function renderModesComparison() {
  const { canvas, context, width, height } = modesCanvasMetrics();
  context.clearRect(0, 0, width, height);
  context.fillStyle = SCHIFFER_VISUAL_THEME.background;
  context.fillRect(0, 0, width, height);

  const compact = width < 650;
  let cylinderRect;
  let coneRect;
  let angularRect;
  if (compact) {
    cylinderRect = { left: 34, top: 58, width: width - 56, height: Math.max(110, height * .245) };
    coneRect = { left: 34, top: height * .405, width: width - 56, height: Math.max(110, height * .245) };
    angularRect = { left: 34, top: height * .805, width: width - 56, height: Math.max(48, height * .09) };
  } else {
    const outer = 42;
    const gutter = 58;
    const plotWidth = (width - outer * 2 - gutter) / 2;
    cylinderRect = { left: outer, top: 72, width: plotWidth, height: height * .56 };
    coneRect = { left: outer + plotWidth + gutter, top: 72, width: plotWidth, height: height * .56 };
    angularRect = { left: outer, top: height * .79, width: width - outer * 2, height: height * .105 };
  }

  const sampleCount = 420;
  const cylinderFirst = [];
  const cylinderSecond = [];
  const cylinderSelected = [];
  const coneInteger = [];
  const coneCurrent = [];
  for (let index = 0; index < sampleCount; index++) {
    const x = -modesState.depth + index / (sampleCount - 1) * modesState.depth;
    const cylinder = modesCylinderProfiles(x);
    cylinderFirst.push(cylinder.first);
    cylinderSecond.push(cylinder.second);
    cylinderSelected.push(cylinder.selected);
    coneInteger.push(modesConeProfile(modesState.k, x, 0));
    coneCurrent.push(modesConeProfile(modesState.k, x));
  }

  const cylinder = modesCylinderProfiles(0);
  const cylinderFirstNormalized = normalizedSeries(cylinderFirst);
  const cylinderSecondNormalized = normalizedSeries(cylinderSecond);
  const cylinderSelectedNormalized = normalizedSeries(cylinderSelected);
  const coneScale = Math.max(1e-14, ...coneInteger.map(Math.abs), ...coneCurrent.map(Math.abs));
  const coneIntegerNormalized = normalizedSeries(coneInteger, coneScale);
  const coneCurrentNormalized = normalizedSeries(coneCurrent, coneScale);

  drawModesPanelGrid(context, cylinderRect);
  drawModesPanelGrid(context, coneRect);
  drawModesSeries(context, cylinderRect, cylinderFirstNormalized, MODES_COLORS.cyan, 2.7);
  drawModesSeries(context, cylinderRect, cylinderSecondNormalized,
    cylinder.regime === "oscillatory" ? MODES_COLORS.orange : MODES_COLORS.gray,
    2.7, cylinder.regime === "oscillatory" ? [] : [5, 5]);
  drawModesSeries(context, cylinderRect, cylinderSelectedNormalized, MODES_COLORS.white, 1.7);
  drawModesSeries(context, coneRect, coneIntegerNormalized, MODES_COLORS.cyan, 3.8);
  drawModesSeries(context, coneRect, coneCurrentNormalized, MODES_COLORS.orange, 2.1);
  drawModesRim(context, cylinderRect, "boundary x = 0");
  drawModesRim(context, coneRect, "boundary r = R");

  const symbol = cylinder.regime === "oscillatory" ? "ω" : "α";
  const cylinderEquation = cylinder.regime === "oscillatory"
    ? "cos(ωx), sin(ωx)"
    : "e^{αx}, e^{−αx}";
  const cylinderDetail = `${symbol} = ${cylinder.parameter.toFixed(4)} · ${cylinder.regime}`;
  const currentR = modesOrder();
  const coneRimValue = modesConeProfile(modesState.k, 0);
  drawModesPanelLabel(context, cylinderRect, `half-cylinder / k = ${modesState.k}`, cylinderEquation, cylinderDetail);
  drawModesPanelLabel(context, coneRect, `cone / k = ${modesState.k}`, `J_{${modesState.k}R}(ρr/R)`, `R = ${currentR.toFixed(6)} · boundary value ${coneRimValue.toExponential(1)}`);

  if (cylinder.regime === "evanescent") {
    context.save();
    context.fillStyle = MODES_COLORS.faint;
    context.font = SCHIFFER_VISUAL_THEME.labelFont;
    context.fillText("dashed: growing branch rejected as x → −∞", cylinderRect.left + 8, cylinderRect.top + 15);
    context.restore();
  }
  if (modesState.k === 1 && modesState.transfer > .995) {
    context.save();
    context.fillStyle = MODES_COLORS.orange;
    context.font = SCHIFFER_VISUAL_THEME.labelFont;
    context.textAlign = "right";
    context.fillText("COMMON-ZERO NORMALIZATION", coneRect.left + coneRect.width - 8, coneRect.top + 15);
    context.restore();
  }

  drawAngularStrip(context, angularRect);
  canvas.setAttribute("aria-label", `Angular mode ${modesState.k}: ${cylinder.regime} cylinder radial profiles compared with Bessel profiles at N 28 and real order ${currentR.toFixed(6)}.`);
}

function modesPolarPoint(plot, radius, angle, R) {
  const scaled = radius / R * plot.radius;
  return {
    x: plot.cx + scaled * Math.cos(angle),
    y: plot.cy - scaled * Math.sin(angle),
  };
}

function modesFastField(solution) {
  const sampleCount = coneNumerics.profileGrid.length;
  const qMax = coneNumerics.profileGrid.at(-1);
  const radial = solution.a.map((_, mode) => {
    const samples = [];
    for (let index = 0; index < sampleCount; index++) {
      samples.push(coneRadialValue(mode, index / (sampleCount - 1) * qMax, solution));
    }
    return samples;
  });
  return (radius, psi) => {
    const scaled = Math.max(0, Math.min(sampleCount - 1, radius / solution.R / qMax * (sampleCount - 1)));
    const lower = Math.min(sampleCount - 2, Math.floor(scaled));
    const amount = scaled - lower;
    const cosine = Math.cos(psi);
    let previousCosine = 1;
    let currentCosine = cosine;
    let value = 0;
    for (let mode = 0; mode < solution.a.length; mode++) {
      let angular;
      if (mode === 0) angular = 1;
      else if (mode === 1) angular = cosine;
      else {
        angular = 2 * cosine * currentCosine - previousCosine;
        previousCosine = currentCosine;
        currentCosine = angular;
      }
      const radialValue = interpolateNumber(radial[mode][lower], radial[mode][lower + 1], amount);
      value += solution.a[mode] * radialValue * angular;
    }
    return value;
  };
}

function modesRaster(rect, sampler, resolution = .62) {
  const width = Math.max(2, Math.round(rect.width * resolution));
  const height = Math.max(2, Math.round(rect.height * resolution));
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenContext = offscreen.getContext("2d");
  const image = offscreenContext.createImageData(width, height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const color = sampler((column + .5) / width, (row + .5) / height);
      const pixel = (row * width + column) * 4;
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = 255;
    }
  }
  offscreenContext.putImageData(image, 0, 0);
  return offscreen;
}

function modesDrawGlobal(context, rect, solution, fieldValue) {
  const plot = {
    cx: rect.left + rect.width * .5,
    cy: rect.top + rect.height * .54,
    radius: Math.min(rect.width, rect.height - 42) * .43,
  };
  const localPlot = {
    cx: (plot.cx - rect.left) / rect.width,
    cy: (plot.cy - rect.top) / rect.height,
    radius: plot.radius / Math.min(rect.width, rect.height),
  };
  const aspectScaleX = Math.min(rect.width, rect.height) / rect.width;
  const aspectScaleY = Math.min(rect.width, rect.height) / rect.height;
  const raster = modesRaster(rect, (u, v) => {
    const dx = (u - localPlot.cx) / (localPlot.radius * aspectScaleX);
    const dy = (localPlot.cy - v) / (localPlot.radius * aspectScaleY);
    const radius = Math.hypot(dx, dy) * solution.R;
    if (radius > solution.R + .75) return SCHIFFER_VISUAL_THEME.backgroundRgb;
    const coordinates = unfoldedCoordinates(Math.atan2(dy, dx), solution);
    if (!coordinates) return radius <= solution.R + .45
      ? SCHIFFER_VISUAL_THEME.backgroundAltRgb
      : SCHIFFER_VISUAL_THEME.backgroundRgb;
    const wallRadius = solution.R - coneBoundaryGraph(coordinates.psi, solution);
    if (radius > wallRadius) return SCHIFFER_VISUAL_THEME.backgroundAltRgb;
    return coneColorFor(fieldValue(radius, coordinates.psi));
  }, .58);
  context.save();
  context.imageSmoothingEnabled = true;
  context.drawImage(raster, rect.left, rect.top, rect.width, rect.height);

  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = 1;
  context.setLineDash([3, 6]);
  [.35, .6, .82, 1].forEach((ratio) => {
    context.beginPath();
    context.arc(plot.cx, plot.cy, plot.radius * ratio, 0, TWO_PI);
    context.stroke();
  });
  context.setLineDash([]);

  context.beginPath();
  let drawing = false;
  for (let index = 0; index <= 1120; index++) {
    const angle = index / 1120 * TWO_PI;
    const coordinates = unfoldedCoordinates(angle, solution);
    if (!coordinates) { drawing = false; continue; }
    const wallRadius = solution.R - coneBoundaryGraph(coordinates.psi, solution);
    const point = modesPolarPoint(plot, wallRadius, angle, solution.R);
    if (!drawing) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    drawing = true;
  }
  context.strokeStyle = MODES_COLORS.white;
  context.lineWidth = 1.7;
  context.shadowColor = "rgba(255,116,73,.45)";
  context.shadowBlur = 5;
  context.stroke();
  context.shadowBlur = 0;

  const gap = Math.max(0, TWO_PI * (1 - coneNumerics.targetN / solution.R));
  if (gap > 1e-7) {
    context.strokeStyle = MODES_COLORS.orange;
    context.lineWidth = 1.4;
    [-gap / 2, gap / 2].forEach((angle) => {
      const inner = modesPolarPoint(plot, solution.R * .62, angle, solution.R);
      const outer = modesPolarPoint(plot, solution.R * 1.06, angle, solution.R);
      context.beginPath();
      context.moveTo(inner.x, inner.y);
      context.lineTo(outer.x, outer.y);
      context.stroke();
    });
  }

  const cropAngle = modesState.crop * TWO_PI;
  const halfAngle = Math.PI / solution.R;
  const innerRadius = Math.max(0, solution.R - modesState.depth);
  const outerRadius = solution.R + .65;
  const cropPoints = [
    modesPolarPoint(plot, innerRadius, cropAngle - halfAngle, solution.R),
    modesPolarPoint(plot, outerRadius, cropAngle - halfAngle, solution.R),
    modesPolarPoint(plot, outerRadius, cropAngle + halfAngle, solution.R),
    modesPolarPoint(plot, innerRadius, cropAngle + halfAngle, solution.R),
  ];
  context.beginPath();
  cropPoints.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fillStyle = "rgba(77,162,163,.11)";
  context.fill();
  context.strokeStyle = MODES_COLORS.cyan;
  context.lineWidth = 1.7;
  context.stroke();

  context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText("WHOLE 28-COPY ASSEMBLY", rect.left + 10, rect.top + 16);
  if (rect.width >= 480) {
    context.fillStyle = MODES_COLORS.cyan;
    context.fillText("ONE WAVELENGTH", cropPoints[1].x + 5, cropPoints[1].y - 5);
  }
  context.restore();
  return { plot, cropPoints, gap };
}

function modesPatchCoordinates(solution, centerAngle, tangent) {
  const angle = Math.atan2(
    Math.sin(centerAngle + tangent / solution.R),
    Math.cos(centerAngle + tangent / solution.R)
  );
  return unfoldedCoordinates(angle, solution);
}

function modesRadialComparison(solution) {
  const rimValue = solution.criticalRim;
  // Every stored critical profile is divided by q J'_R(rho), so its derivative
  // with respect to the collar coordinate x is one at x = 0.
  const derivative = 1;
  const omega = Math.sqrt(Math.max(0, solution.lambda - 1));
  const exactPhase = Math.atan2(omega * rimValue, derivative);

  // In the oscillatory Debye region, J_R(rho) has phase
  // xi(R) = sqrt(rho^2-R^2) - R acos(R/rho) - pi/4. Anchoring xi at
  // the exact crossing removes the small absolute Debye phase error while
  // retaining its explicit order-to-phase law xi'(R) = -acos(R/rho).
  const debyePhaseAt = (R) => Math.sqrt(coneNumerics.rho ** 2 - R ** 2)
    - R * Math.acos(R / coneNumerics.rho) - Math.PI / 4;
  const phase = debyePhaseAt(solution.R) - debyePhaseAt(coneNumerics.RStar);

  const landingRecord = coneNumerics.records.at(-1);
  const landingPhase = debyePhaseAt(landingRecord.R) - debyePhaseAt(coneNumerics.RStar);
  const phaseFraction = landingPhase > 1e-12
    ? Math.max(0, Math.min(1, phase / landingPhase))
    : 0;

  return {
    omega,
    rimValue,
    derivative,
    phase,
    phaseDegrees: phase * 180 / Math.PI,
    exactPhase,
    exactPhaseDegrees: exactPhase * 180 / Math.PI,
    landingPhaseDegrees: landingPhase * 180 / Math.PI,
    phaseFraction,
    cylinderValue: (x) => Math.sin(omega * x + phase) / (omega * Math.cos(phase)),
    besselValue: (x) => tableValue(
      coneNumerics.profileGrid,
      solution.criticalProfile,
      1 + x / solution.R
    ),
  };
}

function modesDrawRadialComparison(context, rect, solution, depth, comparison) {
  const compact = rect.width < 480;
  const plot = {
    left: rect.left + 8,
    top: rect.top + 25,
    width: rect.width - 16,
    height: rect.height - 33,
  };
  const bessel = [];
  const cylinder = [];
  const samples = 220;
  for (let index = 0; index < samples; index++) {
    const x = -depth + index / (samples - 1) * depth;
    bessel.push(comparison.besselValue(x));
    cylinder.push(comparison.cylinderValue(x));
  }
  const scale = Math.max(1e-8, ...bessel.map(Math.abs), ...cylinder.map(Math.abs)) * 1.12;
  const xToPixel = (index) => plot.left + index / (samples - 1) * plot.width;
  const yToPixel = (value) => plot.top + (scale - value) / (2 * scale) * plot.height;

  context.save();
  context.fillStyle = SCHIFFER_VISUAL_THEME.panel;
  context.fillRect(rect.left, rect.top, rect.width, rect.height);
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(plot.left, yToPixel(0));
  context.lineTo(plot.left + plot.width, yToPixel(0));
  context.stroke();
  context.beginPath();
  context.moveTo(plot.left + plot.width, plot.top);
  context.lineTo(plot.left + plot.width, plot.top + plot.height);
  context.stroke();

  const draw = (values, color, width, dash = []) => {
    context.beginPath();
    values.forEach((value, index) => {
      const x = xToPixel(index);
      const y = yToPixel(value);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dash);
    context.stroke();
    context.setLineDash([]);
  };
  draw(bessel, MODES_COLORS.cyan, 2.2);
  draw(cylinder, MODES_COLORS.orange, 1.7);

  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
  context.fillText(compact ? "LOCAL MODE" : "LOCAL OSCILLATORY MODE", rect.left + 8, rect.top + 14);
  context.textAlign = "right";
  context.fillStyle = MODES_COLORS.cyan;
  context.fillText("BESSEL", rect.left + rect.width - (compact ? 78 : 116), rect.top + 14);
  context.fillStyle = MODES_COLORS.orange;
  context.fillText(compact ? "SIN/COS" : "DEBYE SIN/COS", rect.left + rect.width - 8, rect.top + 14);
  context.restore();
}

function modesDrawPatch(context, rect, solution, fieldValue, options) {
  const compact = Boolean(options.compact);
  const labelHeight = compact ? 24 : 39;
  const footerHeight = compact ? 111 : 122;
  const plot = {
    left: rect.left + (compact ? 8 : 12),
    top: rect.top + labelHeight,
    width: rect.width - (compact ? 16 : 24),
    height: rect.height - labelHeight - footerHeight,
  };
  const xMin = -options.depth;
  const xMax = compact ? .22 : .55;
  const raster = modesRaster(plot, (u, v) => {
    const x = interpolateNumber(xMin, xMax, u);
    const tangent = interpolateNumber(options.tangentSpan, -options.tangentSpan, v);
    const coordinates = modesPatchCoordinates(solution, options.centerAngle, tangent);
    if (!coordinates) return SCHIFFER_VISUAL_THEME.backgroundAltRgb;
    const wall = -coneBoundaryGraph(coordinates.psi, solution);
    if (x > wall) return SCHIFFER_VISUAL_THEME.backgroundAltRgb;
    return coneColorFor(fieldValue(solution.R + x, coordinates.psi));
  }, compact ? .76 : .64);

  context.save();
  context.fillStyle = SCHIFFER_VISUAL_THEME.panel;
  context.fillRect(rect.left, rect.top, rect.width, rect.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(raster, plot.left, plot.top, plot.width, plot.height);

  const xToPixel = (x) => plot.left + (x - xMin) / (xMax - xMin) * plot.width;
  const tangentToPixel = (tangent) => plot.top + (options.tangentSpan - tangent) / (2 * options.tangentSpan) * plot.height;
  context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
  context.lineWidth = 1;
  context.setLineDash([3, 6]);
  [xMin, xMin / 2, 0].forEach((x) => {
    context.beginPath(); context.moveTo(xToPixel(x), plot.top); context.lineTo(xToPixel(x), plot.top + plot.height); context.stroke();
  });
  [-.5, 0, .5].forEach((amount) => {
    const y = tangentToPixel(amount * options.tangentSpan * 2);
    context.beginPath(); context.moveTo(plot.left, y); context.lineTo(plot.left + plot.width, y); context.stroke();
  });
  context.setLineDash([]);

  context.beginPath();
  let drawing = false;
  for (let index = 0; index <= 360; index++) {
    const tangent = options.tangentSpan - index / 360 * 2 * options.tangentSpan;
    const coordinates = modesPatchCoordinates(solution, options.centerAngle, tangent);
    if (!coordinates) { drawing = false; continue; }
    const x = -coneBoundaryGraph(coordinates.psi, solution);
    const px = xToPixel(x);
    const py = tangentToPixel(tangent);
    if (!drawing) context.moveTo(px, py); else context.lineTo(px, py);
    drawing = true;
  }
  context.strokeStyle = MODES_COLORS.white;
  context.lineWidth = compact ? 1.3 : 2;
  context.shadowColor = "rgba(255,116,73,.62)";
  context.shadowBlur = compact ? 3 : 6;
  context.stroke();
  context.shadowBlur = 0;

  if (!SCHIFFER_VISUAL_THEME.paperEdition) {
    context.strokeStyle = options.accent;
    context.lineWidth = 1;
    context.strokeRect(rect.left + .5, rect.top + .5, rect.width - 1, rect.height - 1);
  }
  context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
  context.font = SCHIFFER_VISUAL_THEME.labelFont;
  context.fillText(options.title, rect.left + (compact ? 8 : 12), rect.top + (compact ? 15 : 17));
  context.restore();
  const comparisonRect = {
    left: plot.left,
    top: plot.top + plot.height + (compact ? 18 : 22),
    width: plot.width,
    height: compact ? 87 : 94,
  };
  modesDrawRadialComparison(context, comparisonRect, solution, options.depth, options.comparison);
  plot.comparisonRect = comparisonRect;
  return plot;
}

function updateModesCanvasFormulas(globalRect, patchRect, patchPlot, solution, comparison, containsSeam) {
  const formulaColor = SCHIFFER_VISUAL_THEME.muted;
  if (SCHIFFER_VISUAL_THEME.paperEdition) {
    ["modesGlobalFormula", "modesPatchFormula", "modesRadialFormula"].forEach(removeCanvasFormula);
  } else {
    setCanvasFormula("#modesCanvasWrap", "modesGlobalFormula", `R=${solution.R.toFixed(6)},\\quad s=${solution.s.toFixed(4)}`, {
      left: globalRect.left + 10, top: globalRect.top + 20, color: formulaColor,
    });
    setCanvasFormula("#modesCanvasWrap", "modesPatchFormula", containsSeam
      ? `\\Delta\\xi=${comparison.phaseDegrees.toFixed(2)}^{\\circ}`
      : "\\psi\\in[-\\pi,\\pi]", {
      left: patchRect.left + patchRect.width - 12,
      top: patchRect.top + 8,
      transform: "translateX(-100%)",
      color: formulaColor,
    });
  }
  setCanvasFormula("#modesCanvasWrap", "modesPatchLeftFormula", `x=-${modesState.depth.toFixed(1)}`, {
    left: patchPlot.left, top: patchPlot.top + patchPlot.height + 5, color: formulaColor,
  });
  setCanvasFormula("#modesCanvasWrap", "modesPatchRightFormula", "x=0", {
    left: patchPlot.left + patchPlot.width, top: patchPlot.top + patchPlot.height + 5,
    transform: "translateX(-100%)", color: formulaColor,
  });
  const comparisonRect = patchPlot.comparisonRect;
  if (comparisonRect && !SCHIFFER_VISUAL_THEME.paperEdition) {
    setCanvasFormula("#modesCanvasWrap", "modesRadialFormula", `\\Delta\\xi=${comparison.phaseDegrees.toFixed(3)}^{\\circ},\\quad\\delta=${comparison.exactPhaseDegrees.toFixed(3)}^{\\circ}`, {
      left: comparisonRect.left + comparisonRect.width,
      top: comparisonRect.top + comparisonRect.height - 14,
      transform: "translateX(-100%)",
      color: formulaColor,
    });
  }
}

function modesCropContainsSeam(solution) {
  const cropAngle = modesState.crop * TWO_PI;
  const distance = Math.abs(Math.atan2(Math.sin(cropAngle), Math.cos(cropAngle)));
  const gap = Math.max(0, TWO_PI * (1 - coneNumerics.targetN / solution.R));
  return distance <= Math.PI / solution.R + gap / 2;
}

function renderModesNestedZoom() {
  const { canvas, context, width, height } = modesCanvasMetrics();
  const solution = modesState.solution;
  const fieldValue = modesFastField(solution);
  const comparison = modesRadialComparison(solution);
  context.clearRect(0, 0, width, height);
  context.fillStyle = SCHIFFER_VISUAL_THEME.background;
  context.fillRect(0, 0, width, height);
  const compact = width < 650;
  let globalRect;
  let patchRect;
  if (compact) {
    globalRect = { left: 12, top: 10, width: width - 24, height: height * .42 };
    patchRect = { left: 12, top: height * .45, width: width - 24, height: height * .53 };
  } else {
    globalRect = { left: 16, top: 18, width: width * .405, height: height - 36 };
    patchRect = { left: width * .455, top: 42, width: width * .515, height: height - 84 };
  }

  const global = modesDrawGlobal(context, globalRect, solution, fieldValue);
  const cropAngle = modesState.crop * TWO_PI;
  const containsSeam = modesCropContainsSeam(solution);
  const patchPlot = modesDrawPatch(context, patchRect, solution, fieldValue, {
    centerAngle: cropAngle,
    tangentSpan: Math.PI,
    depth: modesState.depth,
    title: compact ? "UNWRAPPED COLLAR" : "ONE ANGULAR WAVELENGTH · UNWRAPPED COLLAR",
    detail: containsSeam ? `Δξ = ${comparison.phaseDegrees.toFixed(2)}° · SEAM CENTERED` : "ψ-span = 2π · locally flat",
    accent: MODES_COLORS.cyan,
    comparison,
    compact,
  });
  updateModesCanvasFormulas(globalRect, patchRect, patchPlot, solution, comparison, containsSeam);

  if (!compact) {
    context.save();
    context.strokeStyle = "rgba(77,162,163,.58)";
    context.lineWidth = 1;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.moveTo(global.cropPoints[1].x, global.cropPoints[1].y);
    context.lineTo(patchPlot.left, patchPlot.top);
    context.moveTo(global.cropPoints[2].x, global.cropPoints[2].y);
    context.lineTo(patchPlot.left, patchPlot.top + patchPlot.height);
    context.stroke();
    context.restore();
  }

  const gapDegrees = Math.max(0, 360 * (1 - coneNumerics.targetN / solution.R));
  canvas.setAttribute("aria-label", SCHIFFER_VISUAL_THEME.paperEdition
    ? "The cone quotient assembled in 28 copies, a seam-centered one-wavelength flat collar crop, and a comparison of the regular Bessel radial mode with its Debye sine-cosine cylinder mode."
    : `The cone quotient at order ${solution.R.toFixed(6)} assembled in 28 copies, a seam-centered one-wavelength flat collar crop showing a ${gapDegrees.toFixed(3)} degree mismatch, and a comparison of the regular Bessel radial mode with its Debye sine-cosine cylinder mode at phase shift ${comparison.phaseDegrees.toFixed(2)} degrees.`);
}

function updateModesReadouts() {
  const solution = modesState.solution;
  const gapDegrees = Math.max(0, 360 * (1 - coneNumerics.targetN / solution.R));
  const cropDegrees = modesState.crop * 360;
  const comparison = modesRadialComparison(solution);
  const phasePercent = comparison.phaseFraction * 100;
  $("#modesTransferValue").textContent = `${Math.round(modesState.progress * 100)}%`;
  $("#modesOrderValue").textContent = solution.R.toFixed(6);
  $("#modesAmplitudeValue").textContent = solution.s.toFixed(4);
  $("#modesCropValue").textContent = modesState.crop < .012 ? "centered on seam" : `${cropDegrees.toFixed(0)}° from seam`;
  $("#modesDepthValue").textContent = `${modesState.depth.toFixed(modesState.depth % 1 ? 2 : 0)} units`;
  setMath("#modesPhaseValue", `\\Delta\\xi=${comparison.phaseDegrees.toFixed(3)}^{\\circ}`);
  setMath("#modesExactPhaseValue", `\\delta=${comparison.exactPhaseDegrees.toFixed(3)}^{\\circ}`);
  $("#modesPhaseFill").style.width = `${phasePercent}%`;
  $("#modesPhaseMarker").style.left = `${phasePercent}%`;
  $("#modesPhaseTrack").setAttribute("aria-label", `The Debye cylinder phase shift is ${comparison.phaseDegrees.toFixed(2)} degrees, from zero degrees at the crossing to ${comparison.landingPhaseDegrees.toFixed(2)} degrees at N equals 28.`);
  $("#modesGapValue").textContent = gapDegrees < 5e-5 ? "0° · closed" : `${gapDegrees.toFixed(3)}°`;
  $("#modesWavelengthValue").textContent = `${TWO_PI.toFixed(3)} units`;
  setMath("#modesCurvatureValue", `1/${solution.R.toFixed(3)}`);
  if (gapDegrees < 5e-5) {
    $("#modesPlotState").textContent = "integral order · 28 sectors fit exactly";
  } else if (modesCropContainsSeam(solution)) {
    $("#modesPlotState").textContent = "nonintegral order · seam inside main zoom";
  } else {
    $("#modesPlotState").textContent = "nonintegral order · seam tracked below";
  }
}

function updateModesComparison() {
  modesState.solution = coneRecordAt(modesState.progress);
  updateModesReadouts();
  renderModesNestedZoom();
}

function stopModesPlayback() {
  modesState.playing = false;
  if (modesState.playFrame) cancelAnimationFrame(modesState.playFrame);
  modesState.playFrame = null;
  $("#modesPlayIcon").textContent = "▶";
  $("#modesPlayLabel").textContent = modesState.progress > .999 ? "Repeat" : "Animate";
}

function toggleModesPlayback() {
  if (modesState.playing) { stopModesPlayback(); return; }
  if (modesState.progress > .999) modesState.progress = 0;
  modesState.playing = true;
  $("#modesPlayIcon").textContent = "Ⅱ";
  $("#modesPlayLabel").textContent = "Pause";
  const startProgress = modesState.progress;
  const start = performance.now();
  let lastRender = 0;
  const duration = Math.max(700, 5200 * (1 - startProgress));
  const tick = (now) => {
    if (!modesState.playing) return;
    const amount = Math.min(1, (now - start) / duration);
    const eased = amount * amount * (3 - 2 * amount);
    modesState.progress = startProgress + (1 - startProgress) * eased;
    $("#modesTransferRange").value = modesState.progress;
    setRangeFill($("#modesTransferRange"));
    if (now - lastRender > 65 || amount >= 1) {
      updateModesComparison();
      lastRender = now;
    }
    if (amount >= 1) { stopModesPlayback(); return; }
    modesState.playFrame = requestAnimationFrame(tick);
  };
  modesState.playFrame = requestAnimationFrame(tick);
}

setRangeFill($("#modesTransferRange"));
$("#modesTransferRange").addEventListener("input", (event) => {
  stopModesPlayback();
  modesState.progress = Number(event.target.value);
  setRangeFill(event.target);
  updateModesComparison();
});
$("#modesPlayButton").addEventListener("click", toggleModesPlayback);
$("#modesResetButton").addEventListener("click", () => {
  stopModesPlayback();
  Object.assign(modesState, { progress: .62, crop: 0, depth: 5 });
  $("#modesTransferRange").value = modesState.progress;
  setRangeFill($("#modesTransferRange"));
  updateModesComparison();
});

let modesResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(modesResizeTimer);
  modesResizeTimer = setTimeout(renderModesNestedZoom, 140);
});

updateModesComparison();

// ─────────────────────────────────────────────────────────────────────────────
// Large-radius Bessel dictionary. This is an exact separated-mode experiment,
// not the fixed-rho nonlinear continuation above.  The spectral scale q_R is
// chosen so J_R'(q_R R)=0 along one real-order Neumann root branch. Exact
// Bessel samples are precomputed for 26 <= R <= 30 and interpolated here.

const debyeData = window.DEBYE_WIDE_DATA;
if (debyeData) {
  const debyeState = {
    radius: 28,
    playing: false,
    playFrame: null,
  };

  function debyeRadiusIndices(radius) {
    const scaled = (radius - debyeData.rMin) / debyeData.rStep;
    const lower = Math.max(0, Math.min(debyeData.radii.length - 2, Math.floor(scaled)));
    return { lower, upper: lower + 1, amount: Math.max(0, Math.min(1, scaled - lower)) };
  }

  function debyeInterpolateRows(rows, radius, x) {
    const { lower, upper, amount } = debyeRadiusIndices(radius);
    return interpolateNumber(
      tableValue(debyeData.xGrid, rows[lower], x),
      tableValue(debyeData.xGrid, rows[upper], x),
      amount
    );
  }

  function debyeInterpolateColumn(values, radius) {
    const { lower, upper, amount } = debyeRadiusIndices(radius);
    return interpolateNumber(values[lower], values[upper], amount);
  }

  function debyeLambdaAt(radius) {
    return debyeInterpolateColumn(debyeData.lambdaValues, radius);
  }

  function debyeRhoAt(radius) {
    return debyeInterpolateColumn(debyeData.rhoValues, radius);
  }

  function debyeRimSlopeAt(mode, radius) {
    const values = debyeData.rimSlopes?.[String(mode)];
    return values ? debyeInterpolateColumn(values, radius) : 0;
  }

  // The original three views are kept unchanged: a flat collar, the
  // corresponding planar sector, and the complete N-fold disk.  A fourth view
  // places a long half-cylinder beside the disk at the same geometric scale.
  const collarFieldState = { fold: 28, mode: 1, trig: "cos" };
  const COLLAR_BACKGROUND = SCHIFFER_VISUAL_THEME.backgroundRgb;
  const COLLAR_ZOOM_ACCENT = getComputedStyle(document.documentElement).getPropertyValue("--teal").trim() || "#4da2a3";
  const COLLAR_ZOOM_FILL = SCHIFFER_VISUAL_THEME.paperEdition
    ? "rgba(40,123,123,.16)"
    : "rgba(77,162,163,.18)";

  function collarAngularValue(psi) {
    if (collarFieldState.mode === 0) return 1;
    const angle = collarFieldState.mode * psi;
    return collarFieldState.trig === "cos" ? Math.cos(angle) : Math.sin(angle);
  }

  function collarExactRadial(x) {
    return debyeInterpolateRows(
      debyeData.profiles[String(collarFieldState.mode)],
      collarFieldState.fold,
      x
    );
  }

  function collarCylinderRadial(x) {
    const mode = collarFieldState.mode;
    const lambda = debyeLambdaAt(collarFieldState.fold);
    if (mode === 0) {
      const frequency = Math.sqrt(lambda);
      const rimValue = collarExactRadial(0);
      const rimSlope = debyeRimSlopeAt(0, collarFieldState.fold);
      return rimValue * Math.cos(frequency * x) + rimSlope / frequency * Math.sin(frequency * x);
    }
    if (mode >= 2) return Math.exp(Math.sqrt(mode * mode - lambda) * x);
    return Math.cos(Math.sqrt(lambda - 1) * x);
  }

  function collarGlobalRadial(q) {
    const profiles = debyeData.globalProfiles?.[String(collarFieldState.fold)];
    if (!profiles) return 0;
    return tableValue(debyeData.qGrid, profiles[String(collarFieldState.mode)], q);
  }

  function collarRaster(canvas, sampler) {
    const wrap = canvas.parentElement;
    const width = Math.max(1, wrap.clientWidth || 300);
    const height = Math.max(1, wrap.clientHeight || 430);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const rasterWidth = Math.round(width * ratio);
    const rasterHeight = Math.round(height * ratio);
    canvas.width = rasterWidth;
    canvas.height = rasterHeight;
    const context = canvas.getContext("2d");
    const image = context.createImageData(rasterWidth, rasterHeight);
    for (let row = 0; row < rasterHeight; row++) {
      for (let column = 0; column < rasterWidth; column++) {
        const color = sampler((column + .5) / rasterWidth, (row + .5) / rasterHeight);
        const pixel = (row * rasterWidth + column) * 4;
        image.data[pixel] = color[0];
        image.data[pixel + 1] = color[1];
        image.data[pixel + 2] = color[2];
        image.data[pixel + 3] = color[3] ?? 255;
      }
    }
    context.putImageData(image, 0, 0);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height };
  }

  function collarDrawCoordinateGrid(context, width, height) {
    context.save();
    context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
    context.lineWidth = 1;
    [.2, .4, .6, .8].forEach((amount) => {
      context.beginPath();
      context.moveTo(amount * width, 0);
      context.lineTo(amount * width, height);
      context.stroke();
    });
    [.25, .5, .75].forEach((amount) => {
      context.beginPath();
      context.moveTo(0, amount * height);
      context.lineTo(width, amount * height);
      context.stroke();
    });
    context.restore();
  }

  function renderCollarCylinder() {
    const canvas = $("#collarCylinderCanvas");
    const { context, width, height } = collarRaster(canvas, (u, v) => {
      const x = -debyeData.depth + u * debyeData.depth;
      const psi = Math.PI - v * TWO_PI;
      return colorFor(collarCylinderRadial(x) * collarAngularValue(psi));
    });
    collarDrawCoordinateGrid(context, width, height);
    context.save();
    context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(width - .7, 0);
    context.lineTo(width - .7, height);
    context.stroke();
    context.restore();
    canvas.setAttribute(
      "aria-label",
      collarFieldState.mode === 0
        ? "Radial cylinder mode k 0 on the collar from x minus five to zero, with Cauchy data matched to the regular Bessel profile at the rim."
        : `Cylinder mode k ${collarFieldState.mode} with ${collarFieldState.trig} angular data on the collar from x minus five to zero.`
    );
  }

  function renderCollarHalfCylinder() {
    const canvas = $("#collarHalfCylinderCanvas");
    const wrap = canvas.parentElement;
    const cell = wrap.parentElement;
    const diskWrap = $("#collarDiskCanvas").parentElement;
    const fold = collarFieldState.fold;
    const depth = 2 * fold;

    // The disk renderer uses 81% of the smaller canvas dimension for its
    // diameter.  Give the cylinder the same number of pixels for the physical
    // length 2N, and scale its 2π circumference by that identical factor.
    const diskDiameter = .81 * Math.min(diskWrap.clientWidth || 300, diskWrap.clientHeight || 300);
    const width = Math.max(1, Math.round(Math.min(cell.clientWidth || diskDiameter, diskDiameter)));
    const height = Math.max(1, Math.round(width * Math.PI / fold));
    wrap.style.width = `${width}px`;
    wrap.style.height = `${height}px`;

    const raster = collarRaster(canvas, (u, v) => {
      const x = -depth + u * depth;
      const psi = Math.PI - v * TWO_PI;
      return colorFor(collarCylinderRadial(x) * collarAngularValue(psi));
    });
    const context = raster.context;
    const cropWidth = raster.width * debyeData.depth / depth;
    context.save();
    context.fillStyle = COLLAR_ZOOM_FILL;
    context.fillRect(raster.width - cropWidth, 0, cropWidth, raster.height);
    context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
    context.lineWidth = 1;
    context.strokeRect(.5, .5, raster.width - 1, raster.height - 1);
    context.strokeStyle = SCHIFFER_VISUAL_THEME.background;
    context.lineWidth = 5;
    context.strokeRect(raster.width - cropWidth + 2.5, 2.5, cropWidth - 5, raster.height - 5);
    context.strokeStyle = COLLAR_ZOOM_ACCENT;
    context.lineWidth = 2.8;
    context.strokeRect(raster.width - cropWidth + 2.5, 2.5, cropWidth - 5, raster.height - 5);
    context.restore();
    canvas.setAttribute(
      "aria-label",
      `Cylinder mode k ${collarFieldState.mode} on x from minus ${depth} to zero; its circumference is drawn at the same scale as one wavelength on the ${fold}-fold disk, and its five-unit rim collar is outlined.`
    );
  }

  function collarPatchBounds() {
    return { xMin: -5.42, xMax: .28, yMin: -3.42, yMax: 3.42 };
  }

  function collarPatchPoint(x, psi, width, height) {
    const fold = collarFieldState.fold;
    const radius = fold + x;
    const localX = radius * Math.cos(psi / fold) - fold;
    const localY = radius * Math.sin(psi / fold);
    const bounds = collarPatchBounds();
    return {
      x: (localX - bounds.xMin) / (bounds.xMax - bounds.xMin) * width,
      y: (bounds.yMax - localY) / (bounds.yMax - bounds.yMin) * height,
    };
  }

  function collarTracePatchBoundary(context, width, height) {
    context.beginPath();
    for (let index = 0; index <= 90; index++) {
      const psi = -Math.PI + index / 90 * TWO_PI;
      const point = collarPatchPoint(0, psi, width, height);
      if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 50; index++) {
      const point = collarPatchPoint(-index / 50 * debyeData.depth, Math.PI, width, height);
      context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 90; index++) {
      const psi = Math.PI - index / 90 * TWO_PI;
      const point = collarPatchPoint(-debyeData.depth, psi, width, height);
      context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 50; index++) {
      const point = collarPatchPoint(-debyeData.depth + index / 50 * debyeData.depth, -Math.PI, width, height);
      context.lineTo(point.x, point.y);
    }
    context.closePath();
  }

  function renderCollarConePatch() {
    const canvas = $("#collarConeCanvas");
    const bounds = collarPatchBounds();
    const fold = collarFieldState.fold;
    const { context, width, height } = collarRaster(canvas, (u, v) => {
      const localX = bounds.xMin + u * (bounds.xMax - bounds.xMin);
      const localY = bounds.yMax - v * (bounds.yMax - bounds.yMin);
      const radius = Math.hypot(fold + localX, localY);
      const psi = fold * Math.atan2(localY, fold + localX);
      const x = radius - fold;
      if (x < -debyeData.depth || x > 0 || Math.abs(psi) > Math.PI) return COLLAR_BACKGROUND;
      return colorFor(collarExactRadial(x) * collarAngularValue(psi));
    });
    context.save();
    collarTracePatchBoundary(context, width, height);
    context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
    context.lineWidth = 1.4;
    context.stroke();
    if (!SCHIFFER_VISUAL_THEME.paperEdition) {
      context.fillStyle = SCHIFFER_VISUAL_THEME.muted;
      context.font = SCHIFFER_VISUAL_THEME.labelFont;
      context.fillText("one sector", 10, 17);
      context.fillText(collarFieldState.mode === 0 ? "radial mode · no angular variation" : "one angular period", 10, 32);
    }
    context.restore();
    canvas.setAttribute(
      "aria-label",
      `Exact Bessel mode k ${collarFieldState.mode} on one magnified sector of an ${fold}-fold disk, from r equals N minus five to r equals N.`
    );
  }

  function collarDiskPoint(x, psi, plot) {
    const radialAmount = (collarFieldState.fold + x) / collarFieldState.fold;
    const angle = psi / collarFieldState.fold;
    return {
      x: plot.cx + plot.radius * radialAmount * Math.cos(angle),
      y: plot.cy - plot.radius * radialAmount * Math.sin(angle),
    };
  }

  function collarTraceDiskCrop(context, plot) {
    context.beginPath();
    for (let index = 0; index <= 70; index++) {
      const point = collarDiskPoint(0, -Math.PI + index / 70 * TWO_PI, plot);
      if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 30; index++) {
      const point = collarDiskPoint(-index / 30 * debyeData.depth, Math.PI, plot);
      context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 70; index++) {
      const point = collarDiskPoint(-debyeData.depth, Math.PI - index / 70 * TWO_PI, plot);
      context.lineTo(point.x, point.y);
    }
    for (let index = 1; index <= 30; index++) {
      const point = collarDiskPoint(-debyeData.depth + index / 30 * debyeData.depth, -Math.PI, plot);
      context.lineTo(point.x, point.y);
    }
    context.closePath();
  }

  function renderCollarZoomConnectors(plot) {
    const svg = $("#collarZoomConnectors");
    const laboratory = svg?.parentElement;
    const patchCanvas = $("#collarConeCanvas");
    const diskCanvas = $("#collarDiskCanvas");
    if (!svg || !laboratory || !patchCanvas || !diskCanvas || window.innerWidth <= 760) return;

    const laboratoryRect = laboratory.getBoundingClientRect();
    const patchRect = patchCanvas.getBoundingClientRect();
    const diskRect = diskCanvas.getBoundingClientRect();
    const toLaboratoryPoint = (rect, point) => ({
      x: rect.left - laboratoryRect.left + point.x,
      y: rect.top - laboratoryRect.top + point.y,
    });

    const diskTop = toLaboratoryPoint(diskRect, collarDiskPoint(0, Math.PI, plot));
    const diskBottom = toLaboratoryPoint(diskRect, collarDiskPoint(0, -Math.PI, plot));
    const patchTop = toLaboratoryPoint(
      patchRect,
      collarPatchPoint(0, Math.PI, patchRect.width, patchRect.height)
    );
    const patchBottom = toLaboratoryPoint(
      patchRect,
      collarPatchPoint(0, -Math.PI, patchRect.width, patchRect.height)
    );

    svg.setAttribute("viewBox", `0 0 ${laboratoryRect.width} ${laboratoryRect.height}`);
    [["#collarZoomConnectorTop", patchTop, diskTop], ["#collarZoomConnectorBottom", patchBottom, diskBottom]]
      .forEach(([selector, from, to]) => {
        const line = $(selector);
        line.setAttribute("x1", from.x.toFixed(2));
        line.setAttribute("y1", from.y.toFixed(2));
        line.setAttribute("x2", to.x.toFixed(2));
        line.setAttribute("y2", to.y.toFixed(2));
      });
  }

  function renderCollarDisk() {
    const canvas = $("#collarDiskCanvas");
    const wrap = canvas.parentElement;
    const cssWidth = Math.max(1, wrap.clientWidth || 300);
    const cssHeight = Math.max(1, wrap.clientHeight || 430);
    const plot = {
      cx: cssWidth * .49,
      cy: cssHeight * .51,
      radius: Math.min(cssWidth, cssHeight) * .405,
    };
    const { context, width, height } = collarRaster(canvas, (u, v) => {
      const x = (u * cssWidth - plot.cx) / plot.radius;
      const y = (plot.cy - v * cssHeight) / plot.radius;
      const q = Math.hypot(x, y);
      if (q > 1) return COLLAR_BACKGROUND;
      const theta = Math.atan2(y, x);
      const angle = collarFieldState.mode * collarFieldState.fold * theta;
      const angular = collarFieldState.mode === 0
        ? 1
        : collarFieldState.trig === "cos" ? Math.cos(angle) : Math.sin(angle);
      return colorFor(collarGlobalRadial(q) * angular);
    });
    // collarRaster and the local geometry use the same CSS dimensions.
    plot.cx = width * .49;
    plot.cy = height * .51;
    plot.radius = Math.min(width, height) * .405;
    context.save();
    context.strokeStyle = SCHIFFER_VISUAL_THEME.ink;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(plot.cx, plot.cy, plot.radius, 0, TWO_PI);
    context.stroke();
    collarTraceDiskCrop(context, plot);
    context.fillStyle = COLLAR_ZOOM_FILL;
    context.fill();
    context.strokeStyle = SCHIFFER_VISUAL_THEME.background;
    context.lineWidth = 5.5;
    context.stroke();
    context.strokeStyle = COLLAR_ZOOM_ACCENT;
    context.lineWidth = 3.2;
    context.stroke();
    if (!SCHIFFER_VISUAL_THEME.paperEdition) {
      context.fillStyle = SCHIFFER_VISUAL_THEME.muted;
      context.font = SCHIFFER_VISUAL_THEME.labelFont;
      context.fillText(`${collarFieldState.fold}-fold disk`, 10, 17);
    }
    context.restore();
    renderCollarZoomConnectors(plot);
    canvas.setAttribute(
      "aria-label",
      `Whole ${collarFieldState.fold}-fold disk carrying the exact Bessel mode of angular order ${collarFieldState.fold * collarFieldState.mode}; an outlined sector identifies the collar enlarged in the adjacent panel.`
    );
  }

  function updateCollarFieldReadouts() {
    const { fold, mode, trig } = collarFieldState;
    const angularOrder = fold * mode;
    const lambda = debyeLambdaAt(fold);
    $("#collarNValue").textContent = String(fold);
    $("#collarKValue").textContent = String(mode);
    $("#collarTrigValue").textContent = mode === 0 ? "constant" : trig;
    $("#collarAngularOrder").textContent = String(angularOrder);
    if (mode === 0) {
      setMath("#collarCylinderTitle", "u_0^{\\mathrm{cyl}}(x)", { serif: true });
      setMath("#collarConeTitle", "u_0^{\\mathrm{cone}}(r)\\propto J_0(q_Nr)", { serif: true });
      setMath("#collarDiskTitle", "\\text{radial mode, angular order }0", { serif: true });
      setMath("#collarHalfCylinderTitle", "u_0^{\\mathrm{cyl}}(x)", { serif: true });
    } else {
      setMath("#collarCylinderTitle", `u_${mode}^{\\mathrm{cyl}}\\;${trig}(${mode === 1 ? "\\theta" : `${mode}\\theta`})`, { serif: true });
      setMath("#collarConeTitle", `u_${mode}^{\\mathrm{cone}}\\;J_{${angularOrder}}(q_Nr)\\;${trig}(${mode === 1 ? "\\psi" : `${mode}\\psi`})`, { serif: true });
      setMath("#collarDiskTitle", `\\text{angular order }${angularOrder}`, { serif: true });
      setMath("#collarHalfCylinderTitle", `u_${mode}^{\\mathrm{cyl}}`, { serif: true });
    }
    setMath("#collarLambdaValue", `\\lambda_N=${lambda.toFixed(4)}`);
    if (mode === 0) {
      setMath("#collarRegimeCopy", "\\text{Radial channel: }C''+\\lambda_N C=0\\text{, with matched rim data.}", { serif: true });
    } else if (mode === 1) {
      setMath("#collarRegimeCopy", "\\text{Neumann mode: }\\partial_r u=0\\text{ at }r=N.", { serif: true });
    } else {
      $("#collarRegimeCopy").textContent = "The selected channel is evanescent in the normal direction.";
    }
    document.querySelectorAll("[data-collar-trig]").forEach((button) => {
      const active = button.dataset.collarTrig === trig;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = mode === 0;
    });
  }

  function updateCollarFieldComparison() {
    updateCollarFieldReadouts();
    renderCollarCylinder();
    renderCollarConePatch();
    renderCollarDisk();
    renderCollarHalfCylinder();
  }

  setRangeFill($("#collarNRange"));
  setRangeFill($("#collarKRange"));
  $("#collarNRange").addEventListener("input", (event) => {
    collarFieldState.fold = Number(event.target.value);
    setRangeFill(event.target);
    updateCollarFieldComparison();
  });
  $("#collarKRange").addEventListener("input", (event) => {
    collarFieldState.mode = Number(event.target.value);
    if (collarFieldState.mode === 0) collarFieldState.trig = "cos";
    setRangeFill(event.target);
    updateCollarFieldComparison();
  });
  document.querySelectorAll("[data-collar-trig]").forEach((button) => {
    button.addEventListener("click", () => {
      collarFieldState.trig = button.dataset.collarTrig;
      updateCollarFieldComparison();
    });
  });
  $("#collarFieldResetButton").addEventListener("click", () => {
    Object.assign(collarFieldState, { fold: 28, mode: 1, trig: "cos" });
    $("#collarNRange").value = collarFieldState.fold;
    $("#collarKRange").value = collarFieldState.mode;
    setRangeFill($("#collarNRange"));
    setRangeFill($("#collarKRange"));
    updateCollarFieldComparison();
  });

  let collarResizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(collarResizeTimer);
    collarResizeTimer = setTimeout(updateCollarFieldComparison, 140);
  });
  updateCollarFieldComparison();

  function debyeSeries(mode) {
    const exact = [];
    const limiting = [];
    const lambda = debyeLambdaAt(debyeState.radius);
    const omega = Math.sqrt(lambda - 1);
    const alpha = mode >= 2 ? Math.sqrt(mode * mode - lambda) : 0;
    let maxMismatch = 0;
    const samples = 420;
    for (let index = 0; index < samples; index++) {
      const x = -debyeData.depth + index / (samples - 1) * debyeData.depth;
      const bessel = debyeInterpolateRows(debyeData.profiles[String(mode)], debyeState.radius, x);
      const cylinder = mode === 1
        ? Math.cos(omega * x)
        : Math.exp(alpha * x);
      exact.push({ x, value: bessel });
      limiting.push({ x, value: cylinder });
      maxMismatch = Math.max(maxMismatch, Math.abs(bessel - cylinder));
    }
    return { mode, exact, limiting, omega, alpha, maxMismatch };
  }

  function debyeCanvasMetrics() {
    const canvas = $("#debyeCanvas");
    const wrap = $("#debyeCanvasWrap");
    const width = Math.max(1, wrap.clientWidth || 900);
    const height = Math.max(1, wrap.clientHeight || 550);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { canvas, context, width, height };
  }

  function debyeDrawGrid(context, plot, yTicks, yMap) {
    context.save();
    context.strokeStyle = MODES_COLORS.grid;
    context.fillStyle = MODES_COLORS.faint;
    context.lineWidth = 1;
    context.font = SCHIFFER_VISUAL_THEME.labelFont;
    yTicks.forEach(({ value, label }) => {
      const y = yMap(value);
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.left + plot.width, y);
      context.stroke();
      context.fillText(label, plot.left + 3, y - 4);
    });
    [0, .25, .5, .75, 1].forEach((amount) => {
      const x = plot.left + amount * plot.width;
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.top + plot.height);
      context.stroke();
    });
    context.restore();
  }

  function debyeDrawCurve(context, points, xMap, yMap, color, width) {
    context.save();
    context.beginPath();
    points.forEach((point, index) => {
      const x = xMap(point.x);
      const y = yMap(point.value);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
    context.restore();
  }

  function debyeDrawPanel(context, rect, series) {
    const isWave = series.mode === 1;
    const plot = {
      left: rect.left + 14,
      top: rect.top + 77,
      width: rect.width - 28,
      height: rect.height - 119,
    };
    const xMap = (x) => plot.left + (x + debyeData.depth) / debyeData.depth * plot.width;
    let yMap;
    let yTicks;
    if (isWave) {
      const maximum = Math.max(1, ...series.exact.map((point) => Math.abs(point.value)), ...series.limiting.map((point) => Math.abs(point.value)));
      const yBound = maximum * 1.07;
      yMap = (value) => plot.top + (yBound - value) / (2 * yBound) * plot.height;
      yTicks = [-1, 0, 1].map((value) => ({ value, label: String(value) }));
    } else {
      const yMaximum = 1.04;
      yMap = (value) => plot.top + (yMaximum - value) / yMaximum * plot.height;
      yTicks = [0, .5, 1].map((value) => ({ value, label: value.toFixed(value === .5 ? 1 : 0) }));
    }

    context.save();
    context.fillStyle = SCHIFFER_VISUAL_THEME.panel;
    context.fillRect(rect.left, rect.top, rect.width, rect.height);
    if (!SCHIFFER_VISUAL_THEME.paperEdition) {
      context.strokeStyle = SCHIFFER_VISUAL_THEME.line;
      context.strokeRect(rect.left + .5, rect.top + .5, rect.width - 1, rect.height - 1);
    }
    context.fillStyle = SCHIFFER_VISUAL_THEME.ink;
    context.font = SCHIFFER_VISUAL_THEME.labelFont;
    context.fillText(isWave ? "OSCILLATORY MODE" : "EVANESCENT MODE", rect.left + 14, rect.top + 20);
    context.restore();

    debyeDrawGrid(context, plot, yTicks, yMap);
    context.save();
    context.beginPath();
    context.rect(plot.left, plot.top, plot.width, plot.height);
    context.clip();
    debyeDrawCurve(context, series.exact, xMap, yMap, MODES_COLORS.cyan, 2.45);
    debyeDrawCurve(context, series.limiting, xMap, yMap, MODES_COLORS.orange, 1.75);
    context.restore();
  }

  function updateDebyeCanvasFormulas(panels, seriesList) {
    const formulaColor = SCHIFFER_VISUAL_THEME.muted;
    seriesList.forEach((series, index) => {
      const panel = panels[index];
      const plotLeft = panel.left + 14;
      const plotTop = panel.top + 77;
      const plotWidth = panel.width - 28;
      const plotHeight = panel.height - 119;
      setCanvasFormula("#debyeCanvasWrap", `debyeModeFormula${series.mode}`, `k=${series.mode}`, {
        left: panel.left + 14, top: panel.top + 25, color: formulaColor,
      });
      if (SCHIFFER_VISUAL_THEME.paperEdition) {
        removeCanvasFormula(`debyeRateFormula${series.mode}`);
        removeCanvasFormula(`debyeErrorFormula${series.mode}`);
      } else {
        setCanvasFormula("#debyeCanvasWrap", `debyeRateFormula${series.mode}`, series.mode === 1
          ? `\\omega_R=${series.omega.toFixed(4)},\\quad C'(0)=0`
          : `\\alpha_${series.mode}=${series.alpha.toFixed(4)},\\quad e^{\\alpha_${series.mode}x}`, {
          left: panel.left + 14, top: panel.top + 39, color: formulaColor,
        });
        setCanvasFormula("#debyeCanvasWrap", `debyeErrorFormula${series.mode}`, `\\lVert B-C\\rVert_\\infty=${series.maxMismatch.toExponential(1)}`, {
          left: panel.left + panel.width - 14, top: panel.top + 54,
          transform: "translateX(-100%)", color: MODES_COLORS.orange,
        });
      }
      setCanvasFormula("#debyeCanvasWrap", `debyeLeftFormula${series.mode}`, "r_0-5", {
        left: plotLeft, top: plotTop + plotHeight + 5, color: formulaColor,
      });
      setCanvasFormula("#debyeCanvasWrap", `debyeRightFormula${series.mode}`, "r_0", {
        left: plotLeft + plotWidth, top: plotTop + plotHeight + 5,
        transform: "translateX(-100%)", color: formulaColor,
      });
    });
  }

  function renderDebyeComparison() {
    const { canvas, context, width, height } = debyeCanvasMetrics();
    context.clearRect(0, 0, width, height);
    context.fillStyle = SCHIFFER_VISUAL_THEME.background;
    context.fillRect(0, 0, width, height);
    const compact = width < 620;
    const panels = [];
    if (compact) {
      const gap = 12;
      const panelHeight = (height - gap * 4) / 3;
      for (let index = 0; index < 3; index++) panels.push({ left: 12, top: gap + index * (panelHeight + gap), width: width - 24, height: panelHeight });
    } else {
      const gap = 14;
      const panelWidth = (width - gap * 4) / 3;
      for (let index = 0; index < 3; index++) panels.push({ left: gap + index * (panelWidth + gap), top: 18, width: panelWidth, height: height - 36 });
    }
    const seriesList = [1, 2, 3].map((mode) => debyeSeries(mode));
    seriesList.forEach((series, index) => debyeDrawPanel(context, panels[index], series));
    updateDebyeCanvasFormulas(panels, seriesList);
    canvas.setAttribute("aria-label", `At boundary radius ${debyeState.radius.toFixed(2)}, exact regular Bessel modes are compared on a linear scale with their cylinder limits between r zero minus five and r zero. The k equals one Bessel and cylinder profiles both satisfy the Neumann condition at the rim.`);
  }

  function updateDebyeReadouts() {
    const lambda = debyeLambdaAt(debyeState.radius);
    const rho = debyeRhoAt(debyeState.radius);
    const alpha2 = Math.sqrt(4 - lambda);
    const alpha3 = Math.sqrt(9 - lambda);
    $("#debyeOrderValue").textContent = debyeState.radius.toFixed(2);
    setMath("#debyeLambdaValue", `\\lambda_R=${lambda.toFixed(5)}`);
    setMath("#debyePhaseValue", "J_R'(\\rho_R)=0");
    setMath("#debyeBetaValue", `\\rho_R=${rho.toFixed(5)}`);
    $("#debyeDecayValue").textContent = `${alpha2.toFixed(4)}, ${alpha3.toFixed(4)}`;
    $("#debyePlotState").textContent = "exact Bessel samples · Neumann data matched at the boundary";
  }

  function updateDebyeComparison() {
    updateDebyeReadouts();
    renderDebyeComparison();
  }

  function stopDebyePlayback() {
    debyeState.playing = false;
    if (debyeState.playFrame) cancelAnimationFrame(debyeState.playFrame);
    debyeState.playFrame = null;
    $("#debyePlayIcon").textContent = "▶";
    setMath("#debyePlayLabel", debyeState.radius > debyeData.rMax - .01
      ? "\\text{Repeat}"
      : "\\text{Animate}");
  }

  function toggleDebyePlayback() {
    if (debyeState.playing) { stopDebyePlayback(); return; }
    if (debyeState.radius > debyeData.rMax - .01) debyeState.radius = debyeData.rMin;
    debyeState.playing = true;
    $("#debyePlayIcon").textContent = "Ⅱ";
    $("#debyePlayLabel").textContent = "Pause";
    const startRadius = debyeState.radius;
    const start = performance.now();
    let lastRender = 0;
    const duration = Math.max(900, 8200 * (debyeData.rMax - startRadius) / (debyeData.rMax - debyeData.rMin));
    const tick = (now) => {
      if (!debyeState.playing) return;
      const amount = Math.min(1, (now - start) / duration);
      debyeState.radius = interpolateNumber(startRadius, debyeData.rMax, amount);
      $("#debyeOrderRange").value = debyeState.radius;
      setRangeFill($("#debyeOrderRange"));
      if (now - lastRender > 45 || amount >= 1) { updateDebyeComparison(); lastRender = now; }
      if (amount >= 1) { stopDebyePlayback(); return; }
      debyeState.playFrame = requestAnimationFrame(tick);
    };
    debyeState.playFrame = requestAnimationFrame(tick);
  }

  setRangeFill($("#debyeOrderRange"));
  $("#debyeOrderRange").addEventListener("input", (event) => {
    stopDebyePlayback();
    debyeState.radius = Number(event.target.value);
    setRangeFill(event.target);
    updateDebyeComparison();
  });
  $("#debyePlayButton").addEventListener("click", toggleDebyePlayback);
  $("#debyeResetButton").addEventListener("click", () => {
    stopDebyePlayback();
    debyeState.radius = debyeData.rReference;
    $("#debyeOrderRange").value = debyeState.radius;
    setRangeFill($("#debyeOrderRange"));
    updateDebyeComparison();
  });

  let debyeResizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(debyeResizeTimer);
    debyeResizeTimer = setTimeout(renderDebyeComparison, 140);
  });
  updateDebyeComparison();
}
