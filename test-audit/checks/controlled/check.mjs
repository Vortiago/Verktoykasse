// The controlled check: does the test fix the time, network, filesystem, and
// environment it needs, rather than assume they are present? A "no" raises the
// `uncontrolled-resource` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "controlled",
  role: "descriptive",
  flag: "uncontrolled-resource",
  questions: {
    controlled: noul(
      "Does the test control the external resources it needs, such as time, the network, the filesystem, or the environment, rather than assume they are present?",
      "its inputs and resources are controlled",
      "it assumes an external resource is present",
    ),
  },
  rubric: `Controlled resources: the test fixes the time, network, filesystem, and
  environment it needs; it does not assume they are present.`,
  sources: [
    { name: "Meszaros, xUnit Test Patterns: Resource Optimism (in Erratic Test)", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "Meszaros, xUnit Test Patterns: Mystery Guest (in Obscure Test)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Mystery Guest", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
