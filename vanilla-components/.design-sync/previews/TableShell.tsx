import { TableShell } from "vanilla-components";

export const Scorecard = () => (
  <div style={{ width: 360 }}>
    <TableShell
      caption="Recent runs"
      columns={[
        { key: "date", label: "Date" },
        { key: "task", label: "Task" },
        { key: "score", label: "Score", align: "end" },
      ]}
      rows={[
        ["2026-06-14", "Refactor parser", 92],
        ["2026-06-15", "Add type gate", 88],
        ["2026-06-16", "Wire design-sync", 95],
      ]}
    />
  </div>
);

export const Pairs = () => (
  <div style={{ width: 240 }}>
    <TableShell
      columns={[
        { key: "key", label: "Setting" },
        { key: "value", label: "Value", align: "end" },
      ]}
      rows={[
        ["Workers", 4],
        ["Timeout", "30s"],
      ]}
    />
  </div>
);
