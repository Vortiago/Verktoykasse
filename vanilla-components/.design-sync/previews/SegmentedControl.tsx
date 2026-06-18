import { SegmentedControl } from "vanilla-components";

export const Source = () => (
  <SegmentedControl
    options={[
      { id: "original", label: "Original" },
      { id: "stripped", label: "Stripped" },
    ]}
    current="original"
  />
);

export const Summary = () => (
  <SegmentedControl
    options={[
      { id: "merged", label: "Merged" },
      { id: "speaker", label: "Per-speaker" },
      { id: "raw", label: "Raw" },
    ]}
    current="speaker"
  />
);
