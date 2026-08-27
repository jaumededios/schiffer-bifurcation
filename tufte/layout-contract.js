(() => {
  "use strict";

  if (!new URLSearchParams(window.location.search).has("layout-check")) return;

  const rounded = (value) => Math.round(value * 10) / 10;
  const marginSelector = "body.tufte-site main .marginnote";
  const disclosureSelector = "body.tufte-site main details:not(.secondary-controls)";
  const roleSelector = ".paper-copy, .math-statement, .lean-statement, .small-multiples, .figure-band, .margin-figure-sequence, .data-table";

  function runLayoutContract() {
    const errors = [];
    const narrow = window.matchMedia("(max-width: 1000px)").matches;
    const handset = window.matchMedia("(max-width: 760px)").matches;
    const page = document.documentElement.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const reading = parseFloat(rootStyle.getPropertyValue("--measure-reading")) / 100;
    const margin = parseFloat(rootStyle.getPropertyValue("--measure-margin")) / 100;
    const gutter = parseFloat(rootStyle.getPropertyValue("--measure-gutter")) / 100;
    const figure = parseFloat(rootStyle.getPropertyValue("--measure-figure")) / 100;
    const readingInFigure = parseFloat(rootStyle.getPropertyValue("--measure-reading-in-figure")) / 100;
    const typeProof = parseFloat(rootStyle.getPropertyValue("--type-proof")) * parseFloat(rootStyle.fontSize);
    const typeCaption = parseFloat(rootStyle.getPropertyValue("--type-caption")) * parseFloat(rootStyle.fontSize);
    const typeLabel = parseFloat(rootStyle.getPropertyValue("--type-label")) * parseFloat(rootStyle.fontSize);
    const typeControlValue = parseFloat(rootStyle.getPropertyValue("--type-control-value")) * parseFloat(rootStyle.fontSize);
    const typeCode = parseFloat(rootStyle.getPropertyValue("--type-code")) * parseFloat(rootStyle.fontSize);

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

    document.querySelectorAll("lean-statement").forEach((host, index) => {
      errors.push(`Lean statement host ${index + 1} was not rendered${host.dataset.statement ? ` (${host.dataset.statement})` : ""}`);
    });

    const expectedLeanStatements = [
      "pompeiu-property",
      "disk-not-pompeiu",
      "schiffer-property",
      "schiffer-pompeiu-equivalence",
      "schiffer-star-shaped",
    ];
    const actualLeanStatements = Array.from(document.querySelectorAll("details.lean-statement"), (statement) => statement.dataset.statement);
    if (actualLeanStatements.length !== expectedLeanStatements.length
        || expectedLeanStatements.some((key, index) => actualLeanStatements[index] !== key)) {
      errors.push("Lean counterparts do not follow the mathematical narrative");
    }

    const expectedSectionOrder = [
      "introduction",
      "linear-rigidity",
      "geometric-escape",
      "experiment",
      "references",
    ];
    const actualSectionOrder = Array.from(document.querySelectorAll("main > section[id]"), (section) => section.id);
    if (actualSectionOrder.length !== expectedSectionOrder.length
        || expectedSectionOrder.some((id, index) => actualSectionOrder[index] !== id)) {
      errors.push("top-level sections do not follow source reading order");
    }

    if (!document.querySelector("#linear-rigidity > #borrow-flexibility")) {
      errors.push("cylinder and sphere material is not nested inside Section II");
    }
    if (document.querySelector("main > #borrow-flexibility")) {
      errors.push("borrowed-flexibility material is still a top-level section");
    }
    const expectedProofSectionOrder = [
      "debye-experiment",
      "phase-story",
      "abundance-experiment",
      "cone-experiment",
      "modes-experiment",
    ];
    const actualProofSectionOrder = Array.from(document.querySelectorAll("#experiment > section[id]"), (section) => section.id);
    if (actualProofSectionOrder.length !== expectedProofSectionOrder.length
        || expectedProofSectionOrder.some((id, index) => actualProofSectionOrder[index] !== id)) {
      errors.push("Section IV proof subsections do not follow source reading order");
    }

    const expectedProofContents = [
      ["4.1", "#half-cylinder-strategy"],
      ["4.2", "#debye-experiment"],
      ["4.3", "#phase-story"],
      ["4.4", "#abundance-experiment"],
      ["4.5", "#cone-experiment"],
    ];
    const actualProofContents = Array.from(document.querySelectorAll(".site-toc .toc-subsection"), (link) => [
      link.querySelector("b")?.textContent.trim(),
      link.getAttribute("href"),
    ]);
    if (expectedProofContents.some(([number, href], index) => {
      const actual = actualProofContents[index];
      return !actual || actual[0] !== number || actual[1] !== href;
    })) {
      errors.push("proof contents do not match the authored dependency order");
    }

    document.querySelectorAll("details.optional-digression").forEach((details, index) => {
      const summary = details.querySelector(":scope > summary");
      const span = summary?.querySelector(":scope > span");
      const label = span?.querySelector(":scope > small");
      if (!summary || !span || label?.textContent.trim() !== "Optional digression") {
        errors.push(`optional digression ${index + 1} does not use the shared summary grammar`);
      }
    });
    const optionalTitles = Array.from(document.querySelectorAll("details.optional-digression > summary > span"), (span) => {
      const label = span.querySelector(":scope > small");
      return Array.from(span.childNodes)
        .filter((node) => node !== label)
        .map((node) => node.textContent)
        .join("")
        .trim();
    });
    [
      "The Schiffer property implies failure of the Pompeiu property",
      "Failure of the Pompeiu property implies the Schiffer property",
      "Berenstein conjecture: What if we switch the Neumann and Dirichlet conditions?",
    ].forEach((title) => {
      if (!optionalTitles.includes(title)) errors.push(`missing optional digression: ${title}`);
    });

    const coneSection = document.querySelector("#experiment > #cone-experiment");
    if (!coneSection?.getClientRects().length) errors.push("the cone continuation is not visible");
    if (!coneSection?.querySelector(":scope > .abundance-conclusion")) {
      errors.push("the landing argument is not attached to the continuation section");
    }
    const transferTheorem = document.querySelector("#debye-experiment .real-order-bridge");
    const transferEvidence = document.querySelector("#debye-experiment .debye-conclusion");
    if (!transferTheorem || !transferEvidence || !(transferEvidence.compareDocumentPosition(transferTheorem) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      errors.push("the cone transfer theorem appears before its limiting evidence");
    }
    if (document.querySelector("#modes-experiment .collar-limit-argument")) {
      errors.push("the landing zoom repeats machinery established before the landing");
    }
    const halfCylinderSequence = [
      document.querySelector("#experiment .cylinder-theorem"),
      document.querySelector("#experiment .cylinder-spectral-seed"),
      document.querySelector("#experiment .cylinder-jet-proof"),
      document.querySelector("#experiment .experiment-story-lead"),
      document.querySelector("#experiment > .laboratory"),
    ];
    if (halfCylinderSequence.some((node) => !node) || halfCylinderSequence.some((node, index) => {
      if (!index) return false;
      return !(halfCylinderSequence[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    })) {
      errors.push("Subsection 4.1 does not follow theorem, expansion, applet order");
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
      const formalStatement = details.classList.contains("lean-statement");
      const expectedWidth = detailsBox.width * (formalStatement || narrow ? 1 : readingInFigure);
      if (Math.abs(summaryBox.width - expectedWidth) > 2) {
        errors.push(`reading disclosure ${index + 1} rule is not on the reading measure`);
      }
      if (Math.abs(summaryBox.left - detailsBox.left) > 1) {
        errors.push(`reading disclosure ${index + 1} is not aligned with the reading measure`);
      }
      if (formalStatement) {
        if (![detailsStyle.borderTopWidth, detailsStyle.borderRightWidth, detailsStyle.borderBottomWidth, detailsStyle.borderLeftWidth]
          .every((value) => parseFloat(value) > 0)) {
          errors.push(`Lean statement ${index + 1} is missing its disclosure frame`);
        }
        if (!details.querySelector(":scope > .lean-statement-body > pre > code")) {
          errors.push(`Lean statement ${index + 1} has no direct code body`);
        }
        if (details.open) {
          const pre = details.querySelector(":scope > .lean-statement-body > pre");
          const code = pre?.querySelector(":scope > code.language-lean");
          if (pre && code) {
            const preBox = pre.getBoundingClientRect();
            const codeBox = code.getBoundingClientRect();
            if (Math.abs(codeBox.left - preBox.left) > 1 || codeBox.width < preBox.width - 1) {
              errors.push(`Lean statement ${index + 1} code viewport collapsed inside its disclosure`);
            }
            if (code.textContent.includes("abbrev")
                && !Array.from(code.querySelectorAll(".hljs-keyword"), (token) => token.textContent).includes("abbrev")) {
              errors.push(`Lean statement ${index + 1} does not highlight Lean 4 abbrev declarations`);
            }
          }
        }
      } else {
        if (parseFloat(detailsStyle.borderTopWidth) || parseFloat(detailsStyle.borderBottomWidth)) {
          errors.push(`reading disclosure ${index + 1} leaks a border across its full parent`);
        }
        if (!parseFloat(summaryStyle.borderTopWidth) || !parseFloat(summaryStyle.borderBottomWidth)) {
          errors.push(`reading disclosure ${index + 1} is missing its summary rules`);
        }
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

    document.querySelectorAll("body.tufte-site main .formal-statement-pair").forEach((pair, index) => {
      const statement = pair.querySelector(":scope > .math-statement");
      const lean = pair.querySelector(":scope > .lean-statement");
      if (!statement || !lean) {
        errors.push(`formal statement pair ${index + 1} lacks prose or Lean`);
        return;
      }
      const pairBox = pair.getBoundingClientRect();
      const expectedWidth = sectionMeasure(pair, narrow ? 1 : reading);
      if (Math.abs(pairBox.width - expectedWidth) > 2) {
        errors.push(`formal statement pair ${index + 1} is outside the reading measure`);
      }
      [statement, lean].forEach((child) => {
        const childBox = child.getBoundingClientRect();
        if (Math.abs(childBox.left - pairBox.left) > 1 || Math.abs(childBox.width - pairBox.width) > 2) {
          errors.push(`formal statement pair ${index + 1} has mismatched counterparts`);
        }
      });
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

    document.querySelectorAll("body.tufte-site main :is(.figure-band, .small-multiples, .interactive-plate)").forEach((element, index) => {
      if (!element.getClientRects().length) return;
      const style = getComputedStyle(element);
      if ([style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push(`visual role ${index + 1} regained an outer card border`);
      }
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

    document.querySelectorAll("body.tufte-site main .margin-figure-sequence").forEach((sequence, index) => {
      if (!sequence.getClientRects().length) return;
      const box = sequence.getBoundingClientRect();
      const expectedWidth = sectionMeasure(sequence, narrow ? 1 : figure);
      if (Math.abs(box.width - expectedWidth) > 2) {
        errors.push(`margin-figure sequence ${index + 1} is outside the figure measure`);
      }
      sequence.querySelectorAll(":scope > .margin-figure-row").forEach((row, rowIndex) => {
        const visual = row.querySelector(":scope > .margin-figure");
        const prose = row.querySelector(":scope > :is(span, h3, p)");
        if (!visual || !prose) {
          errors.push(`margin-figure row ${index + 1}.${rowIndex + 1} lacks direct prose or a direct margin figure`);
          return;
        }
        const rowStyle = getComputedStyle(row);
        const visualStyle = getComputedStyle(visual);
        if ([rowStyle.borderTopWidth, rowStyle.borderRightWidth, rowStyle.borderBottomWidth, rowStyle.borderLeftWidth,
          visualStyle.borderTopWidth, visualStyle.borderRightWidth, visualStyle.borderBottomWidth, visualStyle.borderLeftWidth]
          .some((value) => parseFloat(value) > 0)) {
          errors.push(`margin-figure row ${index + 1}.${rowIndex + 1} has card rules`);
        }
        if (!narrow) {
          const visualBox = visual.getBoundingClientRect();
          const proseBox = prose.getBoundingClientRect();
          if (visualBox.left < proseBox.right + 4) {
            errors.push(`margin figure ${index + 1}.${rowIndex + 1} enters the reading measure`);
          }
          if (Math.abs(visualBox.top - proseBox.top) > 1) {
            errors.push(`margin figure ${index + 1}.${rowIndex + 1} is not top-aligned with its prose`);
          }
        }
      });
    });

    const comparisonCells = Array.from(document.querySelectorAll("body.tufte-site main .intro-shapes .intro-shape-media"));
    if (comparisonCells.length !== 4) {
      errors.push(`comparison gallery has ${comparisonCells.length} cells instead of 4`);
    } else {
      const reference = comparisonCells[0].getBoundingClientRect();
      comparisonCells.forEach((cell, index) => {
        const box = cell.getBoundingClientRect();
        if (Math.abs(box.width - box.height) > 1) errors.push(`comparison cell ${index + 1} is not square`);
        if (Math.abs(box.width - reference.width) > 1 || Math.abs(box.height - reference.height) > 1) {
          errors.push(`comparison cell ${index + 1} does not share the gallery shape`);
        }
      });
      const galleryStyle = getComputedStyle(comparisonCells[0].closest(".intro-shapes"));
      if ([galleryStyle.borderTopWidth, galleryStyle.borderRightWidth, galleryStyle.borderBottomWidth, galleryStyle.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push("comparison gallery has plate rules");
      }
      if (!narrow) {
        const gallery = comparisonCells[0].closest(".intro-shapes");
        const galleryBox = gallery.getBoundingClientRect();
        const copy = document.querySelector(".construction-flow");
        const copyBox = copy?.getBoundingClientRect();
        const sectionBox = gallery.closest("main > section").getBoundingClientRect();
        const expectedGalleryWidth = sectionBox.width * margin;
        const expectedCopyWidth = sectionBox.width * reading;
        const expectedGap = sectionBox.width * gutter;
        if (copyBox && Math.abs(copyBox.width - expectedCopyWidth) > 2) {
          errors.push("construction prose no longer keeps the reading measure");
        }
        if (Math.abs(galleryBox.width - expectedGalleryWidth) > 2) {
          errors.push("comparison gallery does not occupy the canonical margin measure");
        }
        if (copyBox && galleryBox.left < copyBox.right + expectedGap - 2) {
          errors.push("comparison gallery intrudes into the construction prose measure");
        }
        if (galleryBox.right > sectionBox.right + 1) {
          errors.push("comparison gallery leaves the canonical page measure");
        }
      }
    }

    document.querySelectorAll("body.tufte-site main .tex-display").forEach((display, index) => {
      if (!display.getClientRects().length) return;
      if (display.clientWidth <= 1) return;
      if (display.scrollWidth > display.clientWidth + 1) {
        errors.push(`display equation ${index + 1} overflows its semantic measure by ${rounded(display.scrollWidth - display.clientWidth)}px`);
      }
    });

    document.querySelectorAll(`body.tufte-site main :is(${roleSelector})`).forEach((element, index) => {
      const roles = ["paper-copy", "math-statement", "lean-statement", "small-multiples", "figure-band", "margin-figure-sequence", "data-table"]
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
    checkType("body.tufte-site main .lean-statement > summary small", typeLabel, "Lean disclosure label");
    checkType("body.tufte-site main .lean-statement :is(summary code, pre code)", typeCode, "Lean source");

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
      const plateBox = plate.getBoundingClientRect();
      [controls, visual].forEach((child, childIndex) => {
        const childStyle = getComputedStyle(child);
        if ([childStyle.borderTopWidth, childStyle.borderRightWidth, childStyle.borderBottomWidth, childStyle.borderLeftWidth]
          .some((value) => parseFloat(value) > 0)) {
          errors.push(`interactive plate ${index + 1} ${childIndex ? "visual" : "controls"} regained card rules`);
        }
      });
      if (narrow) {
        if (controlBox.top < visualBox.bottom - 1) errors.push(`interactive plate ${index + 1} controls are not below its visual`);
        if (Math.abs(visualBox.width - plateBox.width) > 2) {
          errors.push(`interactive plate ${index + 1} visual does not fill the narrow measure`);
        }
        if (Math.abs(controlBox.width - plateBox.width) > 2) {
          errors.push(`interactive plate ${index + 1} controls do not fill the narrow measure`);
        }
      } else {
        if (controlBox.left < visualBox.right - 1) errors.push(`interactive plate ${index + 1} controls are not to the right of its visual`);
        if (Math.abs(controlBox.top - visualBox.top) > 1) errors.push(`interactive plate ${index + 1} control and visual tops do not align`);
        const expectedVisualWidth = plateBox.width * reading;
        const expectedControlWidth = plateBox.width * margin;
        const expectedGap = plateBox.width * gutter;
        if (Math.abs(visualBox.width - expectedVisualWidth) > 2) {
          errors.push(`interactive plate ${index + 1} visual is not on the reading measure`);
        }
        if (Math.abs(controlBox.width - expectedControlWidth) > 2) {
          errors.push(`interactive plate ${index + 1} controls are not on the margin measure`);
        }
        if (Math.abs(controlBox.left - (visualBox.right + expectedGap)) > 2) {
          errors.push(`interactive plate ${index + 1} does not preserve the reading-gutter-margin rhythm`);
        }
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
      marginFigureSequences: document.querySelectorAll("body.tufte-site main .margin-figure-sequence").length,
      dataTables: document.querySelectorAll("body.tufte-site main .data-table").length,
      leanStatements: document.querySelectorAll("body.tufte-site main .lean-statement").length,
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
  document.addEventListener("toggle", (event) => {
    if (event.target instanceof HTMLDetailsElement) requestAnimationFrame(runLayoutContract);
  }, true);
})();
