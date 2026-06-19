// @ts-check
// design-sync bridge contract for tooltip (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). Imperative overlay -> custom shim.
export default {
  props: `content?: string;`,
  shim: "tooltip",
};
