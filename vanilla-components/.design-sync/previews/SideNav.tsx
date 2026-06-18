import { SideNav } from "vanilla-components";

export const Grouped = () => (
  <div style={{ width: 232 }}>
    <SideNav
      groups={[
        {
          label: "Global",
          items: [
            { id: "taps", label: "Taps", icon: "🎙", chip: { text: "3 live", tone: "ok" } },
            { id: "people", label: "People", icon: "👥" },
            { id: "sessions", label: "Sessions", icon: "🗂", chip: { text: "12" } },
            { id: "settings", label: "Settings", icon: "⚙" },
          ],
        },
      ]}
      current="taps"
    />
  </div>
);

export const Journey = () => (
  <div style={{ width: 232 }}>
    <SideNav
      groups={[
        {
          label: "This session",
          variant: "journey",
          items: [
            { id: "capture", label: "Capture", done: true },
            { id: "recordings", label: "Recordings", done: true, chip: { text: "8 WAV" } },
            { id: "transcript", label: "Transcript", chip: { text: "tx", tone: "warn" } },
            { id: "summary", label: "Summary" },
          ],
        },
      ]}
      current="transcript"
    />
  </div>
);
