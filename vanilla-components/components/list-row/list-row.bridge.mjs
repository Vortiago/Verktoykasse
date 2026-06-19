// @ts-check
// design-sync bridge contract for list-row (read by bridge/emit-adapter.mjs).
// leading/trailing narrow to string here (the design surface is declarative;
// the real factory also accepts a Node).
export default {
  props: `title: string;\n  meta?: string;\n  leading?: string;\n  trailing?: string;\n  href?: string;`,
};
