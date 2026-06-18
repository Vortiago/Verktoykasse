// @ts-check
import { createStatCard } from "./stat-card.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "stat-card",
  render: (props) => createStatCard(props).then((c) => c.el),
  variants: {
    default: { label: "Runs", value: 0 },
    throughput: { label: "Throughput", value: "142", unit: "tok/s", tone: "ok" },
    errors: { label: "Errors", value: 3, tone: "bad", hint: "last 24h" },
    long: { label: "Active background sessions", value: "1,284" },
  },
};
