// canonical source: test-audit/checks/controlled/check.mjs@9ae1caa sha256:c8bf4aed3e83a05bb1560308f190dd65ea5887c2192d97bbd2b42766775c41e2 - vendored copy, do not edit here
// The controlled check: does the test create or fake every file, server,
// environment variable, and clock it reads, rather than assume they are present?
// A test that reads none is controlled. A "no" raises the
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
      "Does the test create or fake every external thing it reads, such as a file, a server, an environment variable, or the clock? Answer yes when it reads none.",
      "it creates or fakes every external resource it reads, or it reads none",
      "it reads a file, server, environment variable, or clock that it does not create or fake",
    ),
  },
  rubric: `Controlled resources: the test creates or fakes every file, server, environment
  variable, and clock it reads. A test that reads none is controlled.`,
});
