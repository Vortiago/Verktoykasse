import { Dialog } from "vanilla-components";

export const Confirm = () => (
  <Dialog
    title="Reset the world?"
    body="This clears all parcels and re-bootstraps from the chronicle. It cannot be undone."
  />
);
