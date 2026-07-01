// Mount/unmount target for memory-live-update.spec.js. Exercises the REAL
// data-retrieval + update helpers exactly as a view would: a store subscription,
// an SSE connection, a per-mount CSS link, and a reconcileList'd live list — all
// torn down by aborting one AbortController, the shell.js contract.
//
//   default            → correct, signal-scoped teardown (the GREEN arm)
//   ?leaky=1           → the recon's misuse: subscribe without a signal, loadCSS
//                        without a signal, an SSE bound to a never-aborted signal
//                        — so unmount can't release them (the RED arm the spec
//                        uses to confirm the detector trips)
import { createStore } from "../../store.js";
import { liveSSE } from "../../live.js";
import { loadCSS, reconcileList } from "../../templates.js";

const leaky = new URLSearchParams(location.search).has("leaky");
const stage = /** @type {HTMLElement} */ (document.getElementById("stage"));
const w = /** @type {any} */ (window);
w.__leakRefs = [];

/** @type {AbortController | null} */ let controller = null;
// In leaky mode the SSE is bound to this controller, which is NEVER aborted, so
// the EventSource is never closed — the live-data analogue of the store leak.
const neverAborted = new AbortController();

w.__mountLive = () => {
  controller = new AbortController();
  const { signal } = controller;

  const root = document.createElement("section");
  root.dataset.slot = "liveView";
  const list = document.createElement("ul");
  list.dataset.slot = "liveList";
  root.append(list);
  stage.append(root);
  w.__leakRefs.push(new WeakRef(root)); // must be collectable after unmount

  // Per-mount stylesheet. With the signal it auto-removes on abort; the leaky
  // arm omits it, so a <link> piles up in <head> every mount.
  if (leaky) loadCSS(import.meta.url, "./live-harness.css");
  else loadCSS(import.meta.url, "./live-harness.css", signal);

  // The store + subscription that re-renders the list on every push.
  const store = createStore(async () => /** @type {{id:number,label:string}[]} */ ([]));
  const render = (items) => reconcileList(
    list, items || [], (it) => String(it.id),
    (it) => {
      const li = document.createElement("li");
      li.dataset.slot = "liveRow";
      li.textContent = it.label;
      w.__leakRefs.push(new WeakRef(li)); // dropped rows must be collectable too
      return li;
    },
    (li, it) => { li.textContent = it.label; },
  );
  // The HIGH-risk surface: a signal-less subscribe retains `render` (which closes
  // over the detached list/root) forever; the signal arm drains it on abort.
  if (leaky) store.subscribe(render);
  else store.subscribe(render, signal);
  store.set([]); // prime an empty render

  // Live data over SSE — the leaky arm uses a signal that never aborts.
  liveSSE("/api/events", (items) => store.set(items), leaky ? neverAborted.signal : signal);

  w.__store = store; // let the spec drive in-page churn for scenario 2
};

w.__unmountLive = () => {
  controller?.abort();        // shell.js swap(): abort, then clear the stage
  stage.replaceChildren();
  w.__store = null;
};
