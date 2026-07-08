// @ts-check
// <vc-avatar> — declarative face of createAvatar.
//   <vc-avatar name="Ada Lovelace" size="40" tone="accent"></vc-avatar>
import { warmAvatar, createAvatarSync } from "./avatar.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-avatar", { warm: warmAvatar, sync: createAvatarSync }, {
  attrs: ["name", "initials", "src", "size", "tone"],
  numbers: ["size"],
  setters: { name: "setName", src: "setSrc" },
});
