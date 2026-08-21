(() => {
  "use strict";

  const data = window.CONE_NUMERICS;
  if (!data) return;
  const select = (selector) => document.querySelector(selector);
  const TAU = Math.PI * 2;
  const colors = {
    ink: "#101b20",
    paper: "#f1eee5",
    orange: "#ff7449",
    cyan: "#4da2a3",
    grid: "rgba(241,238,229,.12)",
    faint: "rgba(241,238,229,.42)",
  };

  // The older laboratories remain grouped together in the source file. Put the
  // live DOM in the same order as the visual argument so keyboard and screen-
  // reader navigation follow the numbered story rather than CSS paint order.
  const main = select("main");
  [
    ".intro",
    "#question",
    "#disk-obstruction",
    "#borrow-flexibility",
    "#geometric-escape",
    "#experiment",
    "#debye-experiment",
    "#phase-story",
    "#cone-experiment",
    "#modes-experiment",
    "#abundance-experiment",
  ].forEach((selector) => {
    const section = select(selector);
    if (main && section) main.appendChild(section);
  });

  function fillRange(input) {
    const amount = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty("--value", `${amount * 100}%`);
  }

  function canvasMetrics(canvasSelector, wrapSelector, minimumHeight) {
    const canvas = select(canvasSelector);
    const wrap = select(wrapSelector);
    const width = Math.max(300, wrap.clientWidth || 900);
    const height = Math.max(minimumHeight, wrap.clientHeight || minimumHeight);
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
    context.fillStyle = colors.orange;
    context.font = "8px DM Mono, monospace";
    context.fillText(eyebrow.toUpperCase(), 24, 26);
    context.fillStyle = colors.paper;
    context.font = "300 25px Newsreader, serif";
    context.fillText(title, 24, 54);
    context.fillStyle = colors.faint;
    context.font = "8px DM Mono, monospace";
    context.textAlign = "right";
    context.fillText(detail, width - 24, 27);
    context.restore();
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
    context.font = "8px DM Mono, monospace";
    context.fillText("one quotient sector", cx + radius * .62, cy - 22);
    context.fillStyle = colors.faint;
    context.fillText("the other 27 copies carry no new information", cx - radius, cy + radius + 31);
    context.restore();
  }

  function drawConeFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "02 / normalize", "The tiny sector becomes a long cone", "rim circumference 2π · length R");
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
    context.fillStyle = colors.paper; context.font = "8px DM Mono, monospace";
    context.fillText("tip", left - 7, cy + 20);
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
      const value = Math.cos(copies * middle);
      const localRadius = radius * (1 - wiggle * landingWall(copies * middle) / 28);
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
      context.lineTo(cx + radius * 1.04 * Math.cos(-halfAngle), cy + radius * 1.04 * Math.sin(-halfAngle));
      context.arc(cx, cy, radius * 1.04, -halfAngle, halfAngle);
      context.closePath(); context.fillStyle = `rgba(255,116,73,${.08 + .24 * selection})`; context.fill();
      context.strokeStyle = colors.orange; context.lineWidth = 2.4; context.stroke();
    }

    if (divisions > 0) {
      context.strokeStyle = `rgba(241,238,229,${.08 + .22 * divisions})`; context.lineWidth = .7;
      for (let index = 0; index < copies; index++) {
        const angle = (index + .5) / copies * TAU;
        context.beginPath(); context.moveTo(cx, cy);
        context.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)); context.stroke();
      }
    }

    context.beginPath();
    for (let index = 0; index <= 900; index++) {
      const angle = index / 900 * TAU;
      const localRadius = radius * (1 - wiggle * landingWall(copies * angle) / 28);
      const x = cx + localRadius * Math.cos(angle); const y = cy + localRadius * Math.sin(angle);
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath(); context.strokeStyle = colors.paper; context.lineWidth = 2; context.stroke();
    context.fillStyle = colors.faint; context.font = "8px DM Mono, monospace"; context.textAlign = "center";
    context.fillText("the same angular profile repeats 28 times", cx, cy + radius + 34);
    context.restore();
  }

  function drawFoldingSector(context, width, height, amount) {
    const t = Math.max(0, Math.min(1, amount));
    const moveDisk = ease(t / .2);
    const extract = ease((t - .06) / .28);
    const fold = ease((t - .32) / .68);
    const fullDiskRadius = Math.min(width * .27, height * .34);
    const smallDiskRadius = Math.min(width * .15, height * .21);
    const diskCx = lerp(width * .5, width * .2, moveDisk);
    const diskRadius = lerp(fullDiskRadius, smallDiskRadius, moveDisk);
    const diskOpacity = 1 - ease((t - .18) / .26);

    // Keep the chosen sector visible while its 27 redundant copies recede.
    // The sector itself is never cross-faded into a cone: the same mesh below
    // is continuously wrapped until its two radial edges coincide.
    if (diskOpacity > .001) {
      drawNfoldDisk(context, width, height, {
        cx: diskCx,
        radius: diskRadius,
        selection: 1,
        opacity: diskOpacity,
      });
    }

    const cy = height * .54;
    const targetTip = width * .15;
    const targetLength = width * .69;
    const targetHalf = Math.min(118, height * .23);
    const tip = lerp(diskCx, targetTip, extract);
    const length = lerp(diskRadius, targetLength, extract);
    const half = lerp(diskRadius * Math.sin(Math.PI / 28), targetHalf, extract);
    const depthProjection = .1;

    function sheetPoint(radial, angular) {
      const flatY = radial * half * angular;
      // At fold=1, angular in [-1,1] traverses a full circle. Its two
      // endpoints agree, so the two radial sides have become one seam.
      const coneY = radial * half * Math.sin(Math.PI * angular);
      const coneZ = radial * half * Math.cos(Math.PI * angular);
      const y = lerp(flatY, coneY, fold);
      const z = fold * coneZ;
      return {
        x: tip + radial * length + depthProjection * z,
        y: cy + y,
        z: z,
      };
    }

    context.save();

    // Draw the angular strips back-to-front. At the start they partition one
    // flat triangle; at the end they are the visible faces of one cone.
    const strips = [];
    const stripCount = 30;
    for (let index = 0; index < stripCount; index++) {
      const a0 = -1 + 2 * index / stripCount;
      const a1 = -1 + 2 * (index + 1) / stripCount;
      strips.push({ a0: a0, a1: a1, depth: Math.cos(Math.PI * (a0 + a1) / 2) });
    }
    strips.sort((leftStrip, rightStrip) => leftStrip.depth - rightStrip.depth);
    strips.forEach((strip, index) => {
      const p0 = sheetPoint(0, strip.a0);
      const p1 = sheetPoint(1, strip.a0);
      const p2 = sheetPoint(1, strip.a1);
      context.beginPath();
      context.moveTo(p0.x, p0.y);
      context.lineTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.closePath();
      const warmth = (strip.a0 + strip.a1 + 2) / 4;
      context.fillStyle = warmth > .5
        ? `rgba(255,116,73,${.13 + .16 * strip.depth * fold + .08 * extract})`
        : `rgba(77,162,163,${.16 + .12 * strip.depth * fold + .08 * extract})`;
      context.fill();
      if (index % 3 === 0) {
        context.strokeStyle = "rgba(241,238,229,.055)";
        context.lineWidth = .6;
        context.stroke();
      }
    });

    // Radial generators stay attached to the same material points throughout
    // the fold, making the wrapping motion legible rather than a morph.
    for (let index = 1; index < 12; index++) {
      const angular = -1 + 2 * index / 12;
      const start = sheetPoint(0, angular);
      const end = sheetPoint(1, angular);
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y);
      context.strokeStyle = index % 2
        ? "rgba(241,238,229,.13)"
        : "rgba(77,162,163,.28)";
      context.lineWidth = .8; context.stroke();
    }

    // Lines transverse to the generators begin as straight segments and curl
    // into closed ellipses. This is the most direct visual cue for folding.
    for (let radialIndex = 1; radialIndex <= 7; radialIndex++) {
      const radial = radialIndex / 7;
      context.beginPath();
      for (let index = 0; index <= 120; index++) {
        const point = sheetPoint(radial, -1 + 2 * index / 120);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = radialIndex % 2
        ? "rgba(255,116,73,.32)"
        : "rgba(241,238,229,.18)";
      context.lineWidth = radialIndex === 7 ? 1.6 : .8;
      context.stroke();
    }

    const sideAStart = sheetPoint(0, -1);
    const sideAEnd = sheetPoint(1, -1);
    const sideBStart = sheetPoint(0, 1);
    const sideBEnd = sheetPoint(1, 1);
    context.beginPath(); context.moveTo(sideAStart.x, sideAStart.y); context.lineTo(sideAEnd.x, sideAEnd.y);
    context.strokeStyle = colors.cyan; context.lineWidth = 2.5; context.stroke();
    context.beginPath(); context.moveTo(sideBStart.x, sideBStart.y); context.lineTo(sideBEnd.x, sideBEnd.y);
    context.strokeStyle = colors.orange; context.lineWidth = 2.5; context.stroke();

    if (fold < .94 && extract > .72) {
      context.fillStyle = colors.cyan; context.font = "7px DM Mono, monospace"; context.textAlign = "left";
      context.fillText("RADIAL SIDE A", sideAEnd.x + 8, sideAEnd.y - 7);
      context.fillStyle = colors.orange;
      context.fillText("RADIAL SIDE B", sideBEnd.x + 8, sideBEnd.y + 13);
      const seam = { x: tip + length - depthProjection * half, y: cy };
      [sideAEnd, sideBEnd].forEach((edge, index) => {
        const arrowEnd = {
          x: lerp(edge.x, seam.x, .42),
          y: lerp(edge.y, seam.y, .42),
        };
        context.beginPath(); context.moveTo(edge.x, edge.y); context.lineTo(arrowEnd.x, arrowEnd.y);
        context.strokeStyle = index ? "rgba(255,116,73,.62)" : "rgba(77,162,163,.62)";
        context.setLineDash([3, 4]); context.lineWidth = 1; context.stroke(); context.setLineDash([]);
      });
    }

    if (fold > .88) {
      const seamStart = sheetPoint(0, -1);
      const seamEnd = sheetPoint(1, -1);
      context.beginPath(); context.moveTo(seamStart.x, seamStart.y); context.lineTo(seamEnd.x, seamEnd.y);
      context.strokeStyle = colors.orange; context.setLineDash([4, 5]); context.lineWidth = 2; context.stroke(); context.setLineDash([]);
      context.fillStyle = colors.orange; context.font = "7px DM Mono, monospace"; context.textAlign = "left";
      context.fillText("A = B · QUOTIENT SEAM", seamEnd.x + 9, seamEnd.y - 8);
    }

    context.fillStyle = colors.faint; context.font = "8px DM Mono, monospace"; context.textAlign = "center";
    const caption = extract < .72
      ? "lift the selected sector away from its 27 copies"
      : fold < .88
        ? "fold the two radial sides together"
        : "the two sides meet: the sector is now a quotient cone";
    context.fillText(caption, width * .5, cy + targetHalf + 47);
    context.restore();
  }

  function drawConeCylinder(context, width, height, cylinderAmount, waveAmount) {
    const t = ease(cylinderAmount);
    const cx = height > 520 ? height * .54 : height * .5;
    const right = width * .84;
    const half = Math.min(118, height * .23);
    const visibleLeft = width * .08;
    const tip = lerp(width * .16, -width * 2.6, t);
    const surfaceLeft = Math.max(visibleLeft, tip);
    const slopeFactor = t + (1 - t) * Math.max(0, (surfaceLeft - tip) / (right - tip));
    const leftHalf = half * slopeFactor;
    context.save();
    const gradient = context.createLinearGradient(surfaceLeft, 0, right, 0);
    gradient.addColorStop(0, "rgba(12,22,27,.04)"); gradient.addColorStop(.7, "rgba(77,162,163,.28)"); gradient.addColorStop(1, "rgba(255,116,73,.28)");
    context.beginPath(); context.moveTo(surfaceLeft, cx - leftHalf); context.lineTo(right, cx - half); context.lineTo(right, cx + half); context.lineTo(surfaceLeft, cx + leftHalf); context.closePath();
    context.fillStyle = gradient; context.fill(); context.strokeStyle = colors.paper; context.lineWidth = 1.7; context.stroke();

    for (let index = -3; index <= 3; index++) {
      const q = index / 3; const yLeft = cx + q * leftHalf; const yRight = cx + q * half;
      context.beginPath(); context.moveTo(surfaceLeft, yLeft); context.lineTo(right, yRight);
      context.strokeStyle = index % 2 ? "rgba(77,162,163,.22)" : "rgba(241,238,229,.13)"; context.lineWidth = 1; context.stroke();
    }
    for (let index = 0; index < 8; index++) {
      const q = .45 + index / 12; const x = lerp(surfaceLeft, right, q);
      const localHalf = lerp(leftHalf, half, q);
      context.beginPath(); context.ellipse(x, cx, 5 + 4 * q, localHalf, 0, 0, TAU);
      context.strokeStyle = index % 2 ? "rgba(255,116,73,.25)" : "rgba(77,162,163,.28)"; context.lineWidth = 1; context.stroke();
    }

    context.beginPath();
    for (let index = 0; index <= 220; index++) {
      const theta = -Math.PI / 2 + index / 220 * Math.PI;
      const y = cx + half * Math.sin(theta);
      const x = right + 10 * Math.cos(theta) + waveAmount * 19 * Math.cos(theta * 2);
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    }
    for (let index = 220; index >= 0; index--) {
      const theta = Math.PI / 2 + index / 220 * Math.PI;
      const y = cx + half * Math.sin(theta);
      const x = right + 10 * Math.cos(theta) + waveAmount * 19 * Math.cos(theta * 2);
      context.lineTo(x, y);
    }
    context.strokeStyle = colors.paper; context.lineWidth = 2.4; context.shadowColor = waveAmount ? colors.orange : colors.cyan; context.shadowBlur = 7; context.stroke(); context.shadowBlur = 0;
    context.fillStyle = colors.orange; context.font = "8px DM Mono, monospace"; context.textAlign = "center";
    if (t > .58) context.fillText("tip → −∞", visibleLeft + 36, cx - half - 28);
    context.fillStyle = colors.faint;
    context.fillText(waveAmount > .5 ? "the free rim now carries the cylinder bifurcation" : (t > .6 ? "on every fixed boundary window, the cone is now a half-cylinder" : "the quotient cone"), width * .53, cx + half + 42);
    context.restore();
  }

  function drawUnfolding(context, width, height, amount) {
    const t = ease(amount);
    drawConeCylinder(context, width, height, 0, 1);
    context.save(); context.globalAlpha = t; context.fillStyle = colors.ink; context.fillRect(0, 0, width, height); context.restore();
    drawNfoldDisk(context, width, height, { wiggle: 1, divisions: 1 - t, opacity: t });
    if (t > .08 && t < .92) {
      context.save(); context.globalAlpha = Math.sin(Math.PI * t) * .55; context.strokeStyle = colors.orange; context.setLineDash([4, 6]);
      const cx = width * .5; const cy = height * .54; const r0 = Math.min(width * .16, height * .2); const r1 = Math.min(width * .32, height * .38);
      for (let index = 0; index < 28; index++) {
        const angle = index / 28 * TAU;
        context.beginPath(); context.moveTo(cx + r0 * Math.cos(angle), cy + r0 * Math.sin(angle)); context.lineTo(cx + r1 * Math.cos(angle), cy + r1 * Math.sin(angle)); context.stroke();
      }
      context.restore();
    }
  }

  function drawGeometrySequence(context, width, height, progress) {
    const scaled = Math.max(0, Math.min(1, progress)) * 6;
    const segment = Math.min(5, Math.floor(scaled));
    const local = scaled - segment;
    if (progress >= 1) { drawNfoldDisk(context, width, height, { wiggle: 1, divisions: 0 }); return; }
    if (segment === 0) drawNfoldDisk(context, width, height, { selection: ease(local), divisions: 1 });
    else if (segment === 1) drawFoldingSector(context, width, height, local);
    else if (segment === 2) drawConeCylinder(context, width, height, local, 0);
    else if (segment === 3) drawConeCylinder(context, width, height, 1, ease(local));
    else if (segment === 4) drawConeCylinder(context, width, height, 1 - ease(local), 1);
    else drawUnfolding(context, width, height, local);
  }

  function drawCollarFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "03 / local solve", "At the rim, the cone looks cylindrical", "five radial units · one angular wavelength");
    const plot = { left: width * .12, top: height * .22, width: width * .76, height: height * .6 };
    roundedPanel(context, plot.left, plot.top, plot.width, plot.height);
    context.fillStyle = "#17303a"; context.fill();
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
    context.fillStyle = colors.faint; context.font = "8px DM Mono, monospace";
    context.fillText("x = −5", plot.left, plot.top + plot.height + 19);
    context.textAlign = "right"; context.fillText("free rim x = h(ψ)", plot.left + plot.width, plot.top + plot.height + 19);
    context.restore();
  }

  function drawLandingFrame(context, width, height, opacity) {
    context.save();
    context.globalAlpha = opacity;
    drawFrameLabel(context, width, "04 / integer landing", "Twenty-eight copies close in the plane", "R = N = 28 · no seam");
    const radius = Math.min(width * .29, height * .36);
    const cx = width * .5;
    const cy = height * .55;
    const gradient = context.createRadialGradient(cx, cy, radius * .1, cx, cy, radius);
    gradient.addColorStop(0, "#d34f46"); gradient.addColorStop(.45, "#ded6bc"); gradient.addColorStop(1, "#2f777e");
    context.beginPath();
    for (let index = 0; index <= 1400; index++) {
      const angle = index / 1400 * TAU;
      const psi = 28 * angle;
      const physicalRadius = radius * (1 - landingWall(psi) / 28);
      const x = cx + physicalRadius * Math.cos(angle);
      const y = cy + physicalRadius * Math.sin(angle);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath(); context.fillStyle = gradient; context.fill();
    context.strokeStyle = colors.paper; context.lineWidth = 2; context.shadowColor = colors.orange; context.shadowBlur = 6; context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = colors.orange; context.font = "8px DM Mono, monospace"; context.textAlign = "center";
    context.fillText("actual continued N = 28 boundary coefficients", cx, cy + radius + 30);
    context.restore();
  }

  const geometryState = { progress: 0, playing: false, frame: null };
  const geometryNames = ["divide the disk", "select one sector", "fold its sides together", "send the tip away", "perturb the cylinder", "restore the cone", "unfold at integer R"];
  const geometryStates = ["the field repeats on 28 sectors", "one fundamental sector selected", "the same sector folds · radial sides meet in one quotient seam", "cone tip at infinity · half-cylinder limit", "free boundary perturbed on the half-cylinder", "the same wave returned to the finite cone", "integer aperture · all 28 copies close"];

  function renderGeometryStory() {
    const { canvas, context, width, height } = canvasMetrics("#storyGeometryCanvas", "#storyGeometryCanvasWrap", 650);
    context.clearRect(0, 0, width, height);
    context.fillStyle = colors.ink; context.fillRect(0, 0, width, height);
    drawGeometrySequence(context, width, height, geometryState.progress);
    const nearest = Math.min(6, Math.round(geometryState.progress * 6));
    drawFrameLabel(context, width, `${String(nearest + 1).padStart(2, "0")} / construction`, geometryNames[nearest], nearest === 6 ? "R = N = 28" : "N = 28 running geometry");
    select("#storyGeometryValue").textContent = geometryNames[nearest];
    select("#storyGeometryState").textContent = geometryStates[nearest];
    document.querySelectorAll("[data-story-stage]").forEach((button, index) => button.classList.toggle("active", index === nearest));
    canvas.setAttribute("aria-label", `Construction stage ${nearest + 1} of 7: ${geometryStates[nearest]}. The final boundary uses the stored numerical N equals 28 landing coefficients.`);
  }

  function stopGeometryPlayback() {
    geometryState.playing = false;
    if (geometryState.frame) cancelAnimationFrame(geometryState.frame);
    geometryState.frame = null;
    select("#storyGeometryPlayIcon").textContent = "▶";
    select("#storyGeometryPlayLabel").textContent = geometryState.progress > .999 ? "Replay the geometric move" : "Play the geometric move";
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

  function drawPhasePanel(context, rect, options) {
    context.save();
    context.fillStyle = "rgba(12,22,27,.65)"; roundedPanel(context, rect.left, rect.top, rect.width, rect.height); context.fill();
    context.strokeStyle = "rgba(241,238,229,.15)"; context.stroke();
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
    context.fillStyle = colors.paper; context.font = "9px DM Mono, monospace"; context.fillText(options.title, rect.left + 14, rect.top + 21);
    context.fillStyle = colors.faint; context.font = "7px DM Mono, monospace"; context.fillText(options.subtitle, rect.left + 14, rect.top + 39);
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
    const current = branchAt(phaseStoryState.progress);
    const phaseDegrees = (xi(current.R) - baseXi) * 180 / Math.PI;
    canvas.setAttribute("aria-label", `At branch amplitude ${current.s.toFixed(4)}, the continued order has decreased to ${current.R.toFixed(6)} and the Debye collar phase has increased by ${phaseDegrees.toFixed(4)} degrees. Cyan solid curves use stored continuation records; orange solid curves are their base quadratic laws.`);
  }

  function updatePhaseStory() {
    const current = branchAt(phaseStoryState.progress);
    const phaseDegrees = (xi(current.R) - xi(data.RStar)) * 180 / Math.PI;
    select("#phaseStorySValue").textContent = `s = ${current.s.toFixed(4)}`;
    select("#phaseStoryRValue").textContent = current.R.toFixed(6);
    select("#phaseStoryPhaseValue").textContent = `${phaseDegrees.toFixed(4)}°`;
    select("#phaseStoryState").textContent = phaseStoryState.progress < .002 ? "quadratic departure from the crossing" : (phaseStoryState.progress > .998 ? "integer landing reached" : `R has dropped ${(data.RStar - current.R).toFixed(5)}`);
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
    stopGeometryPlayback(); geometryState.progress = Number(button.dataset.storyStage); geometryRange.value = geometryState.progress; fillRange(geometryRange); renderGeometryStory();
  }));

  const phaseRange = select("#phaseStoryRange");
  fillRange(phaseRange);
  phaseRange.addEventListener("input", (event) => { phaseStoryState.progress = Number(event.target.value); fillRange(event.target); updatePhaseStory(); });
  select("#phaseStoryResetButton").addEventListener("click", () => { phaseStoryState.progress = 0; phaseRange.value = 0; fillRange(phaseRange); updatePhaseStory(); });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderGeometryStory(); renderPhaseStory(); }, 140);
  });

  renderGeometryStory();
  updatePhaseStory();
})();
