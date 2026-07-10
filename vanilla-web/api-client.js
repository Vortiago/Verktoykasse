// @ts-check
// Canonical data layer for the vanilla-web conventions (see SKILL.md). Copy into
// <app>/lib/api-client.js. A thin fetch wrapper: a typed error, 204 handling, and
// a default per-request timeout — the bits every API-backed app otherwise re-rolls.
//
//   import { get, post } from "./lib/api-client.js";
//   const me = await get("/auth/me");              // throws ApiError on !ok
//   await post("/races", { fylkeId });             // body is JSON.stringify'd
//   get("/x", { signal });                          // pass the view's mount signal
//
// Changelog (#48): a caller signal used to REPLACE the timeout signal
// (`options?.signal ?? AbortSignal.timeout(...)`), so every view-scoped request
// — i.e. every request made per convention, since views always pass their mount
// signal — silently had NO timeout at all; a hung upstream held the request open
// until unmount. Fixed by composing both via `AbortSignal.any()` (Chromium 116+):
// either one aborting wins, and `AbortSignal.any` propagates the winning signal's
// abort reason, so the TimeoutError-vs-caller-abort distinction below still works.

const BASE = "/api"; // change per app
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    /** @type {number} */
    this.status = status;
  }
}

/**
 * @template T
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
export async function request(path, options) {
  /** @type {Response} */
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      // Compose, don't choose: a caller signal (a view's mount signal, per
      // convention) no longer disables the timeout — either can abort.
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(DEFAULT_TIMEOUT_MS)])
        : AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(0, "Request timed out. Please try again.");
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return /** @type {T} */ (undefined); // No Content — res.json() would throw
  return /** @type {Promise<T>} */ (res.json());
}

/** @template T @param {string} path @param {RequestInit} [options] @returns {Promise<T>} */
export const get = (path, options) => request(path, options);

/** @template T @param {string} path @param {unknown} [body] @param {RequestInit} [options] @returns {Promise<T>} */
export const post = (path, body, options) =>
  request(path, { ...options, method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });

/** @template T @param {string} path @param {unknown} [body] @param {RequestInit} [options] @returns {Promise<T>} */
export const put = (path, body, options) =>
  request(path, { ...options, method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });

/** @template T @param {string} path @param {RequestInit} [options] @returns {Promise<T>} */
export const del = (path, options) => request(path, { ...options, method: "DELETE" });
