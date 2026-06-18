// @ts-check
import { createAppBar } from "./app-bar.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "app-bar",
  render: (props) => createAppBar(props).then((c) => c.el),
  variants: {
    default: {
      brand: { logo: "🧰", title: "Verktøykasse", tagline: "toolbox" },
      items: [
        { id: "overview", label: "Overview" },
        { id: "atlas", label: "Atlas" },
        { id: "timelapse", label: "Timelapse" },
        { id: "rules", label: "Game Rules" },
      ],
      current: "atlas",
    },
    accented: {
      brand: { title: "GitLandscape" },
      items: [
        { id: "overview", label: "Overview", accent: "#8ab4f8" },
        { id: "atlas", label: "Atlas", accent: "#a6da95" },
        { id: "timelapse", label: "Timelapse", accent: "#f78da7" },
      ],
      current: "timelapse",
    },
  },
};
