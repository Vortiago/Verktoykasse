// @ts-check
// design-sync bridge contract for app-bar (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `brand: { logo?: string; title: string; tagline?: string };\n  items: { id: string; label: string; accent?: string }[];\n  current?: string;`,
};
