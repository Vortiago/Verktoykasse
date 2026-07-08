// @ts-check
// <vc-skeleton> — declarative face of createSkeleton.
//   <vc-skeleton variant="text" lines="3"></vc-skeleton>
import { warmSkeleton, createSkeletonSync } from "./skeleton.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-skeleton", { warm: warmSkeleton, sync: createSkeletonSync }, {
  attrs: ["variant", "lines", "width", "height"],
  numbers: ["lines"],
});
