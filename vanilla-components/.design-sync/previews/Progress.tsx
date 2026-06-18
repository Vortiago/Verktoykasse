import { Progress } from "vanilla-components";

export const Bars = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 240 }}>
    <Progress value={64} label="Transcribing… 64%" />
    <Progress value={100} tone="ok" />
    <Progress value={38} tone="warn" />
    <Progress value={12} tone="bad" />
  </div>
);
