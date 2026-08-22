(() => {
  "use strict";

  if (typeof window.renderMathInElement !== "function") return;

  const sharedOptions = {
    throwOnError: false,
    strict: "warn",
  };

  // Headings use the site's editorial serif face, so render their inline math
  // in the corresponding mathematical serif before handling running text.
  document.querySelectorAll("h1, h2, h3, .serif-math").forEach((container) => {
    window.renderMathInElement(container, {
      ...sharedOptions,
      delimiters: [{ left: "\\(", right: "\\)", display: false }],
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
    preProcess: (source) => "\\mathsf{" + source + "}",
  });
  document.querySelectorAll(".katex").forEach((node) => {
    if (!node.classList.contains("katex-inline-serif")) node.classList.add("katex-inline-sans");
  });

  // Display equations retain the traditional theorem/proof math face. Both
  // passes inherit their foreground color from the surrounding panel.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\[", right: "\\]", display: true }],
  });
})();
