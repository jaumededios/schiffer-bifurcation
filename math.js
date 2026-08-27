(() => {
  "use strict";

  const sharedOptions = {
    throwOnError: false,
    strict: "warn",
  };
  const serifEdition = document.body.classList.contains("tufte-site");
  let scheduleMathFit = () => {};

  // At subscript size the italic nu of the normal direction is hard to tell
  // apart from a latin v. Setting it in the bold face keeps the shape legible
  // wherever it appears; nothing else on the page is bold mathematics.
  // The braces matter: a bare \boldsymbol is rejected as a subscript.
  const emphasizeNu = (source) => source.replace(/\\nu(?![a-zA-Z])/g, "{\\boldsymbol{\\nu}}");

  // Interactive figures update their readouts after the initial auto-render
  // pass.  Give every script the same KaTeX entry point so a mathematical
  // expression is never replaced by an unparsed monospaced string.
  const render = (elementOrSelector, source, options = {}) => {
    const element = typeof elementOrSelector === "string"
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;
    if (!element) return;
    if (typeof window.katex?.render !== "function") {
      element.textContent = source;
      return;
    }
    const serif = options.serif ?? (serifEdition || Boolean(options.displayMode));
    const preparedSource = serif
      ? emphasizeNu(source)
      : `\\mathsf{${emphasizeNu(source)}}`;
    window.katex.render(preparedSource, element, {
      ...sharedOptions,
      displayMode: Boolean(options.displayMode),
    });
    element.querySelectorAll(".katex").forEach((node) => {
      node.classList.add(serif ? "katex-inline-serif" : "katex-inline-sans");
    });
    scheduleMathFit();
  };

  window.SchifferMath = Object.freeze({ render });

  if (typeof window.renderMathInElement !== "function") return;

  // Headings use the site's editorial serif face, so render their inline math
  // in the corresponding mathematical serif before handling running text.
  document.querySelectorAll("h1, h2, h3, .serif-math").forEach((container) => {
    window.renderMathInElement(container, {
      ...sharedOptions,
      delimiters: [{ left: "\\(", right: "\\)", display: false }],
      preProcess: emphasizeNu,
    });
  });
  document.querySelectorAll("h1 .katex, h2 .katex, h3 .katex, .serif-math .katex").forEach((node) => {
    node.classList.add("katex-inline-serif");
  });

  // Running text and interface labels use a sans face. Match that typography
  // inside inline mathematics instead of switching alphabets mid-sentence.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\(", right: "\\)", display: false }],
    preProcess: serifEdition
      ? emphasizeNu
      : (source) => "\\mathsf{" + emphasizeNu(source) + "}",
  });
  document.querySelectorAll(".katex").forEach((node) => {
    if (node.classList.contains("katex-inline-serif")) return;
    node.classList.add(serifEdition ? "katex-inline-serif" : "katex-inline-sans");
  });

  // Display equations retain the traditional theorem/proof math face. Both
  // passes inherit their foreground color from the surrounding panel.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\[", right: "\\]", display: true }],
    preProcess: emphasizeNu,
  });

  /* Tufte display mathematics belongs to the measure that contains it.  KaTeX
     does not reflow long expressions, so fit the rendered glyph run to that
     measure as a final typesetting step.  Content never supplies a local
     font-size and every display follows the same resize contract. */
  if (document.body.classList.contains("tufte-site")) {
    let fitFrame = 0;
    const fitDisplays = () => {
      fitFrame = 0;
      document.querySelectorAll(".tex-display").forEach((wrapper) => {
        if (!wrapper.getClientRects().length) return;
        wrapper.style.setProperty("--math-scale", "1");
        const rootStyle = getComputedStyle(document.documentElement);
        const baseMathSize = (parseFloat(rootStyle.getPropertyValue("--type-math")) || 1.18)
          * (parseFloat(rootStyle.fontSize) || 16);
        wrapper.style.setProperty("--math-size", `${baseMathSize}px`);
        const contents = Array.from(wrapper.querySelectorAll(".katex-display > .katex"));
        if (!contents.length) return;
        const style = getComputedStyle(wrapper);
        const available = wrapper.clientWidth
          - parseFloat(style.paddingLeft || 0)
          - parseFloat(style.paddingRight || 0);
        if (available <= 1) return;
        const required = Math.max(...contents.map((content) => content.scrollWidth));
        const safety = Math.min(14, Math.max(4, available * .03));
        const scale = required > available + 1
          ? Math.max(.52, Math.min(1, (available - safety) / required))
          : 1;
        wrapper.style.setProperty("--math-scale", scale.toFixed(4));
        wrapper.style.setProperty("--math-size", `${baseMathSize * scale}px`);
        wrapper.classList.toggle("math-fitted", scale < .999);
      });
    };
    scheduleMathFit = () => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => requestAnimationFrame(fitDisplays));
    };
    const observedWidths = new WeakMap();
    const observer = new ResizeObserver((entries) => {
      const widthChanged = entries.some((entry) => {
        const width = entry.contentRect.width;
        const previous = observedWidths.get(entry.target);
        observedWidths.set(entry.target, width);
        return previous === undefined || Math.abs(previous - width) > .5;
      });
      if (widthChanged) scheduleMathFit();
    });
    document.querySelectorAll(".tex-display").forEach((wrapper) => observer.observe(wrapper));
    window.addEventListener("resize", scheduleMathFit, { passive: true });
    scheduleMathFit();
  }
})();
