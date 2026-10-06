// The controlled check: does the test fix the time, network, filesystem, and
// environment it needs, rather than assume they are present? A "no" raises the
// `uncontrolled-resource` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic
//   Test)
//   http://xunitpatterns.com/Erratic%20Test.html
//   A test that assumes an external resource is present fails when it is not.
// - Gerard Meszaros, xUnit Test Patterns (2007): Mystery Guest (in Obscure
//   Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A test that uses an external resource hides the cause of its result.
// - testsmells.org, Open Catalog of Test Smells: Mystery Guest, Resource
//   Optimism
//   https://testsmells.org/pages/testsmells.html
//   A test that uses an external file or database, or assumes it, is a smell
//   that a tool can find.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
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
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test)", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Mystery Guest (in Obscure Test)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Mystery Guest, Resource Optimism", url: "https://testsmells.org/pages/testsmells.html" },
  ],
});
