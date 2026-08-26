(() => {
  "use strict";

  if (typeof window.renderMathInElement !== "function") return;

  const sharedOptions = {
    throwOnError: false,
    strict: "warn",
  };

  // At subscript size the italic nu of the normal direction is hard to tell
  // apart from a latin v. Setting it in the bold face keeps the shape legible
  // wherever it appears; nothing else on the page is bold mathematics.
  // The braces matter: a bare \boldsymbol is rejected as a subscript.
  const emphasizeNu = (source) => source.replace(/\\nu(?![a-zA-Z])/g, "{\\boldsymbol{\\nu}}");

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
    preProcess: (source) => "\\mathsf{" + emphasizeNu(source) + "}",
  });
  document.querySelectorAll(".katex").forEach((node) => {
    if (!node.classList.contains("katex-inline-serif")) node.classList.add("katex-inline-sans");
  });

  // Display equations retain the traditional theorem/proof math face. Both
  // passes inherit their foreground color from the surrounding panel.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\[", right: "\\]", display: true }],
    preProcess: emphasizeNu,
  });
})();
