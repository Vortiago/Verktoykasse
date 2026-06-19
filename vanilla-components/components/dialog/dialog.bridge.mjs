// @ts-check
// design-sync bridge contract for dialog (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). A <dialog> -> custom open-inline shim.
export default {
  props: `title?: string;\n  body?: string;`,
  shim: "dialog",
};
