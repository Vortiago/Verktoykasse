// @ts-check
// design-sync bridge contract for table-shell (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `columns: { key: string; label: string; align?: "start" | "end" }[];\n  rows?: (string | number)[][];\n  caption?: string;`,
};
