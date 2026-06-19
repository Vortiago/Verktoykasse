// @ts-check
// design-sync bridge contract for status-dot (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "accent";\n  pulse?: boolean;\n  label?: string;`,
};
