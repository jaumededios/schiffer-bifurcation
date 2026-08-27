(() => {
  "use strict";

  const statements = Object.freeze({
    "pompeiu-property": Object.freeze({
      title: "HasPompeiuProperty",
      source: [
        "abbrev Plane := (EuclideanSpace ℝ (Fin 2))",
        "abbrev RigidMotion := AffineIsometryEquiv ℝ Plane Plane",
        "",
        "/-- A set `Ω` has the **Pompeiu property** if the only continuous `f : ℝ^2 → ℝ` whose integral over every rigid-motion image `σ(Ω)` vanishes is the zero function. -/",
        "",
        "def HasPompeiuProperty (Ω : Set (Plane)) : Prop :=",
        "  ∀ f : Plane → ℝ, Continuous f →",
        "    (∀ E : RigidMotion, (∫ x in  E '' Ω, f x) = 0) → (f = 0)",
      ].join("\n"),
    }),
  });

  const highlight = (disclosure) => {
    if (!disclosure.open || typeof window.hljs?.highlightElement !== "function") return;
    const source = disclosure.querySelector(":scope > .lean-statement-body code.language-lean");
    if (!source || source.dataset.highlighted === "yes") return;
    window.hljs.highlightElement(source);
  };

  const render = (host) => {
    const key = host.dataset.statement;
    const statement = statements[key];
    if (!statement) {
      host.dataset.statementError = "unknown statement";
      console.error(`Unknown Lean statement: ${key || "(missing key)"}`);
      return;
    }

    const disclosure = document.createElement("details");
    disclosure.className = "lean-statement";
    disclosure.dataset.statement = key;
    disclosure.open = host.hasAttribute("open");

    const summary = document.createElement("summary");
    const heading = document.createElement("span");
    const label = document.createElement("small");
    label.textContent = "Lean statement";
    const title = document.createElement("code");
    title.textContent = statement.title;
    heading.append(label, title);
    const action = document.createElement("i");
    action.setAttribute("aria-hidden", "true");
    action.textContent = "show +";
    summary.append(heading, action);

    const body = document.createElement("div");
    body.className = "lean-statement-body";
    const pre = document.createElement("pre");
    const source = document.createElement("code");
    source.className = "language-lean";
    source.textContent = statement.source;
    pre.append(source);
    body.append(pre);
    disclosure.append(summary, body);
    host.replaceWith(disclosure);

    disclosure.addEventListener("toggle", () => highlight(disclosure));
    highlight(disclosure);
  };

  document.querySelectorAll("lean-statement[data-statement]").forEach(render);
  window.SCHIFFER_LEAN_STATEMENTS = statements;
})();
