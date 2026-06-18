import { AppBar } from "vanilla-components";

export const Default = () => (
  <AppBar
    brand={{ logo: "🧰", title: "Verktøykasse", tagline: "toolbox" }}
    items={[
      { id: "overview", label: "Overview" },
      { id: "atlas", label: "Atlas" },
      { id: "timelapse", label: "Timelapse" },
      { id: "rules", label: "Game Rules" },
    ]}
    current="atlas"
  />
);

export const Accented = () => (
  <AppBar
    brand={{ title: "GitLandscape" }}
    items={[
      { id: "overview", label: "Overview", accent: "#8ab4f8" },
      { id: "atlas", label: "Atlas", accent: "#a6da95" },
      { id: "timelapse", label: "Timelapse", accent: "#f78da7" },
    ]}
    current="timelapse"
  />
);
