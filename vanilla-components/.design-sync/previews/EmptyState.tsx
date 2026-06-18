import { EmptyState } from "vanilla-components";

export const Full = () => (
  <EmptyState icon="🎙" title="No sessions yet" detail="Start one to see it here." />
);

export const Plain = () => <EmptyState title="No matches" />;
