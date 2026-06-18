import { Panel } from "vanilla-components";

export const Titled = () => <Panel head="Sessions" body="12 active · 3 recording · 4 idle" />;

export const Headless = () => (
  <Panel body="A headless panel — body content only, no header row." />
);
