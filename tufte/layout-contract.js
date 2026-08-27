(() => {
  "use strict";

  if (!new URLSearchParams(window.location.search).has("layout-check")) return;

  const rounded = (value) => Math.round(value * 10) / 10;
  const marginSelector = "body.tufte-site main .marginnote";
  const disclosureSelector = "body.tufte-site main details:not(.secondary-controls)";
  const roleSelector = ".paper-copy, .math-statement, .small-multiples, .figure-band, .data-table";

  function runLayoutContract() {
    const errors = [];
    const narrow = window.matchMedia("(max-width: 1000px)").matches;
    const handset = window.matchMedia("(max-width: 760px)").matches;
    const page = document.documentElement.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const reading = parseFloat(rootStyle.getPropertyValue("--measure-reading")) / 100;
    const figure = parseFloat(rootStyle.getPropertyValue("--measure-figure")) / 100;
    const readingInFigure = parseFloat(rootStyle.getPropertyValue("--measure-reading-in-figure")) / 100;
    const typeProof = parseFloat(rootStyle.getPropertyValue("--type-proof")) * parseFloat(rootStyle.fontSize);
    const typeCaption = parseFloat(rootStyle.getPropertyValue("--type-caption")) * parseFloat(rootStyle.fontSize);
    const typeLabel = parseFloat(rootStyle.getPropertyValue("--type-label")) * parseFloat(rootStyle.fontSize);
    const typeControlValue = parseFloat(rootStyle.getPropertyValue("--type-control-value")) * parseFloat(rootStyle.fontSize);

    const sectionMeasure = (element, ratio) => {
      const section = element.closest("main > section");
      const parent = element.parentElement;
      if (!section || !parent) return element.getBoundingClientRect().width;
      return Math.min(parent.getBoundingClientRect().width, section.getBoundingClientRect().width * ratio);
    };

    const checkType = (selector, expected, label) => {
      document.querySelectorAll(selector).forEach((element, index) => {
        if (!element.getClientRects().length) return;
        const actual = parseFloat(getComputedStyle(element).fontSize);
        if (Math.abs(actual - expected) > .2) {
          errors.push(`${label} ${index + 1} uses ${rounded(actual)}px instead of ${rounded(expected)}px`);
        }
      });
    };

    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      errors.push(`page overflows by ${document.documentElement.scrollWidth - window.innerWidth}px`);
    }

    const expectedSectionOrder = [
      "introduction",
      "borrow-flexibility",
      "geometric-escape",
      "experiment",
      "debye-experiment",
      "phase-story",
      "cone-experiment",
      "modes-experiment",
      "abundance-experiment",
      "references",
    ];
    const actualSectionOrder = Array.from(document.querySelectorAll("main > section[id]"), (section) => section.id);
    if (expectedSectionOrder.some((id, index) => actualSectionOrder[index] !== id)) {
      errors.push("top-level sections do not follow source reading order");
    }

    document.querySelectorAll(marginSelector).forEach((aside, index) => {
      const style = getComputedStyle(aside);
      const toggle = aside.previousElementSibling;
      const label = toggle?.previousElementSibling;
      if (!(toggle instanceof HTMLInputElement) || !toggle.classList.contains("margin-toggle")) {
        errors.push(`margin aside ${index + 1} has no adjacent margin toggle`);
      }
      if (!(label instanceof HTMLLabelElement) || label.htmlFor !== toggle?.id) {
        errors.push(`margin aside ${index + 1} has no matching toggle label`);
      }
      if (narrow) {
        const shouldShow = toggle instanceof HTMLInputElement && toggle.checked;
        if ((style.display !== "none") !== shouldShow) {
          errors.push(`margin aside ${index + 1} does not follow its mobile toggle`);
        }
        return;
      }

      const box = aside.getBoundingClientRect();
      const host = aside.parentElement.getBoundingClientRect();
      if (style.display === "none") errors.push(`margin aside ${index + 1} is hidden on desktop`);
      if (box.left < host.right + 4) {
        errors.push(`margin aside ${index + 1} enters the reading measure by ${rounded(host.right - box.left)}px`);
      }
      if (box.right > page.right + 1) {
        errors.push(`margin aside ${index + 1} leaves the page by ${rounded(box.right - page.right)}px`);
      }
    });

    document.querySelectorAll(disclosureSelector).forEach((details, index) => {
      const summary = details.querySelector(":scope > summary");
      if (!summary) {
        errors.push(`reading disclosure ${index + 1} has no direct summary`);
        return;
      }
      const detailsBox = details.getBoundingClientRect();
      const summaryBox = summary.getBoundingClientRect();
      const detailsStyle = getComputedStyle(details);
      const summaryStyle = getComputedStyle(summary);
      const expectedWidth = detailsBox.width * (narrow ? 1 : readingInFigure);
      if (Math.abs(summaryBox.width - expectedWidth) > 2) {
        errors.push(`reading disclosure ${index + 1} rule is not on the reading measure`);
      }
      if (Math.abs(summaryBox.left - detailsBox.left) > 1) {
        errors.push(`reading disclosure ${index + 1} is not aligned with the reading measure`);
      }
      if (parseFloat(detailsStyle.borderTopWidth) || parseFloat(detailsStyle.borderBottomWidth)) {
        errors.push(`reading disclosure ${index + 1} leaks a border across its full parent`);
      }
      if (!parseFloat(summaryStyle.borderTopWidth) || !parseFloat(summaryStyle.borderBottomWidth)) {
        errors.push(`reading disclosure ${index + 1} is missing its summary rules`);
      }
      const body = details.classList.contains("proof-details")
        ? Array.from(details.children).find((child) => child !== summary)
        : null;
      if (body && body.getClientRects().length) {
        const bodyBox = body.getBoundingClientRect();
        const expectedBodyWidth = detailsBox.width * (narrow ? 1 : readingInFigure);
        if (Math.abs(bodyBox.left - detailsBox.left) > 1 || Math.abs(bodyBox.width - expectedBodyWidth) > 2) {
          errors.push(`reading disclosure ${index + 1} proof body is outside the reading measure`);
        }
      }
    });

    document.querySelectorAll("body.tufte-site main .math-statement").forEach((statement, index) => {
      if (!statement.matches("article")) errors.push(`math statement ${index + 1} is not an article`);
      if (!statement.querySelector(":scope > .math-statement-header")) errors.push(`math statement ${index + 1} has no direct header`);
      if (!statement.querySelector(":scope > .math-statement-body")) errors.push(`math statement ${index + 1} has no direct body`);
      const box = statement.getBoundingClientRect();
      const expectedWidth = sectionMeasure(statement, narrow ? 1 : reading);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`math statement ${index + 1} is outside its semantic measure`);
    });

    document.querySelectorAll("body.tufte-site main .paper-copy").forEach((copy, index) => {
      if (!copy.getClientRects().length) return;
      const box = copy.getBoundingClientRect();
      const expectedWidth = sectionMeasure(copy, narrow ? 1 : reading);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`paper copy ${index + 1} is outside the reading measure`);
      if (copy.classList.contains("figure-band") || copy.classList.contains("small-multiples")) {
        errors.push(`paper copy ${index + 1} also claims a wide-measure role`);
      }
    });

    document.querySelectorAll("body.tufte-site main .small-multiples").forEach((multiple, index) => {
      if (!multiple.getClientRects().length) return;
      const box = multiple.getBoundingClientRect();
      const expectedWidth = sectionMeasure(multiple, narrow ? 1 : figure);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`small multiple ${index + 1} is outside the figure measure`);
      if (multiple.classList.contains("figure-band")) errors.push(`small multiple ${index + 1} also claims the figure role`);
    });

    document.querySelectorAll("body.tufte-site main .data-table").forEach((table, index) => {
      if (!table.querySelector("table")) errors.push(`data table ${index + 1} has no table element`);
      const box = table.getBoundingClientRect();
      const expectedWidth = sectionMeasure(table, narrow ? 1 : reading);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`data table ${index + 1} is outside the reading measure`);
    });

    document.querySelectorAll("body.tufte-site main .figure-band").forEach((band, index) => {
      if (!band.getClientRects().length) return;
      const box = band.getBoundingClientRect();
      const parentBox = band.parentElement.getBoundingClientRect();
      const expectedWidth = parentBox.width * (narrow ? 1 : figure);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`figure band ${index + 1} is outside the figure measure`);
      if (Math.abs(box.left - parentBox.left) > 1) errors.push(`figure band ${index + 1} is not aligned with the page grammar`);
      if (!band.querySelector("canvas, svg, img, picture, video")) errors.push(`figure band ${index + 1} contains no visual`);
    });

    document.querySelectorAll("body.tufte-site main .tex-display").forEach((display, index) => {
      if (!display.getClientRects().length) return;
      if (display.clientWidth <= 1) return;
      if (display.scrollWidth > display.clientWidth + 1) {
        errors.push(`display equation ${index + 1} overflows its semantic measure by ${rounded(display.scrollWidth - display.clientWidth)}px`);
      }
    });

    document.querySelectorAll(`body.tufte-site main :is(${roleSelector})`).forEach((element, index) => {
      const roles = ["paper-copy", "math-statement", "small-multiples", "figure-band", "data-table"]
        .filter((role) => element.classList.contains(role));
      if (roles.length > 1) errors.push(`editorial role ${index + 1} is ambiguous: ${roles.join(" + ")}`);
    });

    checkType("body.tufte-site main .paper-copy:not(.phase-story-lead):not(.debye-lead):not(.abundance-lead) p:not(.eyebrow)", typeProof, "proof paragraph");
    checkType("body.tufte-site main .math-statement:not(.math-statement-problem):not(.math-statement-conjecture) .math-statement-body p", typeProof, "statement paragraph");
    checkType("body.tufte-site main :is(figcaption, .formula-note, .phase-family-note, .collar-field-caption)", typeCaption, "caption");
    checkType("body.tufte-site main :is(.control-heading, .control-label, .play-button, .axis-footer)", typeLabel, "apparatus label");
    checkType("body.tufte-site main :is(.small-multiples article > span, .cylinder-proof-grid article > span)", typeLabel, "editorial label");
    checkType("body.tufte-site main :is(.solver-readout, .modes-status, .phase-story-readout, .collar-field-readout, .debye-status, .abundance-readout) span", typeLabel, "readout label");
    checkType("body.tufte-site main :is(.solver-readout, .modes-status, .phase-story-readout, .collar-field-readout, .debye-status, .abundance-readout) strong, body.tufte-site main .measurement-value-line strong", typeControlValue, "readout value");

    document.querySelectorAll(".interactive-plate").forEach((plate, index) => {
      if (getComputedStyle(plate).display === "none" || !plate.getClientRects().length) return;
      const controls = plate.querySelector(":scope > aside");
      const visual = plate.querySelector(":scope > section");
      if (!controls || !visual) {
        errors.push(`interactive plate ${index + 1} is missing a direct control or visual child`);
        return;
      }
      const plateStyle = getComputedStyle(plate);
      if ([plateStyle.borderTopWidth, plateStyle.borderRightWidth, plateStyle.borderBottomWidth, plateStyle.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push(`interactive plate ${index + 1} has an outer card border`);
      }
      const controlBox = controls.getBoundingClientRect();
      const visualBox = visual.getBoundingClientRect();
      if (narrow) {
        if (controlBox.top < visualBox.bottom - 1) errors.push(`interactive plate ${index + 1} controls are not below its visual`);
      } else {
        if (controlBox.left < visualBox.right - 1) errors.push(`interactive plate ${index + 1} controls are not to the right of its visual`);
        if (Math.abs(controlBox.top - visualBox.top) > 1) errors.push(`interactive plate ${index + 1} control and visual tops do not align`);
      }

      visual.querySelectorAll(":scope > article > header").forEach((header, panelIndex) => {
        const title = header.querySelector(":scope > strong");
        if (!title || !title.getClientRects().length) return;
        const headerBox = header.getBoundingClientRect();
        const titleBox = title.getBoundingClientRect();
        if (titleBox.bottom > headerBox.bottom + 1 || titleBox.right > headerBox.right + 1) {
          errors.push(`interactive plate ${index + 1} panel heading ${panelIndex + 1} escapes its header`);
        }
      });

      visual.querySelectorAll("canvas").forEach((canvas) => {
        const box = canvas.getBoundingClientRect();
        if (!box.width || !box.height || !canvas.width || !canvas.height) return;
        const cssRatio = box.width / box.height;
        const bitmapRatio = canvas.width / canvas.height;
        if (Math.abs(cssRatio / bitmapRatio - 1) > .01) {
          errors.push(`${canvas.id || "unnamed canvas"} has mismatched CSS and bitmap aspect ratios`);
        }
      });

      visual.querySelectorAll(":scope > :is(.canvas-wrap, .geometry-canvas-wrap, .modes-canvas-wrap, .phase-story-canvas-wrap, .debye-canvas-wrap, .abundance-canvas-wrap), :scope > article > .collar-field-canvas-wrap").forEach((wrap) => {
        const box = wrap.getBoundingClientRect();
        if (handset && box.height > Math.max(520, box.width * 1.6)) {
          errors.push(`interactive plate ${index + 1} has an implausibly tall narrow plot`);
        }
      });
    });

    const result = {
      ok: errors.length === 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      margins: document.querySelectorAll(marginSelector).length,
      disclosures: document.querySelectorAll(disclosureSelector).length,
      statements: document.querySelectorAll("body.tufte-site main .math-statement").length,
      paperCopies: document.querySelectorAll("body.tufte-site main .paper-copy").length,
      smallMultiples: document.querySelectorAll("body.tufte-site main .small-multiples").length,
      figureBands: document.querySelectorAll("body.tufte-site main .figure-band").length,
      dataTables: document.querySelectorAll("body.tufte-site main .data-table").length,
      plates: document.querySelectorAll(".interactive-plate").length,
      errors,
    };
    window.__TUFTE_LAYOUT_CHECK__ = result;
    document.documentElement.dataset.layoutContract = result.ok ? "pass" : "fail";
    if (!result.ok) console.error("Tufte layout contract failed", errors);
    return result;
  }

  window.__runTufteLayoutContract = runLayoutContract;

  window.addEventListener("load", () => {
    requestAnimationFrame(() => requestAnimationFrame(runLayoutContract));
  });
  window.addEventListener("resize", () => requestAnimationFrame(runLayoutContract));
})();
