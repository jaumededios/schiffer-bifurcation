(function abundanceModule(global) {
  "use strict";

  const IDS = {
    cutoffRange: "abundanceCutoffRange",
    cutoffValue: "abundanceCutoffValue",
    countValue: "abundanceCountValue",
    bestValue: "abundanceBestValue",
    canvas: "abundanceCanvas",
    canvasWrap: "abundanceCanvasWrap",
    plotState: "abundancePlotState",
    resetButton: "abundanceResetButton",
    playButton: "abundancePlayButton",
    playIcon: "abundancePlayIcon",
    playLabel: "abundancePlayLabel",
    examplesBody: "abundanceExamplesBody",
  };

  const visualTheme = global.SCHIFFER_VISUAL_THEME || {
    background: "#101b20",
    backgroundAlt: "#17282e",
    ink: "#f1eee5",
    muted: "rgba(241,238,229,0.46)",
    faint: "rgba(241,238,229,0.12)",
    line: "rgba(241,238,229,0.10)",
    lineStrong: "rgba(241,238,229,0.28)",
    labelFont: "11px 'DM Mono', monospace",
  };
  const paperEdition = Boolean(visualTheme.paperEdition || document.body.classList.contains("tufte-site"));
  const COLORS = {
    background: visualTheme.background,
    backgroundTop: visualTheme.backgroundAlt,
    ink: visualTheme.ink,
    muted: visualTheme.muted,
    faint: visualTheme.faint,
    grid: visualTheme.line,
    point: visualTheme.muted,
    teal: "#4da2a3",
    orange: "#ff7449",
    red: "#d83a55",
  };

  const SLIDER_STEPS = 1000;
  const PLAY_DURATION_MS = 7200;
  const NEAR_BAND = 0.1;
  let singleton = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setMath(element, source) {
    global.SchifferMath?.render(element, source);
  }

  function collectElements() {
    const elements = {};
    Object.keys(IDS).forEach(function collect(key) {
      elements[key] = byId(IDS[key]);
    });
    return elements;
  }

  function validateData(data) {
    if (!data || !data.meta || !data.columns) {
      return "The crossing dataset did not load.";
    }
    const columns = data.columns;
    const required = ["R", "rho", "n", "localIndex"];
    const lengths = required.map(function lengthOf(name) {
      return Array.isArray(columns[name]) ? columns[name].length : -1;
    });
    if (lengths.some(function invalid(length) { return length < 1; })) {
      return "The crossing dataset has a missing column.";
    }
    if (!lengths.every(function same(length) { return length === lengths[0]; })) {
      return "The crossing dataset columns have different lengths.";
    }
    if (Number(data.meta.pointCount) !== lengths[0]) {
      return "The crossing dataset count does not match its metadata.";
    }
    for (let index = 0; index < lengths[0]; index += 1) {
      const radius = columns.R[index];
      if (!Number.isFinite(radius) || (index > 0 && radius <= columns.R[index - 1])) {
        return "The crossing orders are not strictly increasing.";
      }
      if (!Number.isFinite(columns.rho[index])) {
        return "The crossing dataset contains a non-numeric zero.";
      }
    }
    return "";
  }

  function makeModel(data) {
    const columns = data.columns;
    const length = columns.R.length;
    const fractional = new Float64Array(length);
    const prefixBestIndex = new Int32Array(length);
    const prefixNearTenth = new Uint32Array(length);
    const prefixNearHundredth = new Uint32Array(length);
    const prefixNearThousandth = new Uint32Array(length);
    let bestIndex = 0;
    let bestGap = Infinity;
    let nearTenth = 0;
    let nearHundredth = 0;
    let nearThousandth = 0;

    for (let index = 0; index < length; index += 1) {
      const gap = columns.R[index] - Math.floor(columns.R[index]);
      fractional[index] = gap;
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = index;
      }
      if (gap < 0.1) nearTenth += 1;
      if (gap < 0.01) nearHundredth += 1;
      if (gap < 0.001) nearThousandth += 1;
      prefixBestIndex[index] = bestIndex;
      prefixNearTenth[index] = nearTenth;
      prefixNearHundredth[index] = nearHundredth;
      prefixNearThousandth[index] = nearThousandth;
    }

    return {
      data: data,
      columns: columns,
      fractional: fractional,
      prefixBestIndex: prefixBestIndex,
      prefixNearTenth: prefixNearTenth,
      prefixNearHundredth: prefixNearHundredth,
      prefixNearThousandth: prefixNearThousandth,
      minN: Math.floor(columns.R[0]),
      maxN: Math.floor(columns.R[length - 1]),
      reference: data.meta.reference,
    };
  }

  function upperBoundForCutoff(radii, cutoff) {
    // N = floor(R), so N <= cutoff is equivalent to R < cutoff + 1.
    const boundary = cutoff + 1;
    let low = 0;
    let high = radii.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (radii[middle] < boundary) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function formatInteger(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function superscriptInteger(value) {
    const digits = {
      "-": "⁻",
      "0": "⁰",
      "1": "¹",
      "2": "²",
      "3": "³",
      "4": "⁴",
      "5": "⁵",
      "6": "⁶",
      "7": "⁷",
      "8": "⁸",
      "9": "⁹",
    };
    return String(value).split("").map(function toSuperscript(character) {
      return digits[character] || character;
    }).join("");
  }

  function formatGap(value, compact) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    if (value >= 0.001) {
      return value.toFixed(compact ? 4 : 6).replace(/0+$/, "").replace(/\.$/, "");
    }
    const exponent = Math.floor(Math.log10(value));
    const coefficient = value / Math.pow(10, exponent);
    return coefficient.toFixed(compact ? 1 : 2) + " × 10" + superscriptInteger(exponent);
  }

  function makeScaleExamples(model) {
    const bandCount = 5;
    const minimumRadius = 20;
    const maximumRadius = Math.ceil(model.columns.R[model.columns.R.length - 1]);
    const logMinimum = Math.log(minimumRadius);
    const logMaximum = Math.log(maximumRadius);
    const examples = [];

    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const lower = Math.exp(
        logMinimum + bandIndex * (logMaximum - logMinimum) / bandCount
      );
      const upper = Math.exp(
        logMinimum + (bandIndex + 1) * (logMaximum - logMinimum) / bandCount
      );
      let best = null;
      for (let index = 0; index < model.columns.R.length; index += 1) {
        const radius = model.columns.R[index];
        const insideBand = radius >= lower
          && (bandIndex === bandCount - 1 ? radius <= upper : radius < upper);
        if (!insideBand) continue;
        const gap = model.fractional[index];
        const score = -Math.log(gap) / Math.log(radius);
        if (!best || score > best.score) {
          best = { index: index, radius: radius, gap: gap, score: score };
        }
      }
      if (best) {
        best.lower = lower;
        best.upper = upper;
        examples.push(best);
      }
    }
    return examples;
  }

  function renderScaleExamples(model, tableBody) {
    if (!tableBody) return;
    tableBody.textContent = "";
    makeScaleExamples(model).forEach(function renderExample(example) {
      const row = document.createElement("tr");
      const values = [
        String(Math.floor(example.radius)),
        example.radius.toFixed(9),
        formatGap(example.gap, false),
      ];
      const labels = ["integer N", "crossing order R", "gap R − N"];
      values.forEach(function renderValue(value, columnIndex) {
        const cell = document.createElement(columnIndex === 0 ? "th" : "td");
        if (columnIndex === 0) cell.scope = "row";
        cell.dataset.label = labels[columnIndex];
        cell.textContent = value;
        row.appendChild(cell);
      });
      row.dataset.radius = example.radius.toFixed(9);
      tableBody.appendChild(row);
    });
  }

  function niceStep(maximum, targetTicks) {
    const rough = maximum / targetTicks;
    const power = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
    const normalized = rough / power;
    if (normalized <= 1) return power;
    if (normalized <= 2) return 2 * power;
    if (normalized <= 5) return 5 * power;
    return 10 * power;
  }

  function initAbundance() {
    if (singleton) return singleton;

    const elements = collectElements();
    if (!elements.canvas || !elements.canvasWrap) return null;

    const data = global.SCHIFFER_ABUNDANCE_DATA;
    const dataError = validateData(data);
    if (dataError) {
      if (elements.plotState) elements.plotState.textContent = dataError;
      elements.canvas.setAttribute("aria-label", dataError);
      return null;
    }

    const model = makeModel(data);
    renderScaleExamples(model, elements.examplesBody);
    const context = elements.canvas.getContext("2d");
    if (!context) return null;

    const minimumCutoff = model.minN;
    const defaultCutoff = Math.min(200, model.maxN);
    const reducedMotion = global.matchMedia
      ? global.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false };

    const state = {
      cutoff: defaultCutoff,
      visibleCount: 0,
      bestIndex: 0,
      hoverKind: "",
      hoverIndex: -1,
      keyboardIndex: -1,
      playing: false,
      playFrame: 0,
      playStartedAt: 0,
      playFrom: defaultCutoff,
      width: 0,
      height: 0,
      ratio: 1,
      geometry: null,
      resizeObserver: null,
    };

    function cutoffToSlider(cutoff) {
      if (model.maxN <= minimumCutoff) return 0;
      const fraction = (
        Math.log(cutoff) - Math.log(minimumCutoff)
      ) / (
        Math.log(model.maxN) - Math.log(minimumCutoff)
      );
      return Math.round(Math.max(0, Math.min(1, fraction)) * SLIDER_STEPS);
    }

    function sliderToCutoff(sliderValue) {
      if (model.maxN <= minimumCutoff) return model.maxN;
      const fraction = Math.max(0, Math.min(1, sliderValue / SLIDER_STEPS));
      const value = Math.exp(
        Math.log(minimumCutoff)
        + fraction * (Math.log(model.maxN) - Math.log(minimumCutoff))
      );
      return Math.max(minimumCutoff, Math.min(model.maxN, Math.round(value)));
    }

    function stopPlaying() {
      if (state.playFrame) global.cancelAnimationFrame(state.playFrame);
      state.playFrame = 0;
      state.playing = false;
      if (elements.playButton) elements.playButton.setAttribute("aria-pressed", "false");
      if (elements.playIcon) elements.playIcon.textContent = "▶";
      if (elements.playLabel) elements.playLabel.textContent = "Play";
      if (elements.plotState && !paperEdition) elements.plotState.setAttribute("aria-live", "polite");
    }

    function updatePlayControl() {
      if (!elements.playButton) return;
      elements.playButton.setAttribute("aria-pressed", state.playing ? "true" : "false");
      elements.playButton.setAttribute(
        "aria-label",
        state.playing ? "Pause the crossing search" : "Play the crossing search"
      );
      if (elements.playIcon) elements.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
      if (elements.playLabel) {
        elements.playLabel.textContent = state.playing ? "Pause" : "Play";
      }
    }

    function setCanvasSize() {
      const wrapRect = elements.canvasWrap.getBoundingClientRect();
      const canvasRect = elements.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(wrapRect.width || canvasRect.width || 900));
      const height = Math.max(1, Math.round(wrapRect.height || canvasRect.height || 520));
      const ratio = Math.min(global.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (elements.canvas.width !== pixelWidth || elements.canvas.height !== pixelHeight) {
        elements.canvas.width = pixelWidth;
        elements.canvas.height = pixelHeight;
      }
      state.width = width;
      state.height = height;
      state.ratio = ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function geometry() {
      const compact = state.width < 620;
      const margins = compact
        ? { left: 48, right: 17, top: 66, bottom: 54 }
        : { left: 68, right: 26, top: 70, bottom: 62 };
      return {
        compact: compact,
        left: margins.left,
        right: state.width - margins.right,
        top: margins.top,
        bottom: state.height - margins.bottom,
        width: state.width - margins.left - margins.right,
        height: state.height - margins.top - margins.bottom,
      };
    }

    function screenPoint(radius, fraction, plot) {
      const xMaximum = state.cutoff + 1;
      const xMinimum = model.columns.R[0];
      const logarithmicPosition = (
        Math.log(radius) - Math.log(xMinimum)
      ) / (
        Math.log(xMaximum) - Math.log(xMinimum)
      );
      return {
        x: plot.left + logarithmicPosition * plot.width,
        y: plot.bottom - fraction * plot.height,
      };
    }

    function drawBackground(plot) {
      const gradient = context.createLinearGradient(0, 0, 0, state.height);
      gradient.addColorStop(0, COLORS.backgroundTop);
      gradient.addColorStop(1, COLORS.background);
      context.fillStyle = gradient;
      context.fillRect(0, 0, state.width, state.height);

      const bandTop = plot.bottom - NEAR_BAND * plot.height;
      context.fillStyle = "rgba(255,116,73,0.055)";
      context.fillRect(plot.left, bandTop, plot.width, plot.bottom - bandTop);
      context.strokeStyle = "rgba(255,116,73,0.30)";
      context.beginPath();
      context.moveTo(plot.left, bandTop + 0.5);
      context.lineTo(plot.right, bandTop + 0.5);
      context.stroke();
    }

    function drawAxes(plot) {
      context.lineWidth = 1;
      context.font = visualTheme.labelFont;
      context.textBaseline = "middle";
      context.textAlign = "right";

      [0, 0.25, 0.5, 0.75, 1].forEach(function yTick(value) {
        const y = plot.bottom - value * plot.height;
        context.strokeStyle = value === 0 ? visualTheme.lineStrong : COLORS.grid;
        context.beginPath();
        context.moveTo(plot.left, y + 0.5);
        context.lineTo(plot.right, y + 0.5);
        context.stroke();
        context.fillStyle = COLORS.muted;
        context.fillText(value.toFixed(value === 0 || value === 1 ? 0 : 2), plot.left - 10, y);
      });

      context.textAlign = "center";
      context.textBaseline = "top";
      const tickCandidates = plot.compact
        ? [7, 20, 50, 100, 200]
        : [7, 10, 20, 50, 100, 200];
      tickCandidates.filter(function visible(value) {
        return value >= model.columns.R[0] && value <= state.cutoff;
      }).forEach(function drawTick(value) {
        const x = screenPoint(value, 0, plot).x;
        context.strokeStyle = COLORS.grid;
        context.beginPath();
        context.moveTo(x + 0.5, plot.top);
        context.lineTo(x + 0.5, plot.bottom);
        context.stroke();
        context.fillStyle = COLORS.muted;
        context.fillText(formatInteger(value), x, plot.bottom + 10);
      });

      if (!plot.compact) {
        context.save();
        context.translate(15, (plot.top + plot.bottom) / 2);
        context.rotate(-Math.PI / 2);
        context.fillStyle = COLORS.muted;
        context.font = visualTheme.labelFont;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText("FRACTIONAL PART", 0, 0);
        context.restore();
      }

      context.fillStyle = COLORS.muted;
      context.font = visualTheme.labelFont;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText("CROSSING ORDER · LOGARITHMIC SCALE", (plot.left + plot.right) / 2, state.height - 8);

      if (!plot.compact) {
        context.fillStyle = "rgba(255,116,73,0.70)";
        context.font = visualTheme.labelFont;
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(paperEdition ? "NEAR AN INTEGER" : "WITHIN 0.1 ABOVE AN INTEGER", plot.left + 7, plot.bottom - 7);
      }
    }

    function drawLegend(plot) {
      const compact = plot.compact;
      const startX = compact ? plot.left : plot.right - 320;
      const y = 25;
      context.font = visualTheme.labelFont;
      context.textBaseline = "middle";
      context.textAlign = "left";

      context.fillStyle = COLORS.point;
      context.beginPath();
      context.arc(startX, y, 2.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = COLORS.muted;
      context.fillText("COMPUTED CROSSINGS", startX + 8, y);

      const secondX = compact ? startX : startX + 164;
      const secondY = compact ? y + 17 : y;
      context.save();
      context.translate(secondX, secondY);
      context.rotate(Math.PI / 4);
      context.fillStyle = COLORS.orange;
      context.fillRect(-3, -3, 6, 6);
      context.restore();
      context.fillStyle = COLORS.muted;
      context.fillText("REFERENCE EXAMPLE", secondX + 9, secondY);
    }

    function drawSearchPoints(plot) {
      const count = state.visibleCount;
      const radius = count < 350 ? 2.05 : count < 2200 ? 1.6 : 1.2;
      const diameter = Math.max(1.5, radius * 2);

      context.fillStyle = COLORS.point;
      for (let index = 0; index < count; index += 1) {
        if (model.fractional[index] < NEAR_BAND) continue;
        const point = screenPoint(model.columns.R[index], model.fractional[index], plot);
        context.fillRect(point.x - radius, point.y - radius, diameter, diameter);
      }

      context.fillStyle = "rgba(255,116,73,0.82)";
      for (let index = 0; index < count; index += 1) {
        if (model.fractional[index] >= NEAR_BAND) continue;
        const point = screenPoint(model.columns.R[index], model.fractional[index], plot);
        context.beginPath();
        context.arc(point.x, point.y, radius + 0.35, 0, Math.PI * 2);
        context.fill();
      }
    }

    function drawReference(plot) {
      const reference = model.reference;
      if (!reference || Math.floor(reference.R) > state.cutoff) return;
      const point = screenPoint(reference.R, reference.fractionalPart, plot);
      const pulse = state.playing
        ? 1 + 0.12 * Math.sin(global.performance.now() / 210)
        : 1;

      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = COLORS.orange;
      context.fillRect(-4.3 * pulse, -4.3 * pulse, 8.6 * pulse, 8.6 * pulse);
      context.strokeStyle = "rgba(255,244,220,0.92)";
      context.lineWidth = 1.2;
      context.strokeRect(-7.2 * pulse, -7.2 * pulse, 14.4 * pulse, 14.4 * pulse);
      context.restore();

      if (state.width > 520 && state.hoverKind !== "reference") {
        const labelX = Math.min(plot.right - 92, point.x + 18);
        const labelY = Math.max(plot.top + 12, point.y - 24);
        context.strokeStyle = "rgba(255,116,73,0.58)";
        context.beginPath();
        context.moveTo(point.x + 7, point.y - 6);
        context.lineTo(labelX - 5, labelY + 5);
        context.stroke();
        context.fillStyle = COLORS.orange;
        context.font = visualTheme.labelFont;
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText("REFERENCE EXAMPLE", labelX, labelY);
      }
    }

    function drawSelectedPoint(plot) {
      if (state.hoverKind !== "search" || state.hoverIndex < 0) return;
      const index = state.hoverIndex;
      if (index >= state.visibleCount) return;
      const point = screenPoint(model.columns.R[index], model.fractional[index], plot);
      context.strokeStyle = COLORS.teal;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, 6, 0, Math.PI * 2);
      context.stroke();
    }

    function tooltipLines() {
      if (state.hoverKind === "reference") {
        const reference = model.reference;
        return [
          "RUNNING EXAMPLE · SEPARATE REAL CROSSING",
          "order " + reference.R.toFixed(9) + "   fractional part " + reference.fractionalPart.toFixed(9),
          "common zero " + reference.rho.toFixed(9) + "   spectral value " + reference.lambda.toFixed(6),
          "first-order zero 16 · real-order zero 6 · outside the displayed window",
        ];
      }
      if (state.hoverKind === "search" && state.hoverIndex >= 0) {
        const index = state.hoverIndex;
        const radius = model.columns.R[index];
        const rho = model.columns.rho[index];
        const lambda = Math.pow(rho / radius, 2);
        return [
          "EXHAUSTIVE SEARCH CROSSING",
          "order " + radius.toFixed(9) + "   fractional part " + model.fractional[index].toFixed(9),
          "common zero " + rho.toFixed(9) + "   spectral value " + lambda.toFixed(6),
          "first-order zero " + model.columns.n[index]
            + " · window root " + model.columns.localIndex[index],
        ];
      }
      return null;
    }

    function drawTooltip(plot) {
      if (paperEdition) return;
      const lines = tooltipLines();
      if (!lines) return;

      let anchor;
      if (state.hoverKind === "reference") {
        anchor = screenPoint(model.reference.R, model.reference.fractionalPart, plot);
      } else {
        anchor = screenPoint(
          model.columns.R[state.hoverIndex],
          model.fractional[state.hoverIndex],
          plot
        );
      }

      context.font = visualTheme.labelFont;
      const textWidth = lines.reduce(function widest(maximum, line) {
        return Math.max(maximum, context.measureText(line).width);
      }, 0);
      const boxWidth = Math.min(plot.width - 12, textWidth + 24);
      const boxHeight = 72;
      let x = anchor.x + 13;
      let y = anchor.y - boxHeight - 13;
      if (x + boxWidth > plot.right) x = anchor.x - boxWidth - 13;
      if (x < plot.left) x = plot.left + 6;
      if (y < plot.top) y = anchor.y + 13;
      if (y + boxHeight > plot.bottom) y = plot.bottom - boxHeight - 6;

      context.fillStyle = "rgba(12,22,27,0.96)";
      context.fillRect(x, y, boxWidth, boxHeight);
      context.strokeStyle = state.hoverKind === "reference" ? COLORS.orange : COLORS.teal;
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, boxWidth - 1, boxHeight - 1);

      lines.forEach(function line(text, index) {
        context.fillStyle = index === 0
          ? (state.hoverKind === "reference" ? COLORS.orange : COLORS.teal)
          : COLORS.ink;
        context.font = visualTheme.labelFont;
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(text, x + 12, y + 10 + index * 15, boxWidth - 24);
      });
    }

    function updateAccessibleDescription() {
      if (!state.visibleCount) return;
      if (paperEdition) {
        elements.canvas.setAttribute(
          "aria-label",
          "Modulo-one scatter plot of common Bessel zero crossings. The horizontal axis is crossing order on a logarithmic scale, the vertical coordinate is the fractional part of R, orange points lie near an integer, and the diamond marks the running example. Use the left and right arrow keys to move focus among plotted points."
        );
        return;
      }
      const bestGap = model.fractional[state.bestIndex];
      const nearHundredth = model.prefixNearHundredth[state.visibleCount - 1];
      let description = "Modulo-one scatter plot showing "
        + formatInteger(state.visibleCount)
        + " exhaustive Bessel crossings through integer part N="
        + state.cutoff
        + ". "
        + formatInteger(nearHundredth)
        + " are within 0.01 above an integer. The smallest fractional gap is "
        + formatGap(bestGap, false)
        + ". The separate N=28 running example has gap 0.026397.";
      if (state.hoverKind === "search" && state.hoverIndex >= 0) {
        description += " Selected crossing R="
          + model.columns.R[state.hoverIndex].toFixed(9)
          + ", fractional part "
          + model.fractional[state.hoverIndex].toFixed(9)
          + ".";
      } else if (state.hoverKind === "reference") {
        description += " Selected N=28 reference crossing.";
      }
      description += " Use the left and right arrow keys to inspect exhaustive points.";
      elements.canvas.setAttribute("aria-label", description);
    }

    function updateReadouts() {
      const count = state.visibleCount;
      const bestGap = count ? model.fractional[state.bestIndex] : NaN;
      const nearTenth = count ? model.prefixNearTenth[count - 1] : 0;
      const nearHundredth = count ? model.prefixNearHundredth[count - 1] : 0;
      const nearThousandth = count ? model.prefixNearThousandth[count - 1] : 0;

      if (elements.cutoffValue) setMath(elements.cutoffValue, `N\\le ${state.cutoff}`);
      if (elements.countValue) elements.countValue.textContent = paperEdition ? "" : formatInteger(count);
      if (elements.bestValue) elements.bestValue.textContent = paperEdition ? "" : formatGap(bestGap, false);
      if (elements.plotState) {
        elements.plotState.textContent = paperEdition
          ? "common-zero crossing sample"
          : formatInteger(count)
            + " crossings · "
            + formatInteger(nearHundredth)
            + " within 0.01 of an integer";
      }
      if (elements.cutoffRange) {
        elements.cutoffRange.value = String(cutoffToSlider(state.cutoff));
        elements.cutoffRange.style.setProperty(
          "--value",
          (100 * cutoffToSlider(state.cutoff) / SLIDER_STEPS).toFixed(2) + "%"
        );
        elements.cutoffRange.setAttribute(
          "aria-valuetext",
          "Show crossings with integer part N up to " + state.cutoff
        );
      }
      if (!paperEdition) {
        elements.canvas.dataset.nearTenth = String(nearTenth);
        elements.canvas.dataset.nearHundredth = String(nearHundredth);
        elements.canvas.dataset.nearThousandth = String(nearThousandth);
      }
      updateAccessibleDescription();
    }

    function render() {
      setCanvasSize();
      const plot = geometry();
      state.geometry = plot;
      context.clearRect(0, 0, state.width, state.height);
      drawBackground(plot);
      drawAxes(plot);
      drawLegend(plot);
      drawSearchPoints(plot);
      drawReference(plot);
      drawSelectedPoint(plot);
      drawTooltip(plot);
    }

    function setCutoff(nextCutoff, options) {
      const settings = options || {};
      state.cutoff = Math.max(
        minimumCutoff,
        Math.min(model.maxN, Math.round(nextCutoff))
      );
      state.visibleCount = upperBoundForCutoff(model.columns.R, state.cutoff);
      state.bestIndex = state.visibleCount
        ? model.prefixBestIndex[state.visibleCount - 1]
        : 0;
      if (state.hoverKind === "search" && state.hoverIndex >= state.visibleCount) {
        state.hoverKind = "";
        state.hoverIndex = -1;
      }
      if (
        state.hoverKind === "reference"
        && model.reference
        && Math.floor(model.reference.R) > state.cutoff
      ) {
        state.hoverKind = "";
        state.hoverIndex = -1;
      }
      if (state.keyboardIndex >= state.visibleCount) {
        state.keyboardIndex = state.visibleCount - 1;
      }
      updateReadouts();
      render();
      if (!settings.keepPlaying && state.playing) stopPlaying();
    }

    function playTick(timestamp) {
      if (!state.playing) return;
      if (!state.playStartedAt) state.playStartedAt = timestamp;
      const elapsed = timestamp - state.playStartedAt;
      const progress = Math.min(1, elapsed / PLAY_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const logarithmicCutoff = Math.exp(
        Math.log(state.playFrom)
        + eased * (Math.log(model.maxN) - Math.log(state.playFrom))
      );
      setCutoff(logarithmicCutoff, { keepPlaying: true });
      if (progress >= 1 || state.cutoff >= model.maxN) {
        stopPlaying();
        updateReadouts();
        render();
        return;
      }
      state.playFrame = global.requestAnimationFrame(playTick);
    }

    function startPlaying() {
      if (state.playing) {
        stopPlaying();
        render();
        return;
      }
      if (state.cutoff >= model.maxN) setCutoff(minimumCutoff);
      if (reducedMotion.matches) {
        setCutoff(model.maxN);
        return;
      }
      state.playing = true;
      state.playFrom = state.cutoff;
      state.playStartedAt = 0;
      if (elements.plotState && !paperEdition) elements.plotState.setAttribute("aria-live", "off");
      updatePlayControl();
      state.playFrame = global.requestAnimationFrame(playTick);
    }

    function reset() {
      stopPlaying();
      state.hoverKind = "";
      state.hoverIndex = -1;
      state.keyboardIndex = -1;
      setCutoff(defaultCutoff);
      if (elements.cutoffRange) elements.cutoffRange.focus({ preventScroll: true });
    }

    function eventPosition(event) {
      const rect = elements.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function findNearestPoint(position) {
      const plot = state.geometry;
      if (!plot) return { kind: "", index: -1 };
      if (
        position.x < plot.left - 14
        || position.x > plot.right + 14
        || position.y < plot.top - 14
        || position.y > plot.bottom + 14
      ) {
        return { kind: "", index: -1 };
      }

      let bestDistance = 14 * 14;
      let result = { kind: "", index: -1 };
      for (let index = 0; index < state.visibleCount; index += 1) {
        const point = screenPoint(model.columns.R[index], model.fractional[index], plot);
        const dx = point.x - position.x;
        const dy = point.y - position.y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          result = { kind: "search", index: index };
        }
      }

      if (model.reference && Math.floor(model.reference.R) <= state.cutoff) {
        const referencePoint = screenPoint(
          model.reference.R,
          model.reference.fractionalPart,
          plot
        );
        const dx = referencePoint.x - position.x;
        const dy = referencePoint.y - position.y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) result = { kind: "reference", index: -1 };
      }
      return result;
    }

    function selectFromPointer(event) {
      const nearest = findNearestPoint(eventPosition(event));
      if (nearest.kind === state.hoverKind && nearest.index === state.hoverIndex) return;
      state.hoverKind = nearest.kind;
      state.hoverIndex = nearest.index;
      state.keyboardIndex = -1;
      updateAccessibleDescription();
      render();
    }

    function clearPointerSelection() {
      if (state.keyboardIndex >= 0) return;
      state.hoverKind = "";
      state.hoverIndex = -1;
      updateAccessibleDescription();
      render();
    }

    function handleCanvasKeydown(event) {
      if (!state.visibleCount) return;
      let next = state.keyboardIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        next = next < 0 ? 0 : Math.min(state.visibleCount - 1, next + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        next = next < 0 ? state.visibleCount - 1 : Math.max(0, next - 1);
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = state.visibleCount - 1;
      } else {
        return;
      }
      event.preventDefault();
      state.keyboardIndex = next;
      state.hoverKind = "search";
      state.hoverIndex = next;
      updateAccessibleDescription();
      render();
    }

    elements.canvas.style.display = "block";
    elements.canvas.style.width = "100%";
    elements.canvas.style.height = "100%";
    elements.canvas.style.touchAction = "pan-y";
    elements.canvas.tabIndex = 0;
    elements.canvas.setAttribute("role", "img");

    if (elements.plotState && !paperEdition) {
      elements.plotState.setAttribute("role", "status");
      elements.plotState.setAttribute("aria-live", "polite");
      elements.plotState.setAttribute("aria-atomic", "true");
    }

    if (elements.cutoffRange) {
      elements.cutoffRange.min = "0";
      elements.cutoffRange.max = String(SLIDER_STEPS);
      elements.cutoffRange.step = "1";
      elements.cutoffRange.setAttribute("aria-label", "Maximum integer part N shown");
      elements.cutoffRange.setAttribute(
        "title",
        "Logarithmic cutoff: show crossings with integer part N up to this value"
      );
      elements.cutoffRange.dataset.scale = "logarithmic";
      elements.cutoffRange.addEventListener("input", function changeCutoff() {
        setCutoff(sliderToCutoff(Number(elements.cutoffRange.value)));
      });
    }
    if (elements.resetButton) elements.resetButton.addEventListener("click", reset);
    if (elements.playButton) elements.playButton.addEventListener("click", startPlaying);
    elements.canvas.addEventListener("pointermove", selectFromPointer);
    elements.canvas.addEventListener("pointerdown", selectFromPointer);
    elements.canvas.addEventListener("pointerleave", clearPointerSelection);
    elements.canvas.addEventListener("keydown", handleCanvasKeydown);
    elements.canvas.addEventListener("blur", function clearKeyboardSelection() {
      state.keyboardIndex = -1;
      state.hoverKind = "";
      state.hoverIndex = -1;
      updateAccessibleDescription();
      render();
    });

    if (global.ResizeObserver) {
      state.resizeObserver = new ResizeObserver(render);
      state.resizeObserver.observe(elements.canvasWrap);
    } else {
      global.addEventListener("resize", render, { passive: true });
    }
    document.addEventListener("visibilitychange", function pauseWhenHidden() {
      if (document.hidden && state.playing) stopPlaying();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

    updatePlayControl();
    setCutoff(defaultCutoff);

    singleton = {
      setCutoff: setCutoff,
      reset: reset,
      render: render,
      getState: function getState() {
        return {
          cutoff: state.cutoff,
          visibleCount: state.visibleCount,
          bestGap: model.fractional[state.bestIndex],
          playing: state.playing,
        };
      },
    };
    return singleton;
  }

  global.SchifferAbundance = Object.freeze({ init: initAbundance });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAbundance, { once: true });
  } else {
    initAbundance();
  }
})(typeof window !== "undefined" ? window : globalThis);
