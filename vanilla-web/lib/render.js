// @ts-check
// Skill-local re-export so the in-place scaffold files resolve in the flat skill
// dir. shell.js / preview.js import "./lib/render.js" per the app layout
// (web/shell.js alongside web/lib/render.js); in this skill the canonical
// module lives one level up at ../render.js. This shim lets the skill's own
// `tsc` gate type-check the scaffolds as-is. It is NOT vendored into apps — an
// app copies the real ../render.js into its own lib/.
export * from "../render.js";
