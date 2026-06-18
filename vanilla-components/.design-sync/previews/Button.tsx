import { Button } from "vanilla-components";

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Button label="Generate" variant="primary" />
    <Button label="Cancel" />
    <Button label="Delete" variant="danger" />
    <Button label="Dismiss" variant="ghost" />
    <Button label="Open" size="sm" />
  </div>
);
