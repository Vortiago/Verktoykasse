import { Chip } from "vanilla-components";

export const Tones = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Chip text="draft" />
    <Chip text="ready" tone="ok" dot />
    <Chip text="degraded" tone="warn" dot />
    <Chip text="failed" tone="bad" dot />
    <Chip text="12 live" tone="info" />
  </div>
);
