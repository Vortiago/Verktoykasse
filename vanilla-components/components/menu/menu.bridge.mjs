// @ts-check
// design-sync bridge contract for menu (read by bridge/emit-adapter.mjs). menu is
// imperative — createMenu(trigger, { items }, signal) — so it uses the custom
// "menu" shim, which mounts a trigger and opens the menu on the card.
export default {
  props: `items: ({ id: string; label: string; icon?: string; disabled?: boolean; danger?: boolean } | "separator")[];`,
  shim: "menu",
};
