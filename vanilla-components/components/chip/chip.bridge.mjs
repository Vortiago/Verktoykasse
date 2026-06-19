// @ts-check
// design-sync bridge contract for chip (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `text: string;\n  tone?: "ok" | "warn" | "bad" | "info" | "accent";\n  dot?: boolean;`,
};
