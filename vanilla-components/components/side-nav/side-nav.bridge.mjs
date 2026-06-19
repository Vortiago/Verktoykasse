// @ts-check
// design-sync bridge contract for side-nav (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `groups: { label?: string; variant?: "list" | "journey"; items: { id: string; label: string; icon?: string; chip?: { text: string; tone?: "ok" | "warn" | "bad" | "info" | "accent" }; done?: boolean }[] }[];\n  current?: string;`,
};
