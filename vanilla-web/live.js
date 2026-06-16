// @ts-check
// Canonical live-data CLIENT helpers for the vanilla-web conventions (see SKILL.md).
// The server side (push-only-on-change SSE, or a watch endpoint) lives in serve.mjs;
// this is the matching client lifecycle: parse, de-dupe, tear down on the view's
// abort signal. SSE is the default; livePoll is the fallback for backends without
// an event stream.

import { every } from "./templates.js";

/**
 * Subscribe to a Server-Sent Events stream; `onData` fires once per pushed event
 * with the parsed JSON. Closes automatically when `signal` aborts.
 * @template T
 * @param {string} url @param {(data: T, raw: string) => void} onData @param {AbortSignal} signal
 * @returns {EventSource}
 */
export function liveSSE(url, onData, signal) {
  const es = new EventSource(url);
  es.onmessage = (e) => { try { onData(JSON.parse(e.data), e.data); } catch { /* skip malformed */ } };
  signal.addEventListener("abort", () => es.close(), { once: true });
  return es;
}

/**
 * Poll `url` every `intervalMs`, firing `onData` ONLY when the response changed
 * (cheap stringify compare), with in-flight de-duplication. Tears down on abort
 * (via every()). A failed tick is swallowed so one bad response can't kill the loop.
 * @template T
 * @param {string} url @param {(data: T) => void} onData @param {AbortSignal} signal @param {number} [intervalMs]
 */
export function livePoll(url, onData, signal, intervalMs = 5000) {
  let last = "";
  let inFlight = false;
  async function poll() {
    if (inFlight || signal.aborted) return;
    inFlight = true;
    try {
      const text = await (await fetch(url, { signal })).text();
      if (text !== last) { last = text; onData(JSON.parse(text)); }
    } catch { /* one bad tick shouldn't kill the loop */ }
    finally { inFlight = false; }
  }
  every(poll, intervalMs, signal);
  poll(); // prime immediately
}
