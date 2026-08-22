(() => {
  "use strict";

  if (typeof window.renderMathInElement !== "function") return;

  const sharedOptions = {
    throwOnError: false,
    strict: "warn",
  };

  // Running text and interface labels use a sans face. Match that typography
  // inside inline mathematics instead of switching alphabets mid-sentence.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\(", right: "\\)", display: false }],
    preProcess: (source) => "\\mathsf{" + source + "}",
  });
  document.querySelectorAll(".katex").forEach((node) => {
    node.classList.add("katex-inline-sans");
  });

  // Display equations retain the traditional theorem/proof math face. Both
  // passes inherit their foreground color from the surrounding panel.
  window.renderMathInElement(document.body, {
    ...sharedOptions,
    delimiters: [{ left: "\\[", right: "\\]", display: true }],
  });
})();
