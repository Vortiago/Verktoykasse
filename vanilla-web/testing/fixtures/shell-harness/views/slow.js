// @ts-check
// Mounts after a deliberately long delay, so an e2e spec can navigate away
// mid-mount (#61: the errbar must stay hidden — a cancelled mount is normal
// shutdown, not a failure) or wait it out to check title/focus (#60). The
// delay is wired to the mount signal: aborting it (a second, faster
// navigation) rejects with AbortError instead of resolving late into a stage
// some OTHER view now owns.
export default {
  id: "slow",
  /** @param {HTMLElement} container @param {unknown} _data @param {{ signal: AbortSignal }} helpers */
  mount(container, _data, { signal }) {
    // Synchronous marker so a spec can wait on "mid-mount" as a DOM condition
    // (reference/testing.md: wait on DOM conditions, never a fixed sleep)
    // instead of racing a click against the 3s timer below.
    const marker = document.createElement("p");
    marker.dataset.slot = "slowLoading";
    marker.textContent = "Slow loading…";
    container.append(marker);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const p = document.createElement("p");
        p.dataset.slot = "msg";
        p.textContent = "Slow OK";
        container.replaceChildren(p); // drop the "loading" marker, not just append alongside it
        resolve(undefined);
      }, 3000);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    });
  },
  unmount() {},
};
