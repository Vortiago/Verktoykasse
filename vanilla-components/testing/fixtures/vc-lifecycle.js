// Fixture for memory-vc-lifecycle.spec.js — the connect/disconnect leak guard.
//
// Mounts a batch of every scalar <vc-*> atom (append → connectedCallback builds
// via the factory under a per-mount AbortController) then removes them wholesale
// (remove → disconnectedCallback aborts → the factory's listeners, timers and any
// injected nodes are freed). A leak here means abort didn't actually tear the
// factory mount down — detached subtrees survive GC, or DOM/heap climbs each cycle.
// The shared mem.js harness measures; this fixture just drives the cycle.
import "../../../components/button/button.element.js";
import "../../../components/chip/chip.element.js";
import "../../../components/status-dot/status-dot.element.js";
import "../../../components/avatar/avatar.element.js";
import "../../../components/progress/progress.element.js";
import "../../../components/spinner/spinner.element.js";
import "../../../components/alert/alert.element.js";
import "../../../components/skeleton/skeleton.element.js";

const host = /** @type {HTMLElement} */ (document.getElementById("mount"));
const w = /** @type {any} */ (window);

// One representative instance per registered tag, with real attributes so each
// factory does real work (loads its CSS once, wires listeners, starts animations).
// Built via createElement/setAttribute, not an innerHTML string — this toolkit's
// own "no HTML strings in JS" convention, and it also means this fixture needs no
// Trusted Types policy of its own now that serve.mjs enforces
// require-trusted-types-for 'script' (#59) on everything it serves, fixtures
// included; an attribute with no value (dot/pulse/dismissible below) is set "".
/** @type {Array<[string, Record<string, string>]>} */
const INSTANCES = [
  ["vc-button", { label: "Go", variant: "primary" }],
  ["vc-chip", { text: "ok", tone: "success", dot: "" }],
  ["vc-status-dot", { tone: "warning", pulse: "", label: "live" }],
  ["vc-avatar", { name: "Ada Lovelace", size: "40" }],
  ["vc-progress", { value: "42", max: "100", tone: "success", label: "load" }],
  ["vc-spinner", { size: "24", label: "loading" }],
  ["vc-alert", { tone: "info", title: "Heads up", message: "hello", dismissible: "" }],
  ["vc-skeleton", { variant: "text", lines: "3" }],
];

/** Append one .batch container holding `copies` of every tag. Appending connects
 * each <vc-*>, firing connectedCallback (async warm on first mount). @param {number} copies */
w.__mount = (copies = 1) => {
  const batch = document.createElement("div");
  batch.className = "batch";
  for (let i = 0; i < copies; i++) {
    for (const [tag, attrs] of INSTANCES) {
      const el = document.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      batch.append(el);
    }
  }
  host.append(batch);
};

/** True once every mounted <vc-*> has built its inner node (the factory output). */
w.__built = () => {
  const els = host.querySelectorAll(".batch > *");
  return els.length > 0 && [...els].every((el) => el.firstElementChild);
};

/** Remove every batch → disconnectedCallback fires on each <vc-*> → abort. */
w.__unmount = () => host.replaceChildren();
