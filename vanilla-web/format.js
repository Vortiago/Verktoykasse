// @ts-check
// Canonical formatting helpers for the vanilla-web conventions (see SKILL.md).
// Copy into <app>/lib/format.js. The SKILL's "render through Intl" rule as one
// shared module — Intl.* instances are expensive, so they're memoised per
// (locale, options). Locale defaults to the browser's; override with setLocale().

let DEFAULT_LOCALE = typeof navigator !== "undefined" ? navigator.language : "en";
/** @param {string} loc */
export function setLocale(loc) { DEFAULT_LOCALE = loc; }

/** The viewer's IANA timezone — the default zone absolute instants render in. */
export const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DATE_MED = /** @type {Intl.DateTimeFormatOptions} */ ({ year: "numeric", month: "short", day: "numeric" });
const TIME_SHORT = /** @type {Intl.DateTimeFormatOptions} */ ({ hour: "2-digit", minute: "2-digit" });

/** @type {Map<string, Intl.NumberFormat>} */ const _nf = new Map();
/** @type {Map<string, Intl.DateTimeFormat>} */ const _df = new Map();
/** @type {Map<string, Intl.RelativeTimeFormat>} */ const _rtf = new Map();

/** @param {Intl.NumberFormatOptions} [opts] @param {string} [locale] */
function nfmt(opts, locale) {
  const loc = locale || DEFAULT_LOCALE;
  const key = opts ? loc + JSON.stringify(opts) : loc;
  let f = _nf.get(key);
  if (!f) { f = new Intl.NumberFormat(loc, opts); _nf.set(key, f); }
  return f;
}
/** @param {Intl.DateTimeFormatOptions} opts @param {string} [locale] */
function dfmt(opts, locale) {
  const loc = locale || DEFAULT_LOCALE;
  // Fast-path the two default singletons (skip JSON.stringify); "\0" can't occur
  // in a locale tag, so these keys never collide with a stringified opts object.
  const key = opts === DATE_MED ? loc : opts === TIME_SHORT ? loc + "\0t" : loc + JSON.stringify(opts);
  let f = _df.get(key);
  if (!f) { f = new Intl.DateTimeFormat(loc, opts); _df.set(key, f); }
  return f;
}

/** Format a number. @param {number} n @param {Intl.NumberFormatOptions} [opts] @param {string} [locale] */
export const num = (n, opts, locale) => nfmt(opts, locale).format(n);

/** Format a date/ISO string (default: medium date). @param {string|number|Date} d @param {Intl.DateTimeFormatOptions} [opts] @param {string} [locale] */
export function date(d, opts = DATE_MED, locale) {
  if (d == null || d === "") return "—";
  return dfmt(opts, locale).format(new Date(d));
}

/** Format an absolute instant (epoch-ms / ISO-with-offset / Date) as a wall-clock
 * TIME (default: short hour:minute). The instant is unambiguous, so it renders in
 * the VIEWER's browser timezone by default — that IS the conversion; the source
 * zone is irrelevant to an absolute instant. Pass `opts.timeZone` (an IANA id)
 * ONLY to pin a specific zone, e.g. to label the origin zone next to local time.
 * @param {string|number|Date} d @param {Intl.DateTimeFormatOptions} [opts] @param {string} [locale] */
export function time(d, opts = TIME_SHORT, locale) {
  if (d == null || d === "") return "—";
  return dfmt(opts, locale).format(new Date(d));
}

/** Origin-zone hover label for an absolute instant: `"<tz>: <instant rendered in
 * tz>"`, or "" when `originTz` is unset or equals the viewer's zone (no redundant
 * tooltip). Pair with `time()`/`date()` as the visible viewer-zone text — the
 * visible value and this `title` are a text/tooltip split over the same instant.
 * @param {string|number|Date} d @param {Intl.DateTimeFormatOptions} opts @param {string} [originTz] @param {string} [locale] */
export function originZoneLabel(d, opts, originTz, locale) {
  if (!originTz || originTz === BROWSER_TZ || d == null || d === "") return "";
  return `${originTz}: ${time(d, { ...opts, timeZone: originTz }, locale)}`;
}

/** Human byte size. @param {number} n @param {string} [locale] */
export function bytes(n, locale) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${num(n / 1024 ** i, { maximumFractionDigits: i ? 1 : 0 }, locale)} ${u[i]}`;
}

/** Relative time from a past epoch-ms (or Date), via Intl.RelativeTimeFormat.
 * @param {number|Date} when @param {string} [locale] */
export function relTime(when, locale) {
  const ms = when instanceof Date ? when.getTime() : when;
  if (!ms) return "—";
  const loc = locale || DEFAULT_LOCALE;
  let rtf = _rtf.get(loc);
  if (!rtf) { rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" }); _rtf.set(loc, rtf); }
  const diffSec = Math.round((ms - Date.now()) / 1000); // negative = past
  /** @type {[Intl.RelativeTimeFormatUnit, number][]} */
  const steps = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, sec] of steps) {
    if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
  }
  return rtf.format(0, "second");
}

// Intl.DurationFormat isn't in this TS version's lib.d.ts yet (Baseline
// Chrome/Edge 129+, but the type declarations lag) — a local shape + a cast
// through the global keeps the gate green without depending on an @types
// package (zero-dep). Runtime uses the real global; absent it (older engine,
// or a non-browser test runner without --harmony-intl-duration-format) this
// throws, same as any other un-polyfilled Intl.* constructor here.
/** @typedef {{ format(input: Partial<Record<"hours"|"minutes"|"seconds", number>>): string }} DurationFormatLike */
const _DurationFormat = /** @type {{ new (locale: string, opts: { style: string, secondsDisplay?: string, minutesDisplay?: string }): DurationFormatLike }} */ (
  /** @type {{ DurationFormat: unknown }} */ (/** @type {unknown} */ (Intl)).DurationFormat
);

/** @type {Map<string, DurationFormatLike>} */ const _dfSec = new Map(); // sub-hour tiers: seconds always shown
/** @type {Map<string, DurationFormatLike>} */ const _dfHr = new Map();  // hour+ tier: minutes always shown, no seconds

/** @param {string} [locale] */
function secDurFmt(locale) {
  const loc = locale || DEFAULT_LOCALE;
  let f = _dfSec.get(loc);
  if (!f) { f = new _DurationFormat(loc, { style: "narrow", secondsDisplay: "always" }); _dfSec.set(loc, f); }
  return f;
}
/** @param {string} [locale] */
function hrDurFmt(locale) {
  const loc = locale || DEFAULT_LOCALE;
  let f = _dfHr.get(loc);
  if (!f) { f = new _DurationFormat(loc, { style: "narrow", minutesDisplay: "always" }); _dfHr.set(loc, f); }
  return f;
}

/** Compact duration from milliseconds, via Intl.DurationFormat (`{ style:
 * "narrow" }`) — locale-aware like every other formatter here (respects
 * setLocale()), where the old hand-rolled version was English-only: "45s",
 * "1m 20s", "1h 5m". The unit-splitting math stays hand-rolled (Intl formats a
 * duration RECORD; it doesn't convert milliseconds); `secondsDisplay`/
 * `minutesDisplay: "always"` keep a zero-valued trailing unit visible ("1m 0s",
 * "1h 0m") — Intl's default "auto" display drops zero-valued units entirely,
 * which would silently change the output shape.
 * @param {number} ms @param {string} [locale] */
export function duration(ms, locale) {
  if (ms == null || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return secDurFmt(locale).format({ seconds: s });
  const m = Math.floor(s / 60);
  if (m < 60) return secDurFmt(locale).format({ minutes: m, seconds: s % 60 });
  return hrDurFmt(locale).format({ hours: Math.floor(m / 60), minutes: m % 60 });
}

/** Truncate with a remaining-count suffix. @param {string} str @param {number} max */
export const truncate = (str, max) =>
  str.length > max ? `${str.slice(0, max)}… (+${str.length - max})` : str;
