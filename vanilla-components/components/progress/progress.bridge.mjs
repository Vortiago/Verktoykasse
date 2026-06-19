// @ts-check
// design-sync bridge contract for progress (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `value: number;\n  max?: number;\n  tone?: "ok" | "warn" | "bad" | "accent";\n  label?: string;`,
};
