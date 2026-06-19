// @ts-check
// design-sync bridge contract for view-header (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `eyebrow?: string;\n  title: string;\n  sub?: string;\n  /** compact one-line section/toolbar bar */\n  dense?: boolean;`,
};
