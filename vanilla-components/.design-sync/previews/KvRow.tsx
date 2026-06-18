import { KvRow } from "vanilla-components";

export const Rows = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 240 }}>
    <KvRow label="Decode rate" value="142 tok/s" />
    <KvRow label="Status" value="healthy" tone="ok" />
    <KvRow label="Errors" value={3} tone="bad" />
  </div>
);
