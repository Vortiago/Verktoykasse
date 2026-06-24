// @ts-check
// design-sync bridge contract for scroll-stack (read by bridge/emit-adapter.mjs).
// children narrows to string[] here (the design surface is declarative; the real
// factory also accepts Nodes).
export default {
  props: `children?: string[];`,
};
