// @ts-check
// design-sync bridge contract for field (read by bridge/emit-adapter.mjs):
// the agent-facing Props body (narrowed). shim defaults to "declarative".
export default {
  props: `label: string;\n  type?: "text" | "number" | "email" | "password" | "search" | "select" | "textarea";\n  value?: string;\n  placeholder?: string;\n  hint?: string;\n  options?: { value: string; label: string }[];\n  required?: boolean;`,
};
