// @ts-check
// design-sync bridge contract for kv-row (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `label: string;\n  value: string | number;\n  tone?: "ok" | "warn" | "bad" | "accent";`,
};
