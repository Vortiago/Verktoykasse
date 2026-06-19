// @ts-check
// design-sync bridge contract for avatar (read by bridge/emit-adapter.mjs).
export default {
  props: `name?: string;\n  initials?: string;\n  src?: string;\n  size?: number;\n  tone?: "ok" | "warn" | "bad" | "info" | "accent" | (string & {});`,
};
