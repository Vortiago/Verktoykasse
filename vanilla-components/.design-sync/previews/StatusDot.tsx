import { StatusDot } from "vanilla-components";

export const States = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <StatusDot tone="ok" pulse label="live" />
    <StatusDot tone="bad" pulse label="recording" />
    <StatusDot tone="warn" label="lagging" />
    <StatusDot label="idle" />
  </div>
);
