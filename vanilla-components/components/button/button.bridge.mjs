// @ts-check
// design-sync bridge contract for button (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `label: string;\n  variant?: "default" | "primary" | "danger" | "ghost";\n  size?: "md" | "sm";\n  icon?: string;\n  /** render an <a> styled as a button (keeps middle/ctrl-click) */\n  href?: string;\n  target?: string;\n  disabled?: boolean;\n  /** aria-pressed toggle state */\n  pressed?: boolean;`,
};
