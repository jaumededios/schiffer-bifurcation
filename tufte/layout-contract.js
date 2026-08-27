(() => {
  "use strict";

  if (!new URLSearchParams(window.location.search).has("layout-check")) return;

  const rounded = (value) => Math.round(value * 10) / 10;

  function runLayoutContract() {
    const errors = [];
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    const page = document.documentElement.getBoundingClientRect();

    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      errors.push(`page overflows by ${document.documentElement.scrollWidth - window.innerWidth}px`);
    }

    document.querySelectorAll("[data-margin-aside]").forEach((aside, index) => {
      const style = getComputedStyle(aside);
      const toggle = aside.previousElementSibling;
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

    document.querySelectorAll(".interactive-plate").forEach((plate, index) => {
      if (getComputedStyle(plate).display === "none" || !plate.getClientRects().length) return;
      const controls = plate.querySelector(":scope > aside");
      const visual = plate.querySelector(":scope > section");
      if (!controls || !visual) {
        errors.push(`interactive plate ${index + 1} is missing a direct control or visual child`);
        return;
      }
      const controlBox = controls.getBoundingClientRect();
      const visualBox = visual.getBoundingClientRect();
      if (narrow) {
        if (controlBox.top < visualBox.bottom - 1) errors.push(`interactive plate ${index + 1} controls are not below its visual`);
      } else {
        if (controlBox.left < visualBox.right - 1) errors.push(`interactive plate ${index + 1} controls are not to the right of its visual`);
        if (Math.abs(controlBox.top - visualBox.top) > 1) errors.push(`interactive plate ${index + 1} control and visual tops do not align`);
      }

      visual.querySelectorAll("canvas").forEach((canvas) => {
        const box = canvas.getBoundingClientRect();
        if (!box.width || !box.height || !canvas.width || !canvas.height) return;
        const cssRatio = box.width / box.height;
        const bitmapRatio = canvas.width / canvas.height;
        if (Math.abs(cssRatio / bitmapRatio - 1) > .01) {
          errors.push(`${canvas.id || "unnamed canvas"} has mismatched CSS and bitmap aspect ratios`);
        }
      });
    });

    const result = {
      ok: errors.length === 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      margins: document.querySelectorAll("[data-margin-aside]").length,
      plates: document.querySelectorAll(".interactive-plate").length,
      errors,
    };
    window.__TUFTE_LAYOUT_CHECK__ = result;
    document.documentElement.dataset.layoutContract = result.ok ? "pass" : "fail";
    if (!result.ok) console.error("Tufte layout contract failed", errors);
    return result;
  }

  window.addEventListener("load", () => {
    requestAnimationFrame(() => requestAnimationFrame(runLayoutContract));
  });
  window.addEventListener("resize", () => requestAnimationFrame(runLayoutContract));
})();
