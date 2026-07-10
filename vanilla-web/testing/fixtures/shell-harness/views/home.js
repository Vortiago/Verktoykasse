// @ts-check
// Trivial, always-succeeds view — the "everything else still works" baseline
// the #53/#61 specs switch back to after exercising a broken/slow view.
export default {
  id: "home",
  /** @param {HTMLElement} container */
  mount(container) {
    const p = document.createElement("p");
    p.dataset.slot = "msg";
    p.textContent = "Home OK";
    container.append(p);
  },
  unmount() {},
};
