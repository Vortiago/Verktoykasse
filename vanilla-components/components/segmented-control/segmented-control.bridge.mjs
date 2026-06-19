// @ts-check
// design-sync bridge contract for segmented-control (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `options: { id: string; label: string; tone?: "ok" | "warn" | "bad" | "info" | "accent" | (string & {}) }[];\n  current?: string;`,
};
