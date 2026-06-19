// @ts-check
// design-sync bridge contract for stat-card (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `label: string;\n  value: string | number;\n  unit?: string;\n  hint?: string;\n  tone?: "ok" | "warn" | "bad" | "accent";`,
};
