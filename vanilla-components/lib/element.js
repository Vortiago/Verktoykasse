// @ts-check
// defineElement — wrap an existing create-factory as a LIGHT-DOM custom element,
// so a component can be authored declaratively in HTML (`<vc-button …>`) while the
// factory stays the single source of truth. No build, no Shadow DOM: the built node
// is appended as a normal child, so the app's tokens.css / @layer / @scope rules all
// reach it exactly as they do a factory-mounted node (a shadow root would wall them
// off). The tag is an optional FACE over the factory, never the primary contract.
//
// The attribute→prop translations a HTML author sees:
//   - scalar attrs  → props    (`variant="primary"` → { variant: "primary" })
//   - boolean attrs → props    (presence = true; `disabled` → { disabled: true })
//   - number attrs  → props    (coerced; `value="40"` → { value: 40 })
//   - callbacks     → events   (an `onDismiss` prop → a `dismiss` CustomEvent you listen for)
// Live updates flow back the other way: an OBSERVED attribute (one with a `setters`
// entry) routes to the factory's matching updater (`label` → `setLabel`). Only
// setter-backed attrs are observed, so "observed = live" — a non-live attr like
// `variant` is read once at connect and never pretends to react. Native events (a
// real <button>'s click) already BUBBLE through the light-DOM host, so `events` is
// only for non-DOM callback props.
//
// The built node REPLACES any author-supplied children (`replaceChildren`), so there's
// no slot/child projection — the reason composites (Node/array props) stay factory-only.

/**
 * Config mirrors the factory's prop names + updater method names BY HAND — attributes
 * are strings, so these type tags can't be inferred build-lessly. Keep in sync when the
 * factory's props/updaters change (a stale `setters` value silently no-ops, not errors).
 * @typedef {object} ElementConfig
 * @property {string[]} [attrs] - attributes read into the factory's props at connect.
 * @property {string[]} [booleans] - which of `attrs` are boolean (presence = true).
 * @property {string[]} [numbers] - which of `attrs` are numeric (coerced with Number()).
 * @property {Record<string, string>} [setters] - attr → factory updater method; also the observed set.
 * @property {Record<string, string>} [events] - factory callback prop → CustomEvent type dispatched on the host.
 */

/**
 * Register `tag` as a light-DOM custom element backed by `component` (a
 * `defineComponent` handle: `{ warm, sync }`). Idempotent — a second call for the
 * same tag is a no-op, so re-importing a sidecar can't throw.
 * @param {string} tag - custom-element name (must contain a hyphen), e.g. "vc-button".
 * @param {{ warm: () => Promise<unknown>, sync: (props: any, signal?: AbortSignal) => any }} component
 * @param {ElementConfig} [config]
 */
export function defineElement(tag, component, config = {}) {
  if (customElements.get(tag)) return;
  const { attrs = [], booleans = [], numbers = [], setters = {}, events = {} } = config;
  const eventEntries = Object.entries(events); // callback prop → event type; hoisted once per tag
  let warmed = false; // flips true once template+CSS are loaded; then builds are synchronous

  class VanillaElement extends HTMLElement {
    // Observe ONLY setter-backed attrs, so a reactive attribute is exactly one that
    // routes to an updater — no silent no-op reactions on non-live attributes.
    static observedAttributes = Object.keys(setters);
    /** @type {AbortController | undefined} */ #ac;
    /** @type {any} */ #api;

    connectedCallback() {
      const ac = new AbortController();
      this.#ac = ac;
      const build = () => {
        if (ac.signal.aborted) return; // detached before warm resolved
        // Read attributes at BUILD time, not connect time: a change made during the
        // async warm gap (before #api exists) would otherwise be lost — this way the
        // built node always reflects the element's current attributes.
        /** @type {Record<string, unknown>} */
        const props = {};
        for (const name of attrs) {
          if (booleans.includes(name)) props[name] = this.hasAttribute(name);
          else if (this.hasAttribute(name)) {
            const raw = this.getAttribute(name);
            props[name] = numbers.includes(name) ? Number(raw) : raw;
          }
        }
        // A non-DOM callback prop becomes an outgoing CustomEvent the host emits.
        for (const [prop, type] of eventEntries) {
          props[prop] = (/** @type {unknown} */ detail) =>
            this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
        }
        this.#api = component.sync(props, ac.signal);
        this.replaceChildren(this.#api.el); // light DOM: the app's cascade reaches it
      };
      // Synchronous once warm — matches the create<Name>Sync path a rebuild loop needs.
      if (warmed) build();
      else component.warm().then(() => { warmed = true; build(); });
    }

    // moveBefore() (reconcileList's state-preserving move) fires disconnect+connect
    // on a custom element UNLESS this exists — defining it (even empty) makes a move
    // a no-op for lifecycle, so a reconciled <vc-*> row keeps its listeners + subtree
    // state instead of being torn down and rebuilt. See MDN Element.moveBefore.
    connectedMoveCallback() {}

    disconnectedCallback() {
      this.#ac?.abort(); // frees the factory's listeners via its mount signal
      this.#api = undefined;
    }

    /** @param {string} name @param {string | null} _old @param {string | null} value */
    attributeChangedCallback(name, _old, value) {
      const method = setters[name];
      if (!method || !this.#api?.[method]) return; // pre-build attrs are read in connectedCallback
      // Attribute removed (value === null): keep the last value instead of pushing a
      // spurious Number(null)=0 or String(null)="null". A boolean's removal IS the
      // signal (→ false), so only guard value-bearing attrs.
      if (value === null && !booleans.includes(name)) return;
      const arg = booleans.includes(name) ? value !== null : numbers.includes(name) ? Number(value) : value;
      this.#api[method](arg);
    }
  }

  customElements.define(tag, VanillaElement);
}
