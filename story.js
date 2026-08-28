(() => {
  "use strict";

  const data = window.CONE_NUMERICS;
  if (!data) return;
  const crossingData = window.SCHIFFER_ABUNDANCE_DATA;
  const select = (selector) => document.querySelector(selector);
  const setMath = (elementOrSelector, source, options) => window.SchifferMath?.render(elementOrSelector, source, options);
  const setFormula = (element, source, options) => {
    if (!element || element.dataset.tex === source) return;
    element.dataset.tex = source;
    setMath(element, source, options);
  };
  const setCanvasFormula = (wrapSelector, id, source, position = {}) => {
    const wrap = select(wrapSelector);
    if (!wrap) return null;
    let label = document.getElementById(id);
    if (!label) {
      label = document.createElement("span");
      label.id = id;
      label.className = "canvas-tex-label";
      label.setAttribute("aria-hidden", "true");
      wrap.appendChild(label);
    }
    setFormula(label, source, { serif: true });
    ["left", "right", "top", "bottom"].forEach((property) => {
      label.style[property] = position[property] === undefined ? "" : `${position[property]}px`;
    });
    label.style.color = position.color || "";
    label.style.transform = position.transform || "";
    return label;
  };
  const siteToc = select(".site-toc");
  const tocRailQuery = window.matchMedia("(min-width: 1280px)");
  const syncTocMode = () => {
    if (siteToc) siteToc.open = tocRailQuery.matches;
  };
  syncTocMode();
  tocRailQuery.addEventListener?.("change", syncTocMode);
  siteToc?.querySelector("summary")?.addEventListener("click", (event) => {
    if (!tocRailQuery.matches) return;
    event.preventDefault();
    siteToc.open = true;
  });
  siteToc?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!tocRailQuery.matches) siteToc.open = false;
    });
  });
  const TAU = Math.PI * 2;
  const GEOMETRY_PROFILE_PHASE = -Math.PI / 2;
  const visualTheme = window.SCHIFFER_VISUAL_THEME || {
    paperEdition: false,
    background: "#101b20",
    backgroundAlt: "#17303a",
    ink: "#f1eee5",
    line: "rgba(241,238,229,.12)",
    lineStrong: "rgba(241,238,229,.34)",
    muted: "rgba(241,238,229,.42)",
    panel: "rgba(12,22,27,.65)",
    tooltip: "rgba(10,19,23,.96)",
    labelFont: "11px DM Mono, monospace",
    titleFont: "italic 400 25px Georgia, serif",
    serifFamily: "Georgia, serif",
  };
  const paperEdition = Boolean(visualTheme.paperEdition || document.body.classList.contains("tufte-site"));
  const colors = {
    ink: visualTheme.background,
    paper: visualTheme.ink,
    orange: "#ff7449",
    cyan: "#4da2a3",
    grid: visualTheme.line,
    faint: visualTheme.muted,
    panel: visualTheme.panel,
    tooltip: visualTheme.tooltip,
  };

  // The two model geometries in Section 3 have independent, manually operated
  // branch parameters.  They show the leading geometry of the local branches;
  // the slider endpoints are labelled ±epsilon rather than assigned a false
  // absolute normalization.
  const worldSection = select("#borrow-flexibility");
  const cylinderDomainBack = select(".cylinder-domain-back");
  const cylinderDomainFront = select(".cylinder-domain-front");
  const cylinderBoundaryBack = select(".cylinder-boundary-back");
  const cylinderBoundaryFront = select(".cylinder-boundary-front");
  const cylinderBranchRange = select("#cylinderBranchRange");
  const cylinderBranchValue = select("#cylinderBranchValue");
  const sphereDomainFill = select(".sphere-domain-fill");
  const sphereBoundaryBack = select(".sphere-boundary-back");
  const sphereBoundaryFront = select(".sphere-boundary-front");
  const sphereDomainLabel = select(".world-domain-label.dark-label");
  const sphereBranchRange = select("#sphereBranchRange");
  const sphereBranchValue = select("#sphereBranchValue");

  function worldPath(points, close = false) {
    const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("");
    return close ? `${path}Z` : path;
  }

  function cylinderBoundaryHalf(baseX, start, end, branchAmount) {
    const points = [];
    for (let index = 0; index <= 56; index++) {
      const theta = start + (end - start) * index / 56;
      points.push({
        x: baseX + 37 * Math.cos(theta) + 18 * branchAmount * Math.cos(theta - .65),
        y: 150 + 88 * Math.sin(theta),
      });
    }
    return points;
  }

  function renderCylinderBifurcation(branchAmount) {
    if (!cylinderDomainBack || !cylinderDomainFront || !cylinderBoundaryBack
        || !cylinderBoundaryFront) return;
    const leftFront = cylinderBoundaryHalf(165, -Math.PI / 2, Math.PI / 2, branchAmount);
    const rightFront = cylinderBoundaryHalf(355, -Math.PI / 2, Math.PI / 2, branchAmount);
    const leftBack = cylinderBoundaryHalf(165, Math.PI / 2, 3 * Math.PI / 2, branchAmount);
    const rightBack = cylinderBoundaryHalf(355, Math.PI / 2, 3 * Math.PI / 2, branchAmount);
    cylinderDomainFront.setAttribute("d", worldPath([...leftFront, ...[...rightFront].reverse()], true));
    cylinderDomainBack.setAttribute("d", worldPath([...leftBack, ...[...rightBack].reverse()], true));
    cylinderBoundaryFront.setAttribute("d", `${worldPath(leftFront)}${worldPath(rightFront)}`);
    cylinderBoundaryBack.setAttribute("d", `${worldPath(leftBack)}${worldPath(rightBack)}`);
  }

  function renderSphereBifurcation(branchAmount) {
    if (!sphereDomainFill || !sphereBoundaryBack || !sphereBoundaryFront) return;
    const sphereFront = [];
    const sphereBack = [];
    const sphereRadius = 111;
    // The paper bifurcates from cos(theta) > a_* with a_* about 0.477.
    // We view the north-pole cap obliquely but from within it, so its projected
    // image is a closed domain inside the sphere rather than a band cut along
    // the equator.  The angular amplitude is deliberately enlarged for sight.
    const crossingHeight = .477;
    const baseLatitude = Math.asin(crossingHeight);
    const displayedAngularAmplitude = .095;
    const equatorMinorRadius = 85;
    const projectedPoleRadius = Math.sqrt(sphereRadius ** 2 - equatorMinorRadius ** 2);
    for (let index = 0; index <= 96; index++) {
      const theta = -Math.PI / 2 + Math.PI * index / 96;
      const equatorEnvelope = Math.cos(theta);
      // cos(8 theta) gives four waves on each projected half, hence eight on
      // the complete boundary.  Even at the displayed endpoints the latitude
      // remains positive, so the domain stays strictly in the half-sphere.
      const latitude = baseLatitude
        - displayedAngularAmplitude * branchAmount * Math.cos(8 * theta);
      const commonLatitudeShift = -projectedPoleRadius * Math.sin(latitude);
      const projectedEquatorDepth = equatorMinorRadius * Math.cos(latitude) * equatorEnvelope;
      const x = 260 + sphereRadius * Math.cos(latitude) * Math.sin(theta);
      sphereFront.push({ x, y: 143 + projectedEquatorDepth + commonLatitudeShift });
      sphereBack.push({ x, y: 143 - projectedEquatorDepth + commonLatitudeShift });
    }
    const frontPath = worldPath(sphereFront);
    sphereDomainFill.setAttribute("d", worldPath([...sphereFront, ...[...sphereBack].reverse()], true));
    sphereBoundaryFront.setAttribute("d", frontPath);
    sphereBoundaryBack.setAttribute("d", worldPath(sphereBack));
    if (sphereDomainLabel) {
      sphereDomainLabel.setAttribute("x", "260");
      sphereDomainLabel.setAttribute("y", "107");
    }
  }

  function renderBranchValue(output, amount) {
    if (!output) return;
    const source = Math.abs(amount) < .005
      ? "s=0"
      : `s=${amount > 0 ? "+" : ""}${amount.toFixed(2)}\\varepsilon`;
    setMath(output, source);
  }

  function bindWorldBranch(range, output, render) {
    if (!range) return;
    const update = () => {
      const amount = Number(range.value);
      fillRange(range);
      renderBranchValue(output, amount);
      render(amount);
    };
    range.addEventListener("input", update);
    update();
  }

  if (worldSection) {
    bindWorldBranch(cylinderBranchRange, cylinderBranchValue, renderCylinderBifurcation);
    bindWorldBranch(sphereBranchRange, sphereBranchValue, renderSphereBifurcation);
  }

  function fillRange(input) {
    const amount = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty("--value", `${amount * 100}%`);
  }

  function canvasMetrics(canvasSelector, wrapSelector, minimumHeight) {
    const canvas = select(canvasSelector);
    const wrap = select(wrapSelector);
    // The bitmap and its CSS box must have the same aspect ratio.  Earlier we
    // clamped the backing store to a minimum size while CSS was free to make
    // the wrapper smaller; the browser then independently scaled x and y and
    // visibly crushed circles and cone sections at narrow breakpoints.
    const width = Math.max(1, Math.round(wrap.clientWidth || canvas.clientWidth || 900));
    const height = Math.max(1, Math.round(wrap.clientHeight || canvas.clientHeight || minimumHeight));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { canvas, context, width, height };
  }

  function roundedPanel(context, x, y, width, height, radius = 2) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function drawFrameLabel(context, width, eyebrow, title, detail) {
    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = colors.orange;
    context.font = visualTheme.labelFont;
    context.fillText(eyebrow.toUpperCase(), 24, 26);
    context.fillStyle = colors.paper;
    let titleSize = width < 520 ? 19 : 25;
    context.font = `italic 400 ${titleSize}px ${visualTheme.serifFamily}`;
    while (titleSize > 15 && context.measureText(title).width > width - 48) {
      titleSize -= 1;
      context.font = `italic 400 ${titleSize}px ${visualTheme.serifFamily}`;
    }
    context.fillText(title, 24, 54);
    if (width >= 520) {
      context.fillStyle = colors.faint;
      context.font = visualTheme.labelFont;
      context.textAlign = "right";
      context.fillText(detail, width - 24, 27);
    }
    context.restore();
  }

  function drawCenteredCaption(context, text, centerX, topY, maxWidth, lineHeight = 14) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.forEach((entry, index) => context.fillText(entry, centerX, topY + index * lineHeight));
  }

  function drawDiskFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "01 / quotient", "Keep one angular wavelength", "N = 28 · sector angle 2π/28");
    const radius = Math.min(width * .28, height * .35);
    const cx = width * .5;
    const cy = height * .55;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "#e36d4b");
    gradient.addColorStop(.55, "#d8d3bb");
    gradient.addColorStop(1, "#337e83");
    context.fillStyle = gradient;
    context.beginPath(); context.arc(cx, cy, radius, 0, TAU); context.fill();
    context.strokeStyle = colors.paper; context.lineWidth = 2;
    context.beginPath(); context.arc(cx, cy, radius, 0, TAU); context.stroke();
    const halfAngle = Math.PI / 28;
    context.beginPath();
    context.moveTo(cx, cy);
    context.arc(cx, cy, radius, -halfAngle, halfAngle);
    context.closePath();
    context.fillStyle = "rgba(77,162,163,.8)";
    context.fill();
    context.strokeStyle = colors.orange; context.lineWidth = 1.5; context.stroke();
    context.fillStyle = colors.paper;
    context.font = visualTheme.labelFont;
    context.fillText("one quotient sector", cx + radius * .62, cy - 22);
    context.fillStyle = colors.faint;
    context.fillText("one sector determines all 28 copies", cx - radius, cy + radius + 31);
    context.restore();
  }

  function drawConeFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "02 / cone quotient", "Identify the sides of one fundamental sector", "boundary circumference 2π · cone parameter R");
    const left = width * .13;
    const right = width * .87;
    const cy = height * .56;
    const rimHalf = Math.min(84, height * .22);
    const gradient = context.createLinearGradient(left, 0, right, 0);
    gradient.addColorStop(0, "rgba(77,162,163,.08)");
    gradient.addColorStop(.76, "rgba(77,162,163,.34)");
    gradient.addColorStop(1, "rgba(255,116,73,.42)");
    context.beginPath();
    context.moveTo(left, cy);
    context.lineTo(right, cy - rimHalf);
    context.lineTo(right, cy + rimHalf);
    context.closePath();
    context.fillStyle = gradient; context.fill();
    context.strokeStyle = colors.paper; context.lineWidth = 1.7; context.stroke();
    context.beginPath();
    context.ellipse(right, cy, 12, rimHalf, 0, 0, TAU);
    context.strokeStyle = colors.orange; context.lineWidth = 2.2; context.stroke();
    const collarLeft = right - (right - left) * 5 / 28;
    context.fillStyle = "rgba(255,116,73,.14)";
    context.fillRect(collarLeft, cy - rimHalf, right - collarLeft, rimHalf * 2);
    context.strokeStyle = colors.cyan; context.setLineDash([4, 5]);
    context.beginPath(); context.moveTo(collarLeft, cy - rimHalf); context.lineTo(collarLeft, cy + rimHalf); context.stroke();
    context.setLineDash([]);
    context.fillStyle = colors.paper; context.font = visualTheme.labelFont;
    context.fillText("cone point", left - 7, cy + 20);
    context.fillText("five-unit collar", collarLeft + 7, cy - rimHalf - 13);
    context.fillStyle = colors.faint;
    context.fillText("R ≈ 28", (left + right) / 2 - 18, cy + rimHalf + 29);
    context.restore();
  }

  function landingWall(psi) {
    const coefficients = data.records.at(-1).h;
    let value = 0;
    coefficients.forEach((coefficient, mode) => { value += coefficient * Math.cos(mode * psi); });
    return value;
  }

  function lerp(left, right, amount) { return left + (right - left) * amount; }
  function ease(amount) {
    const clamped = Math.max(0, Math.min(1, amount));
    return clamped * clamped * (3 - 2 * clamped);
  }

  function drawNfoldDisk(context, width, height, options = {}) {
    const cx = options.cx ?? width * .5;
    const cy = options.cy ?? height * .54;
    const radius = options.radius ?? Math.min(width * .27, height * .34);
    const opacity = options.opacity ?? 1;
    const selection = options.selection ?? 0;
    const wiggle = options.wiggle ?? 0;
    const divisions = options.divisions ?? 1;
    const copies = 28;
    const samplesPerCopy = 7;
    context.save(); context.globalAlpha *= opacity;

    for (let index = 0; index < copies * samplesPerCopy; index++) {
      const a0 = index / (copies * samplesPerCopy) * TAU;
      const a1 = (index + 1.03) / (copies * samplesPerCopy) * TAU;
      const middle = (a0 + a1) / 2;
      const psi = copies * middle + GEOMETRY_PROFILE_PHASE;
      const value = Math.cos(psi);
      const localRadius = radius * (1 - wiggle * landingWall(psi) / 28);
      context.beginPath(); context.moveTo(cx, cy);
      context.lineTo(cx + localRadius * Math.cos(a0), cy + localRadius * Math.sin(a0));
      context.lineTo(cx + localRadius * Math.cos(a1), cy + localRadius * Math.sin(a1));
      context.closePath();
      context.fillStyle = value > 0
        ? `rgba(255,116,73,${.19 + .18 * value})`
        : `rgba(77,162,163,${.21 - .22 * value})`;
      context.fill();
    }

    const halfAngle = Math.PI / copies;
    if (selection > 0) {
      context.beginPath(); context.moveTo(cx, cy);
      context.lineTo(cx + radius * Math.cos(-halfAngle), cy + radius * Math.sin(-halfAngle));
      context.arc(cx, cy, radius, -halfAngle, halfAngle);
      context.closePath(); context.fillStyle = `rgba(255,116,73,${.08 + .24 * selection})`; context.fill();
      context.strokeStyle = colors.orange; context.lineWidth = 2.4; context.stroke();
    }

    if (divisions > 0) {
      for (let index = 0; index < copies; index++) {
        const startAngle = (index - .5) / copies * TAU;
        const endAngle = (index + .5) / copies * TAU;
        context.beginPath(); context.moveTo(cx, cy); context.arc(cx, cy, radius, startAngle, endAngle); context.closePath();
        context.fillStyle = index % 2
          ? `rgba(255,116,73,${.018 * divisions})`
          : `rgba(77,162,163,${.024 * divisions})`;
        context.fill();
        const angle = (index + .5) / copies * TAU;
        context.beginPath(); context.moveTo(cx, cy);
        context.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        context.strokeStyle = index % 2
          ? `rgba(255,116,73,${.12 + .18 * divisions})`
          : `rgba(77,162,163,${.12 + .18 * divisions})`;
        context.lineWidth = .7; context.stroke();
      }
    }

    context.beginPath();
    for (let index = 0; index <= 900; index++) {
      const angle = index / 900 * TAU;
      const localRadius = radius * (1 - wiggle * landingWall(copies * angle + GEOMETRY_PROFILE_PHASE) / 28);
      const x = cx + localRadius * Math.cos(angle); const y = cy + localRadius * Math.sin(angle);
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath(); context.strokeStyle = colors.paper; context.lineWidth = 2; context.stroke();
    if (options.showCaption !== false) {
      context.fillStyle = colors.faint; context.font = visualTheme.labelFont; context.textAlign = "center";
      context.fillText("the same angular profile repeats N times", cx, cy + radius + 34);
    }
    context.restore();
  }

  // One material sheet is used from the selected planar sector to the final
  // planar lift. Its material coordinates are radial∈[0,1] and angular∈[-1,1].
  // Changing `fold`, `tip`, and `wave` changes only the embedding of those
  // points, so no renderer handoff can move the surface by a pixel.
  function geometrySheetState(width, height, options = {}) {
    const tip = options.tip ?? width * .16;
    const right = options.right ?? width * .84;
    const surfaceLeft = options.surfaceLeft ?? Math.max(-width * .12, tip);
    const length = right - tip;
    const referenceLength = width * .68;
    return {
      tip,
      right,
      length,
      cy: height * .54,
      half: options.half ?? Math.min(118, height * .23),
      fold: options.fold ?? 1,
      // `cylinder` changes the embedding, not the material coordinates.  At
      // one, every longitudinal generator is parallel and every transverse
      // section has the same radius: this is an exact cylinder rather than a
      // cone whose tip merely happens to be outside the viewport.
      cylinder: options.cylinder ?? 0,
      axisLeft: options.axisLeft ?? tip,
      flatOpening: options.flatOpening ?? Math.PI / 28,
      wave: options.wave ?? 0,
      // The cone order grows in proportion to its displayed radial length.
      // Consequently length / order is a fixed pixels-per-radial-unit scale
      // during the cone-to-cylinder limit.  An explicit order is supplied
      // only when the already constructed finite sector is moved or resized.
      order: options.order ?? 28 * length / referenceLength,
      rimDepth: 10,
      radialStart: Math.max(0, Math.min(.985, (surfaceLeft - tip) / (right - tip))),
    };
  }

  function geometrySheetPoint(sheet, radial, angular, deformed = true) {
    const theta = Math.PI * angular;
    const wall = deformed ? sheet.wave * landingWall(theta + GEOMETRY_PROFILE_PHASE) : 0;
    // h(psi) is a displacement in radial units.  Dividing by the current
    // order, rather than always by 28, keeps its displayed radial amplitude
    // fixed while the cone point recedes to the half-cylinder limit.
    const materialRadius = radial * (1 - wall / sheet.order);
    const flatAngle = sheet.flatOpening * angular;
    const flatX = sheet.tip + materialRadius * sheet.length * Math.cos(flatAngle);
    const flatY = sheet.cy + materialRadius * sheet.length * Math.sin(flatAngle);
    const coneX = sheet.tip + materialRadius * (sheet.length + sheet.rimDepth * Math.cos(theta));
    const coneY = sheet.cy + materialRadius * sheet.half * Math.sin(theta);
    const cylinderLength = sheet.right - sheet.axisLeft;
    const wallPixels = cylinderLength / 28;
    const cylinderX = sheet.axisLeft
      + radial * cylinderLength
      - radial * wall * wallPixels
      + sheet.rimDepth * Math.cos(theta);
    const cylinderY = sheet.cy + sheet.half * Math.sin(theta);
    const foldedX = lerp(coneX, cylinderX, sheet.cylinder);
    const foldedY = lerp(coneY, cylinderY, sheet.cylinder);
    return {
      x: lerp(flatX, foldedX, sheet.fold),
      y: lerp(flatY, foldedY, sheet.fold),
    };
  }

  function geometryStripColor(angular, depth, fold) {
    const value = Math.cos(Math.PI * angular + GEOMETRY_PROFILE_PHASE);
    const alpha = .2 + .1 * Math.abs(value) + .055 * fold * Math.max(0, depth);
    return value >= 0
      ? `rgba(255,116,73,${alpha})`
      : `rgba(77,162,163,${alpha + .015})`;
  }

  function drawGeometrySheet(context, sheet, options = {}) {
    const opacity = options.opacity ?? 1;
    if (opacity <= .0001) return;
    const seamOpacity = options.seamOpacity ?? 1;
    const stripCount = 40;
    const strips = [];
    for (let index = 0; index < stripCount; index++) {
      const a0 = -1 + 2 * index / stripCount;
      const a1 = -1 + 2 * (index + 1) / stripCount;
      strips.push({ a0, a1, depth: Math.cos(Math.PI * (a0 + a1) / 2) });
    }
    strips.sort((left, right) => left.depth - right.depth);

    context.save();
    context.globalAlpha *= opacity;
    strips.forEach((strip) => {
      const p00 = geometrySheetPoint(sheet, sheet.radialStart, strip.a0);
      const p10 = geometrySheetPoint(sheet, 1, strip.a0);
      const p11 = geometrySheetPoint(sheet, 1, strip.a1);
      const p01 = geometrySheetPoint(sheet, sheet.radialStart, strip.a1);
      context.beginPath();
      context.moveTo(p00.x, p00.y); context.lineTo(p10.x, p10.y);
      context.lineTo(p11.x, p11.y); context.lineTo(p01.x, p01.y);
      context.closePath();
      context.fillStyle = geometryStripColor((strip.a0 + strip.a1) / 2, strip.depth, sheet.fold);
      context.fill();
    });

    for (let index = 1; index < 12; index++) {
      const angular = -1 + 2 * index / 12;
      const start = geometrySheetPoint(sheet, sheet.radialStart, angular);
      const end = geometrySheetPoint(sheet, 1, angular);
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y);
      context.strokeStyle = index % 2 ? colors.grid : "rgba(77,162,163,.28)";
      context.lineWidth = .8; context.stroke();
    }

    for (let radialIndex = 1; radialIndex <= 7; radialIndex++) {
      const radial = lerp(sheet.radialStart, 1, radialIndex / 7);
      context.beginPath();
      for (let index = 0; index <= 160; index++) {
        const point = geometrySheetPoint(sheet, radial, -1 + 2 * index / 160);
        if (!index) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = radialIndex % 2 ? "rgba(255,116,73,.28)" : colors.grid;
      context.lineWidth = radialIndex === 7 ? 1.25 : .8; context.stroke();
    }

    if (sheet.wave > .001) {
      context.beginPath();
      for (let index = 0; index <= 280; index++) {
        const point = geometrySheetPoint(sheet, 1, -1 + 2 * index / 280, false);
        if (!index) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = `rgba(77,162,163,${.7 * sheet.wave})`;
      context.setLineDash([4, 5]); context.lineWidth = 1.2; context.stroke(); context.setLineDash([]);
    }

    context.beginPath();
    for (let index = 0; index <= 400; index++) {
      const point = geometrySheetPoint(sheet, 1, -1 + 2 * index / 400);
      if (!index) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = colors.paper; context.lineWidth = 2.4;
    context.shadowColor = sheet.wave > .001 ? colors.orange : colors.cyan;
    context.shadowBlur = 7; context.stroke(); context.shadowBlur = 0;

    if (seamOpacity > .001) {
      [-1, 1].forEach((angular) => {
        const start = geometrySheetPoint(sheet, sheet.radialStart, angular);
        const end = geometrySheetPoint(sheet, 1, angular);
        context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y);
        context.strokeStyle = `rgba(77,162,163,${seamOpacity})`;
        context.lineWidth = 2.2; context.stroke();
      });
    }
    context.restore();
  }

  function drawFoldingSector(context, width, height, amount) {
    const t = Math.max(0, Math.min(1, amount));
    const zoom = ease(t / .5);
    const discard = ease((t - .3) / .25);
    const materialOpacity = ease((t - .12) / .2);
    const fold = ease((t - .55) / .45);
    const fullDiskRadius = Math.min(width * .27, height * .34);
    const diskCx = lerp(width * .5, width * .16, zoom);
    const diskRadius = lerp(fullDiskRadius, width * .68, zoom);
    const targetHalf = Math.min(118, height * .23);

    if (discard < .999) {
      drawNfoldDisk(context, width, height, {
        cx: diskCx,
        cy: height * .54,
        radius: diskRadius,
        selection: 1,
        divisions: 1,
        opacity: 1 - discard,
        showCaption: false,
      });
    }

    const sheet = geometrySheetState(width, height, {
      tip: diskCx,
      right: diskCx + diskRadius,
      // Until folding begins this is exactly the selected disk sector: the
      // same centre, radius, and opening angle.  The display ellipse is made
      // taller only while the material sector is folded into the cone.
      half: lerp(diskRadius * Math.sin(Math.PI / 28), targetHalf, fold),
      flatOpening: Math.PI / 28,
      fold,
      order: 28,
    });
    drawGeometrySheet(context, sheet, { opacity: materialOpacity });
  }

  function drawConeCylinder(context, width, height, cylinderAmount, waveAmount, returning = false) {
    const t = ease(cylinderAmount);
    const tip = lerp(width * .16, width * .08, t);
    const sheet = geometrySheetState(width, height, {
      tip,
      right: width * .84,
      surfaceLeft: tip,
      half: Math.min(118, height * .23),
      fold: 1,
      cylinder: t,
      axisLeft: width * .08,
      wave: waveAmount,
    });
    drawGeometrySheet(context, sheet);

  }

  function drawSectorFan(context, sheet, amount) {
    const fan = ease(amount);
    const copies = 28;
    const seamOpacity = 1 - ease((fan - .72) / .28);
    const halfOpening = Math.PI / copies;

    // Copy zero remains fixed.  The adjacent material sectors unfold in
    // order, two at a time, and every active copy moves as one rigid piece.
    // In particular its boundary profile never slides through the sector.
    drawGeometrySheet(context, sheet, { seamOpacity });
    const sequentialProgress = fan * 14;
    for (let distance = 1; distance <= 14; distance++) {
      const local = Math.max(0, Math.min(1, sequentialProgress - (distance - 1)));
      if (local <= .0001) continue;
      const travel = ease(local);
      const opacity = ease(local / .16);
      const sides = distance === 14 ? [1] : [-1, 1];
      sides.forEach((side) => {
        // The new copy begins on top of the preceding copy and rotates through
        // one sector angle until the two radial sides agree.
        const rotation = side * 2 * halfOpening * (distance - 1 + travel);
        context.save();
        context.translate(sheet.tip, sheet.cy);
        context.rotate(rotation);
        context.translate(-sheet.tip, -sheet.cy);
        drawGeometrySheet(context, sheet, { opacity, seamOpacity });
        context.restore();
      });
    }

    const outlineOpacity = ease((fan - .82) / .18);
    if (outlineOpacity > .001) {
      const radius = sheet.length;
      context.save(); context.globalAlpha *= outlineOpacity;
      context.beginPath();
      for (let index = 0; index <= 1200; index++) {
        const angle = index / 1200 * TAU;
        const psi = copies * angle + GEOMETRY_PROFILE_PHASE;
        const localRadius = radius * (1 - landingWall(psi) / 28);
        const x = sheet.tip + localRadius * Math.cos(angle);
        const y = sheet.cy + localRadius * Math.sin(angle);
        if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath(); context.strokeStyle = colors.paper; context.lineWidth = 2.2;
      context.shadowColor = colors.orange; context.shadowBlur = 6; context.stroke();
      context.restore();
    }
  }

  function drawUnfolding(context, width, height, amount) {
    const t = Math.max(0, Math.min(1, amount));
    const open = ease(t / .30);
    const transfer = ease((t - .28) / .20);
    const fan = ease((t - .50) / .50);
    const finalRadius = Math.min(width * .27, height * .34);
    const initialTip = width * .16;
    const initialRight = width * .84;
    const tip = lerp(initialTip, width * .5, transfer);
    const length = lerp(initialRight - initialTip, finalRadius, transfer);
    const half = lerp(Math.min(118, height * .23), finalRadius * Math.sin(Math.PI / 28), transfer);
    const initialOpening = Math.atan2(Math.min(118, height * .23), initialRight - initialTip);
    const sheet = geometrySheetState(width, height, {
      tip,
      right: tip + length,
      half,
      fold: 1 - open,
      flatOpening: lerp(initialOpening, Math.PI / 28, transfer),
      wave: 1,
      // This is the same R = 28 material sector throughout; transfer changes
      // only the camera-scale embedding before its planar copies are opened.
      order: 28,
    });

    if (fan > .0001) drawSectorFan(context, sheet, fan);
    else drawGeometrySheet(context, sheet);
  }

  function drawGeometrySequence(context, width, height, progress) {
    const scaled = Math.max(0, Math.min(1, progress)) * 6;
    const segment = Math.min(5, Math.floor(scaled));
    const local = scaled - segment;
    if (segment === 0) drawNfoldDisk(context, width, height, { selection: ease(local), divisions: 1, showCaption: false });
    else if (segment === 1) drawFoldingSector(context, width, height, local);
    else if (segment === 2) drawConeCylinder(context, width, height, local, 0);
    else if (segment === 3) drawConeCylinder(context, width, height, 1, ease(local));
    else if (segment === 4) drawConeCylinder(context, width, height, 1 - ease(local), 1, true);
    else drawUnfolding(context, width, height, local);
  }

  function drawCollarFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "03 / local solve", "The boundary collar is approximately cylindrical", "five radial units · one angular wavelength");
    const plot = { left: width * .12, top: height * .22, width: width * .76, height: height * .6 };
    roundedPanel(context, plot.left, plot.top, plot.width, plot.height);
    context.fillStyle = visualTheme.backgroundAlt; context.fill();
    const bands = 90;
    for (let index = 0; index < bands; index++) {
      const y = plot.top + index / bands * plot.height;
      const psi = Math.PI - (index + .5) / bands * TAU;
      const wave = Math.sin(1.53 * -3.2 + .8 * Math.cos(psi));
      context.fillStyle = wave > 0 ? `rgba(255,116,73,${.08 + .15 * wave})` : `rgba(77,162,163,${.08 - .14 * wave})`;
      context.fillRect(plot.left, y, plot.width, plot.height / bands + 1);
    }
    context.strokeStyle = colors.grid; context.setLineDash([4, 6]);
    for (let index = 1; index < 5; index++) {
      const x = plot.left + index / 5 * plot.width;
      context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.top + plot.height); context.stroke();
    }
    context.setLineDash([]);
    context.beginPath();
    for (let index = 0; index <= 260; index++) {
      const psi = Math.PI - index / 260 * TAU;
      const y = plot.top + index / 260 * plot.height;
      const x = plot.left + plot.width * .88 - landingWall(psi) * plot.width * .065;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = colors.paper; context.lineWidth = 2.3;
    context.shadowColor = colors.orange; context.shadowBlur = 7; context.stroke(); context.shadowBlur = 0;
    context.fillStyle = colors.faint; context.font = visualTheme.labelFont;
    context.fillText("x = −5", plot.left, plot.top + plot.height + 19);
    context.textAlign = "right"; context.fillText("moving boundary", plot.left + plot.width, plot.top + plot.height + 19);
    context.restore();
  }

  function drawLandingFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "04 / planar lift", "Twenty-eight sectors fit exactly", "R = N = 28");
    const radius = Math.min(width * .29, height * .36);
    const cx = width * .5;
    const cy = height * .55;
    const gradient = context.createRadialGradient(cx, cy, radius * .1, cx, cy, radius);
    gradient.addColorStop(0, "#d34f46"); gradient.addColorStop(.45, "#ded6bc"); gradient.addColorStop(1, "#2f777e");
    context.beginPath();
    for (let index = 0; index <= 1400; index++) {
      const angle = index / 1400 * TAU;
      const psi = 28 * angle;
      const physicalRadius = radius * (1 - landingWall(psi + GEOMETRY_PROFILE_PHASE) / 28);
      const x = cx + physicalRadius * Math.cos(angle);
      const y = cy + physicalRadius * Math.sin(angle);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath(); context.fillStyle = gradient; context.fill();
    context.strokeStyle = colors.paper; context.lineWidth = 2; context.shadowColor = colors.orange; context.shadowBlur = 6; context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = colors.orange; context.font = visualTheme.labelFont; context.textAlign = "center";
    context.fillText("continued boundary coefficients at integral order", cx, cy + radius + 30);
    context.restore();
  }

  const geometryState = { progress: 0, playing: false, frame: null };
  const geometryNames = ["start with rotational symmetry", "choose one fundamental sector", "identify the radial sides", "take the large-order limit", "bifurcate on the half-cylinder", "return to finite order", "lift the integral-order cone to the plane"];
  const geometryStates = ["the field is repeated around the disk", "one fundamental sector in rescaled coordinates", "identifying the radial sides gives the cone quotient", "a fixed boundary collar converges to the half-cylinder", "the rim follows the bifurcating boundary graph", "the half-cylinder branch determines a branch on finite cones", "the sectors fit exactly in the plane"];
  const geometryCaptions = ["the same angular profile repeats N times", "follow one material sector", "the radial sides meet along the quotient seam", "the boundary collar straightens into an exact cylinder", "the rim acquires the Schiffer deformation", "the same deformed surface returns to finite radius", "adjacent copies open in order; each boundary profile stays on its sector"];

  function drawGeometryNarrative() {}

  function renderGeometryMath(width, height, progress) {
    const order = select("#storyGeometryOrderFormula");
    const orderExpression = order?.querySelector(".geometry-math-expression");
    const orderNote = order?.querySelector("small");
    const wall = select("#storyGeometryWallFormula");
    const lift = select("#storyGeometryLiftFormula");
    if (!order || !orderExpression || !orderNote || !wall || !lift) return;

    order.style.opacity = "0";
    wall.style.opacity = "0";
    lift.style.opacity = "0";

    const scaled = Math.max(0, Math.min(1, progress)) * 6;
    const segment = Math.min(5, Math.floor(scaled));
    const local = scaled - segment;
    let cylinderAmount = null;
    let waveAmount = 0;
    let returning = false;
    if (segment === 2) cylinderAmount = local;
    if (segment === 3) { cylinderAmount = 1; waveAmount = ease(local); }
    if (segment === 4) { cylinderAmount = 1 - ease(local); waveAmount = 1; returning = true; }

    if (cylinderAmount !== null) {
      const t = ease(cylinderAmount);
      const surfaceLeft = lerp(width * .16, width * .08, t);
      const sheetOrder = 28 / Math.max(.035, 1 - t);
      const half = Math.min(118, height * .23);
      const orderOpacity = ease(t / .12);
      const orderX = width < 620 ? 24 : width * .08 + 92;
      const orderY = height * .54 - half - (width < 620 ? 62 : 41);
      setFormula(orderExpression, t > .965 ? "R\\to\\infty" : `R\\approx ${Math.round(sheetOrder)}`, { serif: true });
      orderNote.textContent = t > .965 ? "half-cylinder limit" : returning ? "R decreases" : "R increases";
      order.style.left = `${orderX}px`;
      order.style.top = `${orderY}px`;
      order.style.opacity = String(orderOpacity);

      const wallOpacity = ease((waveAmount - .12) / .28) * ease(t / .15);
      const wallX = width < 620 ? 24 : Math.max(surfaceLeft + 100, width * .84 - 330);
      const wallY = height * .54 - half - (width < 620 ? 37 : 42);
      setFormula(wall, "x=h_s(\\psi)=s\\cos(\\psi-\\phi)+O(s^2)", { serif: true });
      wall.style.left = `${wallX}px`;
      wall.style.top = `${wallY}px`;
      wall.style.opacity = String(wallOpacity);
    }

    if (segment === 5) {
      setFormula(lift, "R=N=28", { serif: true });
      lift.style.opacity = String(ease((local - .55) / .45));
    }
  }

  function renderGeometryStory() {
    const { canvas, context, width, height } = canvasMetrics("#storyGeometryCanvas", "#storyGeometryCanvasWrap", 650);
    context.clearRect(0, 0, width, height);
    context.fillStyle = colors.ink; context.fillRect(0, 0, width, height);
    drawGeometrySequence(context, width, height, geometryState.progress);
    drawGeometryNarrative(context, width, height, geometryState.progress);
    renderGeometryMath(width, height, geometryState.progress);
    const scaled = Math.max(0, Math.min(1, geometryState.progress)) * 6;
    const segment = Math.min(5, Math.floor(scaled));
    const local = scaled - segment;
    const active = geometryState.progress >= .999
      ? 6
      : geometryState.progress <= .001
        ? 0
        : local < .01
          ? segment
          : Math.min(6, segment + 1);
    const stageValue = select("#storyGeometryValue");
    const stageNote = select("#storyGeometryState");
    if (stageValue) stageValue.textContent = `stage ${active + 1}`;
    if (stageNote) stageNote.textContent = geometryCaptions[active];
    document.querySelectorAll("[data-story-stage]").forEach((button, index) => button.classList.toggle("active", index === active));
    canvas.setAttribute("aria-label", `Construction stage ${active + 1} of 7: ${geometryStates[active]}. The sector and its boundary wave remain continuous through the entire construction.`);
  }

  function stopGeometryPlayback() {
    geometryState.playing = false;
    if (geometryState.frame) cancelAnimationFrame(geometryState.frame);
    geometryState.frame = null;
    select("#storyGeometryPlayIcon").textContent = "▶";
    select("#storyGeometryPlayLabel").textContent = geometryState.progress > .999 ? "Repeat" : "Animate";
  }

  function playGeometryStory() {
    if (geometryState.playing) { stopGeometryPlayback(); return; }
    if (geometryState.progress > .999) geometryState.progress = 0;
    geometryState.playing = true;
    select("#storyGeometryPlayIcon").textContent = "Ⅱ";
    select("#storyGeometryPlayLabel").textContent = "Pause";
    const startProgress = geometryState.progress;
    const start = performance.now();
    const duration = Math.max(900, 12000 * (1 - startProgress));
    const tick = (now) => {
      if (!geometryState.playing) return;
      const amount = Math.min(1, (now - start) / duration);
      geometryState.progress = startProgress + (1 - startProgress) * amount;
      select("#storyGeometryRange").value = geometryState.progress;
      fillRange(select("#storyGeometryRange"));
      renderGeometryStory();
      if (amount >= 1) { stopGeometryPlayback(); return; }
      geometryState.frame = requestAnimationFrame(tick);
    };
    geometryState.frame = requestAnimationFrame(tick);
  }

  function animateGeometryTo(target) {
    const destination = Math.max(0, Math.min(1, target));
    stopGeometryPlayback();
    const startProgress = geometryState.progress;
    const distance = Math.abs(destination - startProgress);
    if (distance < .0005) {
      geometryState.progress = destination;
      geometryRange.value = destination;
      fillRange(geometryRange);
      renderGeometryStory();
      return;
    }
    geometryState.playing = true;
    select("#storyGeometryPlayIcon").textContent = "Ⅱ";
    select("#storyGeometryPlayLabel").textContent = "Pause";
    const start = performance.now();
    const duration = Math.max(480, 9000 * distance);
    const tick = (now) => {
      if (!geometryState.playing) return;
      const amount = Math.min(1, (now - start) / duration);
      geometryState.progress = lerp(startProgress, destination, ease(amount));
      geometryRange.value = geometryState.progress;
      fillRange(geometryRange);
      renderGeometryStory();
      if (amount >= 1) {
        geometryState.progress = destination;
        stopGeometryPlayback();
        renderGeometryStory();
        return;
      }
      geometryState.frame = requestAnimationFrame(tick);
    };
    geometryState.frame = requestAnimationFrame(tick);
  }

  function xi(R) {
    return Math.sqrt(data.rho ** 2 - R ** 2) - R * Math.acos(R / data.rho) - Math.PI / 4;
  }

  function branchAt(progress) {
    const targetS = Math.max(0, Math.min(1, progress)) * data.landingS;
    const records = data.records;
    if (targetS <= records[0].s) return records[0];
    if (targetS >= records.at(-1).s) return records.at(-1);
    let upper = 1;
    while (records[upper].s < targetS) upper++;
    const left = records[upper - 1];
    const right = records[upper];
    const amount = (targetS - left.s) / (right.s - left.s);
    return {
      s: targetS,
      R: left.R + (right.R - left.R) * amount,
      lambda: left.lambda + (right.lambda - left.lambda) * amount,
    };
  }

  const phaseStoryState = { progress: 0 };
  const phaseFamilyState = { hoverIndex: -1, geometry: null };
  const phaseFamilyRMin = 6;
  const phaseFamilyRMax = 30;

  function cylinderLimitGamma(lambda) {
    return Math.sqrt((lambda - 1) * (4 - lambda))
      / (4 * Math.acos(1 / Math.sqrt(lambda)));
  }

  function phaseFamilyRows() {
    if (!crossingData || !crossingData.columns) return [];
    const rows = [];
    const columns = crossingData.columns;
    for (let index = 0; index < columns.R.length; index += 1) {
      const R = columns.R[index];
      if (R < phaseFamilyRMin) continue;
      if (R > phaseFamilyRMax) break;
      const rho = columns.rho[index];
      const lambda = (rho / R) ** 2;
      if (lambda < 2 || lambda > 3) continue;
      rows.push({ index, R, rho, lambda, gamma: cylinderLimitGamma(lambda), reference: false });
    }
    const reference = crossingData.meta?.reference;
    if (reference
      && reference.R >= phaseFamilyRMin
      && reference.R <= phaseFamilyRMax
      && reference.lambda > 1
      && reference.lambda < 4) {
      rows.push({
        index: -1,
        R: reference.R,
        rho: reference.rho,
        lambda: reference.lambda,
        gamma: cylinderLimitGamma(reference.lambda),
        reference: true,
      });
    }
    rows.sort((left, right) => left.R - right.R);
    return rows;
  }

  function renderPhaseFamily() {
    const canvas = select("#phaseFamilyCanvas");
    const wrap = select("#phaseFamilyCanvasWrap");
    if (!canvas || !wrap) return;
    const minimumHeight = window.innerWidth < 680 ? 520 : 390;
    const { context, width, height } = canvasMetrics("#phaseFamilyCanvas", "#phaseFamilyCanvasWrap", minimumHeight);
    const rows = phaseFamilyRows();
    context.clearRect(0, 0, width, height);
    context.fillStyle = colors.ink;
    context.fillRect(0, 0, width, height);
    if (!rows.length) {
      context.fillStyle = colors.faint;
      context.font = visualTheme.labelFont;
      context.fillText("crossing data unavailable", 24, 34);
      return;
    }

    const compact = width < 680;
    const plot = {
      left: compact ? 46 : 66,
      top: compact ? 46 : 42,
      width: width - (compact ? 66 : 94),
      height: height - (compact ? 92 : 82),
    };
    const xMap = (R) => plot.left
      + (R - phaseFamilyRMin) / (phaseFamilyRMax - phaseFamilyRMin) * plot.width;
    const yMap = (s) => plot.top + (1 - (s + 1) / 2) * plot.height;
    const zeroY = yMap(0);

    context.save();
    context.strokeStyle = colors.grid;
    context.lineWidth = 1;
    for (let integer = phaseFamilyRMin; integer <= phaseFamilyRMax; integer += 1) {
      const x = xMap(integer);
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.top + plot.height);
      context.stroke();
    }
    [-1, -.5, .5, 1].forEach((s) => {
      context.beginPath();
      context.moveTo(plot.left, yMap(s));
      context.lineTo(plot.left + plot.width, yMap(s));
      context.stroke();
    });

    context.strokeStyle = visualTheme.lineStrong;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(plot.left, zeroY);
    context.lineTo(plot.left + plot.width, zeroY);
    context.stroke();

    const labelEvery = compact ? 4 : 1;
    context.fillStyle = colors.faint;
    context.font = visualTheme.labelFont;
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let integer = phaseFamilyRMin; integer <= phaseFamilyRMax; integer += 1) {
      const x = xMap(integer);
      const tick = integer % 5 === 0 ? 8 : 5;
      context.strokeStyle = integer % 5 === 0 ? colors.paper : visualTheme.muted;
      context.beginPath();
      context.moveTo(x, zeroY - tick);
      context.lineTo(x, zeroY + tick);
      context.stroke();
      if ((integer - phaseFamilyRMin) % labelEvery === 0) context.fillText(String(integer), x, zeroY + 12);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    [-1, -.5, 0, .5, 1].forEach((s) => {
      context.fillText(s > 0 ? `+${s}` : String(s), plot.left - 11, yMap(s));
    });
    context.save();
    context.translate(15, plot.top + plot.height / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center";
    context.fillStyle = colors.orange;
    context.font = visualTheme.labelFont;
    context.fillText("BRANCH PARAMETER  s", 0, 0);
    context.restore();

    const pointGeometry = [];
    rows.forEach((row, rowIndex) => {
      const active = rowIndex === phaseFamilyState.hoverIndex;
      const integerGap = row.R - Math.floor(row.R);
      const predictedLanding = integerGap > 0 && integerGap <= row.gamma / 2;
      context.beginPath();
      const samples = 100;
      for (let sample = 0; sample <= samples; sample += 1) {
        const s = -1 + 2 * sample / samples;
        const predictedR = row.R - .5 * row.gamma * s * s;
        const x = xMap(predictedR);
        const y = yMap(s);
        if (sample === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.strokeStyle = active || predictedLanding || row.reference ? "#72c9c6" : "rgba(77,162,163,.48)";
      context.lineWidth = active ? 2.8 : (row.reference ? 2.35 : (predictedLanding ? 2.1 : 1.25));
      context.stroke();

      if (predictedLanding) {
        const landingS = Math.sqrt(2 * integerGap / row.gamma);
        [-landingS, landingS].forEach((s) => {
          context.beginPath();
          context.arc(xMap(Math.floor(row.R)), yMap(s), 3.2, 0, TAU);
          context.fillStyle = colors.ink;
          context.fill();
          context.strokeStyle = colors.paper;
          context.lineWidth = 1.2;
          context.stroke();
        });
      }

      const point = { x: xMap(row.R), y: zeroY, row };
      pointGeometry.push(point);
      context.beginPath();
      context.arc(point.x, point.y, active ? 6.3 : (row.reference ? 5.4 : 4), 0, TAU);
      context.fillStyle = colors.orange;
      context.fill();
      context.strokeStyle = active || row.reference ? colors.paper : colors.ink;
      context.lineWidth = active ? 1.8 : (row.reference ? 1.5 : 1);
      context.stroke();

      if (row.reference && !compact && !paperEdition) {
        context.fillStyle = colors.paper;
        context.font = visualTheme.labelFont;
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText("REFERENCE CROSSING", point.x, point.y - 11);
      }
    });

    if (!compact && !paperEdition) {
      context.fillStyle = colors.orange;
      context.font = visualTheme.labelFont;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText("COMMON-ZERO CROSSINGS AT THE BRANCH ORIGIN", plot.left + 8, zeroY - 29);
      context.fillStyle = colors.faint;
      context.fillText("each quadratic jet opens toward decreasing R", plot.left + 8, plot.top + 10);
      context.fillText("white rings mark a two-jet reaching an integer within |s| ≤ 1", plot.left + 8, plot.top + 26);
    }

    if (!paperEdition && phaseFamilyState.hoverIndex >= 0 && pointGeometry[phaseFamilyState.hoverIndex]) {
      const point = pointGeometry[phaseFamilyState.hoverIndex];
      const boxWidth = compact ? 174 : 205;
      const boxHeight = point.row.reference ? 82 : 66;
      const boxX = Math.min(Math.max(point.x + 12, plot.left + 4), plot.left + plot.width - boxWidth - 4);
      const boxY = point.y > plot.top + plot.height / 2
        ? point.y - boxHeight - 15
        : point.y + 15;
      context.fillStyle = colors.tooltip;
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.strokeStyle = "rgba(255,116,73,.7)";
      context.strokeRect(boxX + .5, boxY + .5, boxWidth - 1, boxHeight - 1);
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = colors.paper;
      context.font = visualTheme.labelFont;
      context.fillText(`order ${point.row.R.toFixed(6)}`, boxX + 10, boxY + 10);
      context.fillStyle = colors.faint;
      context.font = visualTheme.labelFont;
      context.fillText(`spectral ratio ${point.row.lambda.toFixed(4)}`, boxX + 10, boxY + 28);
      context.fillText(`unit-amplitude quadratic drop ${(point.row.gamma / 2).toFixed(4)}`, boxX + 10, boxY + 45);
      if (point.row.reference) {
        context.fillStyle = colors.orange;
        context.fillText("running example · separate spectral window", boxX + 10, boxY + 62);
      }
    }
    context.restore();

    phaseFamilyState.geometry = { pointGeometry, width, height };
    const windowRows = rows.filter((row) => !row.reference).length;
    canvas.setAttribute("aria-label", paperEdition
      ? "Real-order crossing plot with integer fold symmetries, common-zero crossings at the branch origin, and predicted quadratic branch jets bending toward smaller real order."
      : `${windowRows} computed crossings with real order between 6 and 30 and spectral ratio between 2 and 3, together with the separately computed running example at order 28.026397. Every displayed quadratic branch jet bends toward smaller real order as the magnitude of s increases.`);
  }

  function drawPhasePanel(context, rect, options) {
    context.save();
    context.fillStyle = colors.panel; roundedPanel(context, rect.left, rect.top, rect.width, rect.height); context.fill();
    if (!visualTheme.paperEdition) {
      context.strokeStyle = colors.grid;
      context.stroke();
    }
    const plot = { left: rect.left + 36, top: rect.top + 55, width: rect.width - 54, height: rect.height - 88 };
    context.strokeStyle = colors.grid; context.lineWidth = 1; context.setLineDash([3, 6]);
    for (let index = 0; index <= 4; index++) {
      const x = plot.left + index / 4 * plot.width;
      const y = plot.top + index / 4 * plot.height;
      context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.top + plot.height); context.stroke();
      context.beginPath(); context.moveTo(plot.left, y); context.lineTo(plot.left + plot.width, y); context.stroke();
    }
    context.setLineDash([]);
    const xMap = (s) => plot.left + s / data.landingS * plot.width;
    const yMap = (value) => plot.top + (options.maximum - value) / options.maximum * plot.height;
    const draw = (points, color, dash, width) => {
      context.beginPath();
      points.forEach((point, index) => {
        const x = xMap(point.s); const y = yMap(point.value);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = color; context.lineWidth = width; context.setLineDash(dash); context.stroke(); context.setLineDash([]);
    };
    draw(options.quadratic, colors.orange, [], 1.5);
    draw(options.actual, colors.cyan, [], 2.2);
    const current = options.valueAt(branchAt(phaseStoryState.progress));
    const currentS = phaseStoryState.progress * data.landingS;
    context.beginPath(); context.arc(xMap(currentS), yMap(current), 5, 0, TAU);
    context.fillStyle = colors.orange; context.fill(); context.strokeStyle = colors.paper; context.lineWidth = 1.5; context.stroke();
    context.fillStyle = colors.paper; context.font = visualTheme.labelFont; context.fillText(options.title, rect.left + 14, rect.top + 21);
    context.fillStyle = colors.faint; context.font = visualTheme.labelFont;
    context.textAlign = "right"; context.fillText(options.maximumLabel, plot.left + plot.width, plot.top + 10);
    context.fillText("0", plot.left - 8, plot.top + plot.height); context.restore();
  }

  function renderPhaseStory() {
    const { canvas, context, width, height } = canvasMetrics("#phaseStoryCanvas", "#phaseStoryCanvasWrap", 390);
    context.clearRect(0, 0, width, height); context.fillStyle = colors.ink; context.fillRect(0, 0, width, height);
    const records = data.records;
    const baseXi = xi(data.RStar);
    const dropActual = records.map((record) => ({ s: record.s, value: data.RStar - record.R }));
    const phaseActual = records.map((record) => ({ s: record.s, value: (xi(record.R) - baseXi) * 180 / Math.PI }));
    const quadraticSamples = 180;
    const dropQuadratic = [];
    const phaseQuadratic = [];
    const xiPrime = -Math.acos(data.RStar / data.rho);
    for (let index = 0; index < quadraticSamples; index++) {
      const s = index / (quadraticSamples - 1) * data.landingS;
      const signedRChange = .5 * data.Rpp * s * s;
      dropQuadratic.push({ s, value: -signedRChange });
      phaseQuadratic.push({ s, value: xiPrime * signedRChange * 180 / Math.PI });
    }
    const compact = width < 680;
    const rects = compact
      ? [{ left: 12, top: 12, width: width - 24, height: (height - 36) / 2 }, { left: 12, top: 24 + (height - 36) / 2, width: width - 24, height: (height - 36) / 2 }]
      : [{ left: 14, top: 18, width: (width - 42) / 2, height: height - 36 }, { left: 28 + (width - 42) / 2, top: 18, width: (width - 42) / 2, height: height - 36 }];
    const maximumDrop = Math.max(...dropActual.map((point) => point.value)) * 1.08;
    const maximumPhase = Math.max(...phaseActual.map((point) => point.value)) * 1.08;
    drawPhasePanel(context, rects[0], { title: "ORDER DROP", subtitle: "R* − R(s)", actual: dropActual, quadratic: dropQuadratic, maximum: maximumDrop, maximumLabel: maximumDrop.toFixed(4), valueAt: (record) => data.RStar - record.R });
    drawPhasePanel(context, rects[1], { title: "LOCAL PHASE GAIN", subtitle: "ξ(R(s)) − ξ(R*)", actual: phaseActual, quadratic: phaseQuadratic, maximum: maximumPhase, maximumLabel: `${maximumPhase.toFixed(3)}°`, valueAt: (record) => (xi(record.R) - baseXi) * 180 / Math.PI });
    setCanvasFormula("#phaseStoryCanvasWrap", "phaseStoryOrderFormula", "R_*-R(s)", {
      left: rects[0].left + 14, top: rects[0].top + 27, color: colors.faint,
    });
    setCanvasFormula("#phaseStoryCanvasWrap", "phaseStoryXiFormula", "\\xi(R(s))-\\xi(R_*)", {
      left: rects[1].left + 14, top: rects[1].top + 27, color: colors.faint,
    });
    const current = branchAt(phaseStoryState.progress);
    const phaseDegrees = (xi(current.R) - baseXi) * 180 / Math.PI;
    canvas.setAttribute("aria-label", `At branch amplitude ${current.s.toFixed(4)}, the continued order has decreased to ${current.R.toFixed(6)} and the Debye collar phase has increased by ${phaseDegrees.toFixed(4)} degrees. Cyan solid curves use stored continuation records; orange solid curves are their base quadratic laws.`);
  }

  function updatePhaseStory() {
    const current = branchAt(phaseStoryState.progress);
    const phaseDegrees = (xi(current.R) - xi(data.RStar)) * 180 / Math.PI;
    setMath("#phaseStorySValue", `s=${current.s.toFixed(4)}`);
    select("#phaseStoryRValue").textContent = current.R.toFixed(6);
    setMath("#phaseStoryPhaseValue", `${phaseDegrees.toFixed(4)}^{\\circ}`);
    select("#phaseStoryState").textContent = phaseStoryState.progress < .002 ? "quadratic variation from the crossing" : (phaseStoryState.progress > .998 ? "integral order reached" : `order decreased by ${(data.RStar - current.R).toFixed(5)}`);
    renderPhaseStory();
  }

  const geometryRange = select("#storyGeometryRange");
  fillRange(geometryRange);
  geometryRange.addEventListener("input", (event) => {
    stopGeometryPlayback(); geometryState.progress = Number(event.target.value); fillRange(event.target); renderGeometryStory();
  });
  select("#storyGeometryPlayButton").addEventListener("click", playGeometryStory);
  select("#storyGeometryResetButton").addEventListener("click", () => {
    stopGeometryPlayback(); geometryState.progress = 0; geometryRange.value = 0; fillRange(geometryRange); renderGeometryStory();
  });
  document.querySelectorAll("[data-story-stage]").forEach((button) => button.addEventListener("click", () => {
    animateGeometryTo(Number(button.dataset.storyStage));
  }));

  const phaseRange = select("#phaseStoryRange");
  fillRange(phaseRange);
  phaseRange.addEventListener("input", (event) => { phaseStoryState.progress = Number(event.target.value); fillRange(event.target); updatePhaseStory(); });
  select("#phaseStoryResetButton").addEventListener("click", () => { phaseStoryState.progress = 0; phaseRange.value = 0; fillRange(phaseRange); updatePhaseStory(); });

  const phaseFamilyCanvas = select("#phaseFamilyCanvas");
  if (phaseFamilyCanvas) {
    phaseFamilyCanvas.addEventListener("pointermove", (event) => {
      if (!phaseFamilyState.geometry) return;
      const bounds = phaseFamilyCanvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * phaseFamilyState.geometry.width / bounds.width;
      const y = (event.clientY - bounds.top) * phaseFamilyState.geometry.height / bounds.height;
      let nearest = -1;
      let nearestDistance = 15;
      phaseFamilyState.geometry.pointGeometry.forEach((point, index) => {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
      });
      if (nearest !== phaseFamilyState.hoverIndex) {
        phaseFamilyState.hoverIndex = nearest;
        renderPhaseFamily();
      }
    });
    phaseFamilyCanvas.addEventListener("pointerleave", () => {
      if (phaseFamilyState.hoverIndex < 0) return;
      phaseFamilyState.hoverIndex = -1;
      renderPhaseFamily();
    });
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderGeometryStory(); renderPhaseStory(); renderPhaseFamily(); }, 140);
  });

  renderGeometryStory();
  updatePhaseStory();
  renderPhaseFamily();
})();
