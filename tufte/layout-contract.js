(() => {
  "use strict";

  const headingSelector = "body.tufte-site main .section-heading[data-number][data-title]";
  const tocClassByLevel = {
    section: "",
    subsection: "toc-nested",
    "proof-subsection": "toc-subsection",
  };

  const normalizeText = (value) => (value || "")
    .replace(/\s+/g, " ")
    .trim();

  const headingTarget = (heading) => {
    if (heading.dataset.target) return document.querySelector(heading.dataset.target);
    if (heading.id) return heading;
    return heading.closest("[id]") || heading.querySelector("[id]");
  };

  const headingTitleElement = (heading) => heading.querySelector(":scope > :is(h2, h3)");

  const tocHeadings = () => Array.from(document.querySelectorAll(headingSelector))
    .filter((heading) => Object.prototype.hasOwnProperty.call(tocClassByLevel, heading.dataset.toc || ""));

  function renderTableOfContents() {
    const nav = document.querySelector(".site-toc nav[data-toc-nav]");
    if (!nav) return;
    nav.replaceChildren(...tocHeadings().map((heading) => {
      const link = document.createElement("a");
      const level = heading.dataset.toc;
      const target = headingTarget(heading);
      const className = tocClassByLevel[level];
      if (className) link.classList.add(className);
      link.href = target ? `#${target.id}` : "#";
      const number = document.createElement("b");
      number.textContent = heading.dataset.number;
      const title = document.createElement("span");
      title.textContent = heading.dataset.title;
      link.append(number, title);
      return link;
    }));
  }

  renderTableOfContents();

  /* Display mathematics is authored semantically; the layout layer fits the
     rendered KaTeX to whichever editorial measure contains it.  Resetting to
     the canonical size before every measurement prevents resize history from
     becoming part of the result. */
  let mathFitFrame = 0;
  const fitDisplayMath = () => {
    mathFitFrame = 0;
    const displays = Array.from(document.querySelectorAll("body.tufte-site main .tex-display"))
      .filter((display) => display.querySelector(".katex"));
    displays.forEach((display) => {
      display.classList.remove("math-fitted");
      display.style.removeProperty("--math-size");
    });
    requestAnimationFrame(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const baseSize = parseFloat(rootStyle.getPropertyValue("--type-math"))
        * parseFloat(rootStyle.fontSize);
      displays.forEach((display) => {
        const available = display.clientWidth;
        const required = display.scrollWidth;
        if (available <= 1 || required <= available + 1) return;
        const fittedSize = baseSize * Math.min(1, (available - 2) / required) * .99;
        display.style.setProperty("--math-size", `${fittedSize}px`);
        display.classList.add("math-fitted");
      });
    });
  };
  const scheduleMathFit = () => {
    if (mathFitFrame) cancelAnimationFrame(mathFitFrame);
    mathFitFrame = requestAnimationFrame(fitDisplayMath);
  };

  scheduleMathFit();
  window.addEventListener("load", scheduleMathFit);
  window.addEventListener("resize", scheduleMathFit);
  document.fonts?.ready.then(scheduleMathFit);
  const main = document.querySelector("main");
  if (main) new MutationObserver(scheduleMathFit).observe(main, { childList: true, subtree: true });

  if (!new URLSearchParams(window.location.search).has("layout-check")) return;

  const rounded = (value) => Math.round(value * 10) / 10;
  const marginSelector = "body.tufte-site main .marginnote";
  const disclosureSelector = "body.tufte-site main details:not(.secondary-controls)";
  const roleSelector = ".paper-copy, .math-statement, .lean-statement, .small-multiples, .figure-band, .reading-figure, .margin-figure-sequence, .data-table";

  function runLayoutContract() {
    const errors = [];
    const narrow = window.matchMedia("(max-width: 1000px)").matches;
    const handset = window.matchMedia("(max-width: 760px)").matches;
    const page = document.documentElement.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const reading = parseFloat(rootStyle.getPropertyValue("--measure-reading")) / 100;
    const aside = parseFloat(rootStyle.getPropertyValue("--measure-aside")) / 100;
    const noteInReading = parseFloat(rootStyle.getPropertyValue("--measure-note-in-reading")) / 100;
    const gutter = parseFloat(rootStyle.getPropertyValue("--measure-gutter")) / 100;
    const figure = parseFloat(rootStyle.getPropertyValue("--measure-figure")) / 100;
    const readingInFigure = parseFloat(rootStyle.getPropertyValue("--measure-reading-in-figure")) / 100;
    const mobileNote = parseFloat(rootStyle.getPropertyValue("--measure-mobile-note")) / 100;
    const typeProof = parseFloat(rootStyle.getPropertyValue("--type-proof")) * parseFloat(rootStyle.fontSize);
    const typeCaption = parseFloat(rootStyle.getPropertyValue("--type-caption")) * parseFloat(rootStyle.fontSize);
    const typeLabel = parseFloat(rootStyle.getPropertyValue("--type-label")) * parseFloat(rootStyle.fontSize);
    const typeControlValue = parseFloat(rootStyle.getPropertyValue("--type-control-value")) * parseFloat(rootStyle.fontSize);
    const typeCode = parseFloat(rootStyle.getPropertyValue("--type-code")) * parseFloat(rootStyle.fontSize);

    if (!narrow && Math.abs(aside - reading * noteInReading) > .001) {
      errors.push("the apparatus aside measure has drifted from native Tufte marginalia");
    }

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

    const visible = (element) => Boolean(
      element
      && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden"
    );

    const directVisibleText = (root) => Array.from(root.querySelectorAll("*"))
      .filter(visible)
      .map((element) => Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" "))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const canonicalSideWidth = () => {
      if (narrow) return null;
      const source = Array.from(document.querySelectorAll(
        "body.tufte-site main .historical-margin, body.tufte-site main .chladni-photo-panel"
      )).find(visible);
      return source ? source.getBoundingClientRect().width : null;
    };

    const checkCanvasAspect = (canvas) => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height || !canvas.width || !canvas.height) return;
      const cssRatio = box.width / box.height;
      const bitmapRatio = canvas.width / canvas.height;
      if (Math.abs(cssRatio / bitmapRatio - 1) > .01) {
        errors.push(`${canvas.id || "unnamed canvas"} has mismatched CSS and bitmap aspect ratios`);
      }
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

    const expectedHeadingContract = [
      ["I", "When does a moving measuring probe lose information?", "#introduction", "section"],
      ["I.1", "Schiffer’s problem: Can a membrane vibrate with constant amplitude along its boundary?", "#schiffer-problem", "subsection"],
      ["II", "The disk counterexample admits no first-order perturbations.", "#linear-rigidity", "section"],
      ["II.1", "Changing the ambient geometry: what if linear rigidity fails?", "#borrow-flexibility", "subsection"],
      ["III", "From the plane to the limiting geometry: bifurcating when it’s impossible", "#geometric-escape", "section"],
      ["IV", "The bifurcation proof", "#experiment", "section"],
      ["4.1", "Uniform half-cylinder bifurcation for 2 ≤ λ ≤ 3", "#half-cylinder-strategy", "proof-subsection"],
      ["4.2", "Large-radius Bessel modes converge to cylinder modes on fixed boundary collars", "#debye-experiment", "proof-subsection"],
      ["4.3", "Computing along the branch: the variation of R determines the Debye phase", "#phase-story", "proof-subsection"],
      ["4.4", "Near-integer Bessel crossings make the common-zero condition arbitrarily close to integer order", "#abundance-experiment", "proof-subsection"],
      ["4.5", "Landing and planar lift: the cone branch reaches integer order and unfolds into the plane", "#cone-experiment", "proof-subsection"],
      ["4.5.2", "One-wavelength zoom: read the landed solution globally and on its boundary collar", "#modes-experiment", ""],
      ["R", "References", "#references", "section"],
    ];
    const headingContract = Array.from(document.querySelectorAll(headingSelector), (heading) => {
      const title = headingTitleElement(heading);
      const target = headingTarget(heading);
      return [
        heading.dataset.number,
        heading.dataset.title,
        target ? `#${target.id}` : "",
        heading.dataset.toc || "",
        normalizeText(title?.textContent),
        heading.querySelectorAll(":scope > :is(h2, h3)").length,
      ];
    });
    expectedHeadingContract.forEach(([number, title, href, toc], index) => {
      const actual = headingContract[index];
      if (!actual || actual[0] !== number || actual[1] !== title || actual[2] !== href || actual[3] !== toc) {
        errors.push(`section heading ${number} does not match the shared data contract`);
      }
      if (actual && actual[1] !== actual[4]) {
        errors.push(`section heading ${number} visible title drifts from data-title`);
      }
      if (actual && actual[5] !== 1) {
        errors.push(`section heading ${number} does not expose exactly one h2/h3 title`);
      }
    });
    if (headingContract.length !== expectedHeadingContract.length) {
      errors.push("section heading registry has unexpected entries");
    }
    if (document.querySelector(".section-number, .subsection-number")) {
      errors.push("legacy hand-authored section number spans returned");
    }
    document.querySelectorAll(".section-heading").forEach((heading) => {
      if (heading.querySelector(".eyebrow")) errors.push("section heading contains a redundant eyebrow");
      if (heading.querySelector(":scope > :not(h2):not(h3)")) {
        errors.push("section heading contains decoration in addition to its title");
      }
      heading.querySelectorAll(":scope > :is(span, small, p)").forEach((label) => {
        if (/^(?:[IVX]+|\d+(?:\.\d+)*)\s*[·.)-]/i.test(normalizeText(label.textContent))) {
          errors.push("section heading contains hand-authored numbering text");
        }
      });
    });
    const expectedTocContents = expectedHeadingContract
      .filter(([, , , toc]) => toc)
      .map(([number, title, href, toc]) => [number, title, href, tocClassByLevel[toc]]);
    const actualTocContents = Array.from(document.querySelectorAll(".site-toc nav[data-toc-nav] a"), (link) => [
      normalizeText(link.querySelector("b")?.textContent),
      normalizeText(link.querySelector("span")?.textContent),
      link.getAttribute("href"),
      link.className,
    ]);
    if (expectedTocContents.some(([number, title, href, className], index) => {
      const actual = actualTocContents[index];
      return !actual || actual[0] !== number || actual[1] !== title || actual[2] !== href || actual[3] !== className;
    }) || actualTocContents.length !== expectedTocContents.length) {
      errors.push("table of contents does not match the shared heading contract");
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
      "The Schiffer–Pompeiu equivalence",
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

    const sideWidth = canonicalSideWidth();
    document.querySelectorAll("body.tufte-site main .side-figure").forEach((figureElement, index) => {
      if (!visible(figureElement)) return;
      const style = getComputedStyle(figureElement);
      if ([style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push(`side figure ${index + 1} regained card rules`);
      }
      const box = figureElement.getBoundingClientRect();
      if (narrow) {
        const expectedWidth = sectionMeasure(figureElement, Number.isFinite(mobileNote) ? mobileNote : .95);
        if (Math.abs(box.width - expectedWidth) > 2) {
          errors.push(`side figure ${index + 1} is outside the mobile aside measure`);
        }
        return;
      }
      if (sideWidth && Math.abs(box.width - sideWidth) > 2) {
        errors.push(`side figure ${index + 1} is ${rounded(box.width)}px wide, not the canonical ${rounded(sideWidth)}px`);
      }
      if (figureElement.matches(".measurement-figure > .side-figure, .margin-figure-row > .side-figure")) {
        const sectionBox = figureElement.closest("main > section")?.getBoundingClientRect();
        if (!sectionBox) return;
        const marginStart = sectionBox.left + sectionBox.width * (reading + gutter);
        if (box.left < marginStart - 2) errors.push(`side figure ${index + 1} intrudes before the margin column`);
        if (box.right > sectionBox.right + 1) errors.push(`side figure ${index + 1} leaves the page frame`);
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
                && code.querySelectorAll("span").length
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

    document.querySelectorAll("body.tufte-site main .reading-figure").forEach((visual, index) => {
      if (!visible(visual)) return;
      const box = visual.getBoundingClientRect();
      const expectedWidth = sectionMeasure(visual, narrow ? 1 : reading);
      if (Math.abs(box.width - expectedWidth) > 2) errors.push(`reading figure ${index + 1} is outside the reading measure`);
      if (!visual.querySelector("canvas, svg, img, picture, video")) errors.push(`reading figure ${index + 1} contains no visual`);
    });

    document.querySelectorAll("body.tufte-site main :is(.figure-band, .small-multiples, .interactive-plate, .reading-figure)").forEach((element, index) => {
      if (!element.getClientRects().length) return;
      const style = getComputedStyle(element);
      if ([style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push(`visual role ${index + 1} regained an outer card border`);
      }
    });

    document.querySelectorAll("body.tufte-site main .passive-script-targets").forEach((target, index) => {
      if (visible(target)) errors.push(`passive script target ${index + 1} is visible`);
      if (!target.hidden && getComputedStyle(target).display !== "none") {
        errors.push(`passive script target ${index + 1} occupies layout space`);
      }
    });
    document.querySelectorAll("body.tufte-site main :is(.live-dot, .abundance-toolbar, .abundance-readout, .phase-family-toolbar, .cone-data-badge, .three-help, .solver-badge)").forEach((element) => {
      if (visible(element)) errors.push(`passive figure chrome is visible: ${element.className || element.id}`);
    });
    [
      "domainState",
      "debyePlotState",
      "phaseStoryState",
      "abundancePlotState",
      "abundanceCountValue",
      "abundanceBestValue",
      "coneDomainState",
      "modesPlotState",
    ].forEach((id) => {
      const target = document.getElementById(id);
      if (visible(target)) errors.push(`passive applet readout #${id} is visible`);
    });
    [
      "modesGlobalFormula",
      "modesPatchFormula",
      "modesRadialFormula",
      "debyeRateFormula1",
      "debyeRateFormula2",
      "debyeRateFormula3",
      "debyeErrorFormula1",
      "debyeErrorFormula2",
      "debyeErrorFormula3",
    ].forEach((id) => {
      const label = document.getElementById(id);
      if (visible(label)) errors.push(`passive canvas annotation #${id} is visible`);
    });
    [
      { selector: ".abundance-plot-panel", patterns: [/crossings visible/i, /smallest sample/i, /hover a point/i, /within 0\.01 of an integer/i, /573 crossings/i, /9\.73\s*[×x]/i] },
      { selector: ".phase-family", patterns: [/thirteen orange points/i, /real crossing order versus branch parameter/i, /spectral ratio/i, /unit-amplitude quadratic drop/i] },
      { selector: ".interactive-plate", patterns: [/interior PDE residual/i, /dirichlet normalized/i, /neumann normalized/i, /solving boundary/i, /\d+\s*fit angles/i, /\d+-point validation/i] },
    ].forEach(({ selector, patterns }) => {
      document.querySelectorAll(`body.tufte-site main ${selector}`).forEach((root) => {
        const text = directVisibleText(root);
        patterns.forEach((pattern) => {
          if (pattern.test(text)) errors.push(`passive applet text remains visible in ${selector}: ${pattern}`);
        });
      });
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
        const expectedGalleryWidth = sideWidth || sectionBox.width * reading * .5;
        const expectedCopyWidth = sectionBox.width * reading;
        const expectedGap = sectionBox.width * gutter;
        if (copyBox && Math.abs(copyBox.width - expectedCopyWidth) > 2) {
          errors.push("construction prose no longer keeps the reading measure");
        }
        if (Math.abs(galleryBox.width - expectedGalleryWidth) > 2) {
          errors.push("comparison gallery does not use the canonical aside measure");
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
      const roles = ["paper-copy", "math-statement", "lean-statement", "small-multiples", "figure-band", "reading-figure", "margin-figure-sequence", "data-table"]
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

    const forbiddenControlChrome = ":is(.variation-equation, .variation-equation-label, .variation-legend, .geometry-stage-note, .solver-readout, .crossing-card, .parameter-pair, .fixed-zoom-pair, .problem-map, .phase-law, .phase-agreement, .collar-field-readout, .collar-field-locator, .debye-status, .phase-story-readout, .modes-status)";
    document.querySelectorAll("body.tufte-site main .paper-demo-controls").forEach((controls, index) => {
      if (!visible(controls)) return;
      const controlStyle = getComputedStyle(controls);
      if ([controlStyle.borderTopWidth, controlStyle.borderRightWidth, controlStyle.borderBottomWidth, controlStyle.borderLeftWidth]
        .some((value) => parseFloat(value) > 0)) {
        errors.push(`paper control rail ${index + 1} has card rules`);
      }
      const visibleForbidden = Array.from(controls.querySelectorAll(forbiddenControlChrome)).filter(visible);
      if (visibleForbidden.length) {
        errors.push(`paper control rail ${index + 1} exposes dashboard chrome: ${visibleForbidden[0].className}`);
      }
      const visibleHeadings = Array.from(controls.querySelectorAll(":scope .control-heading > span")).filter(visible);
      if (visibleHeadings.length) errors.push(`paper control rail ${index + 1} has a redundant panel heading`);
      const visibleParagraphs = Array.from(controls.querySelectorAll(":scope p:not([hidden])")).filter(visible);
      if (visibleParagraphs.length) errors.push(`paper control rail ${index + 1} keeps explanatory prose in the rail`);
      const directActions = Array.from(controls.querySelectorAll(":scope button:not([hidden])")).filter((button) => {
        if (!visible(button)) return false;
        return !button.closest(".geometry-stages")
          && !button.closest(".collar-trig-switch")
          && !button.closest(".view-switch")
          && !button.closest(".cone-view-switch");
      });
      if (directActions.length > 1) errors.push(`paper control rail ${index + 1} has ${directActions.length} visible actions`);
      const manipulators = Array.from(controls.querySelectorAll("input, button:not([hidden]), summary")).filter(visible);
      if (!manipulators.length) errors.push(`paper control rail ${index + 1} has no visible manipulator`);
    });

    document.querySelectorAll(".interactive-plate").forEach((plate, index) => {
      if (getComputedStyle(plate).display === "none" || !plate.getClientRects().length) return;
      if (plate.localName !== "figure") {
        errors.push(`interactive plate ${index + 1} is not a semantic figure`);
      }
      const controls = plate.querySelector(":scope > aside");
      const visual = plate.querySelector(":scope > section");
      const caption = plate.querySelector(":scope > figcaption");
      if (!controls || !visual) {
        errors.push(`interactive plate ${index + 1} is missing a direct control or visual child`);
        return;
      }
      if (!caption) errors.push(`interactive plate ${index + 1} has no direct caption`);
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
        const expectedControlWidth = plateBox.width * aside;
        const expectedGap = plateBox.width * gutter;
        if (Math.abs(visualBox.width - expectedVisualWidth) > 2) {
          errors.push(`interactive plate ${index + 1} visual is not on the reading measure`);
        }
        if (Math.abs(controlBox.width - expectedControlWidth) > 2) {
          errors.push(`interactive plate ${index + 1} controls are not on the canonical aside measure`);
        }
        if (Math.abs(controlBox.left - (visualBox.right + expectedGap)) > 2) {
          errors.push(`interactive plate ${index + 1} does not preserve the reading-gutter-aside rhythm`);
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

      visual.querySelectorAll("canvas").forEach(checkCanvasAspect);

      visual.querySelectorAll(":scope > :is(.canvas-wrap, .geometry-canvas-wrap, .modes-canvas-wrap, .phase-story-canvas-wrap, .debye-canvas-wrap, .abundance-canvas-wrap), :scope > article > .collar-field-canvas-wrap").forEach((wrap) => {
        const box = wrap.getBoundingClientRect();
        if (handset && box.height > Math.max(520, box.width * 1.6)) {
          errors.push(`interactive plate ${index + 1} has an implausibly tall narrow plot`);
        }
      });
    });

    document.querySelectorAll("body.tufte-site main :is(.reading-figure, .phase-family) canvas").forEach(checkCanvasAspect);

    const phaseFamilyWrap = document.querySelector("#phaseFamilyCanvasWrap");
    if (visible(phaseFamilyWrap)) {
      const height = phaseFamilyWrap.getBoundingClientRect().height;
      if (!narrow && (height < 190 || height > 280)) {
        errors.push(`phase-family plot height ${rounded(height)}px is not the compact desktop measure`);
      }
      if (narrow && (height < 220 || height > 360)) {
        errors.push(`phase-family plot height ${rounded(height)}px is not the compact stacked measure`);
      }
    }

    const result = {
      ok: errors.length === 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      margins: document.querySelectorAll(marginSelector).length,
      disclosures: document.querySelectorAll(disclosureSelector).length,
      statements: document.querySelectorAll("body.tufte-site main .math-statement").length,
      paperCopies: document.querySelectorAll("body.tufte-site main .paper-copy").length,
      smallMultiples: document.querySelectorAll("body.tufte-site main .small-multiples").length,
      figureBands: document.querySelectorAll("body.tufte-site main .figure-band").length,
      readingFigures: document.querySelectorAll("body.tufte-site main .reading-figure").length,
      sideFigures: document.querySelectorAll("body.tufte-site main .side-figure").length,
      marginFigureSequences: document.querySelectorAll("body.tufte-site main .margin-figure-sequence").length,
      dataTables: document.querySelectorAll("body.tufte-site main .data-table").length,
      leanStatements: document.querySelectorAll("body.tufte-site main .lean-statement").length,
      plates: document.querySelectorAll(".interactive-plate").length,
      paperControlRails: document.querySelectorAll("body.tufte-site main .paper-demo-controls").length,
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
  window.addEventListener("resize", () => requestAnimationFrame(() => requestAnimationFrame(runLayoutContract)));
  document.addEventListener("toggle", (event) => {
    if (event.target instanceof HTMLDetailsElement) requestAnimationFrame(runLayoutContract);
  }, true);
})();
