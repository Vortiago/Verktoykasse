import { ChecklistRow } from "vanilla-components";

export const Items = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 260 }}>
    <ChecklistRow text="Wire up the type gate" done />
    <ChecklistRow text="Render-check design-sync" done={false} />
  </div>
);
