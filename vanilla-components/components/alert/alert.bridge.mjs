// @ts-check
// design-sync bridge contract for alert (read by bridge/emit-adapter.mjs).
export default {
  props: `tone?: "ok" | "warn" | "bad" | "info" | "accent" | (string & {});\n  title?: string;\n  message: string;\n  dismissible?: boolean;`,
};
