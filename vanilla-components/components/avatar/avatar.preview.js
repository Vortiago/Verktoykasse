// @ts-check
import { createAvatar } from "./avatar.js";

const IMG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>" +
  "<rect width='64' height='64' fill='%238ab4f8'/>" +
  "<text x='32' y='42' font-size='30' text-anchor='middle' fill='white'>A</text></svg>";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "avatar",
  render: (props) => createAvatar(props).then((c) => c.el),
  variants: {
    initials: { name: "Ada Lovelace" },
    image: { src: IMG, name: "Ada Lovelace" },
    toned: { name: "Kurt Gödel", tone: "info", size: 40 },
    custom: { initials: "7", tone: "#8b5cf6", size: 48 },
  },
};
