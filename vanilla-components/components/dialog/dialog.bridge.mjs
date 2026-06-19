// @ts-check
// design-sync bridge contract for dialog (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). A <dialog> -> custom open-inline shim.
export default {
  props: `title?: string;\n  body?: string;\n  /** cap height + scroll a long body */\n  scroll?: boolean;\n  /** backdrop click closes */\n  closeOnBackdrop?: boolean;`,
  shim: "dialog",
};
