// @ts-check
// Shared component discovery for the design-sync generators (emit-adapter.mjs +
// gen-previews.mjs). "Which components are in the synced set" and the dir-name →
// Pascal convention have ONE definition here, so the generated adapter exports and
// the generated preview cards can't drift apart. Both generators call
// discoverComponents(); they differ only in what they emit from the list.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** kebab dir name → PascalCase component name (e.g. "list-row" → "ListRow"). */
export const toPascal = (name) => name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");

/** Discover the synced components by walking <root>/components — a real component
 *  is a <name>/ dir holding <name>.js, and MUST carry a <name>.bridge.mjs
 *  ({ props, shim? } or { skip: true }); a real dir with a missing/broken sidecar
 *  throws here (rather than one generator silently disagreeing with the other).
 *  Returns sorted, skip-filtered { name, Pascal, props, shim }. Shim NAMES are
 *  validated by the caller — the adapter owns the shim registry, not this module.
 *  @param {string} root - the vanilla-components/ dir.
 *  @returns {Promise<{ name: string, Pascal: string, props: string, shim: string }[]>} */
export async function discoverComponents(root) {
  const dir = join(root, "components");
  const out = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    if (!(await stat(join(dir, name, `${name}.js`)).then(() => true).catch(() => false))) continue; // not a component dir
    const sidecar = join(dir, name, `${name}.bridge.mjs`);
    let meta;
    try {
      meta = (await import(pathToFileURL(sidecar).href)).default;
    } catch (err) {
      // Only "file absent" is the missing-sidecar case; a sidecar that exists but
      // fails to load (syntax/runtime error) must surface its real error.
      if (err && /** @type {{ code?: string }} */ (err).code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(`design-sync: components/${name}/ has no ${name}.bridge.mjs — add one ({ props, shim? }) so the component reaches design-sync, or set { skip: true } to opt out.`);
      }
      throw err;
    }
    if (meta?.skip) continue;
    if (typeof meta?.props !== "string") {
      throw new Error(`design-sync: ${name}.bridge.mjs must export default { props: string, shim?: string }.`);
    }
    out.push({ name, Pascal: toPascal(name), props: meta.props, shim: meta.shim ?? "declarative" });
  }
  return out;
}
