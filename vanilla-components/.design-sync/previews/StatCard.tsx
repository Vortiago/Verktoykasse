import { StatCard } from "vanilla-components";

export const Default = () => <StatCard label="Runs" value={0} />;

export const Throughput = () => (
  <StatCard label="Throughput" value="142" unit="tok/s" tone="ok" />
);

export const Errors = () => (
  <StatCard label="Errors" value={3} tone="bad" hint="last 24h" />
);
