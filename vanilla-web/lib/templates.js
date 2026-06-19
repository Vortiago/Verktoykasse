// @ts-check
// Skill-local re-export so the in-place scaffold files resolve in the flat skill
// dir. shell.js / preview.js import "./lib/templates.js" per the app layout
// (web/shell.js alongside web/lib/templates.js); in this skill the canonical
// module lives one level up at ../templates.js. This shim lets the skill's own
// `tsc` gate type-check the scaffolds as-is. It is NOT vendored into apps — an
// app copies the real ../templates.js into its own lib/.
export * from "../templates.js";
