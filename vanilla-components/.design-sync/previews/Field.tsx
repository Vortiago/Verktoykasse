import { Field } from "vanilla-components";

export const Text = () => (
  <div style={{ width: 260 }}>
    <Field label="Session name" value="morning standup" placeholder="name this session" />
  </div>
);

export const Select = () => (
  <div style={{ width: 260 }}>
    <Field
      label="Backend"
      type="select"
      value="whisper"
      options={[
        { value: "whisper", label: "Whisper" },
        { value: "canary", label: "Canary" },
        { value: "auto", label: "Auto" },
      ]}
    />
  </div>
);

export const Textarea = () => (
  <div style={{ width: 260 }}>
    <Field label="Hotwords" type="textarea" value={"Verktøykasse\nSlipestein"} hint="one per line" />
  </div>
);
