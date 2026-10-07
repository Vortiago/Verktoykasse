// An integration test: the store runs against a real temporary directory.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy.
//   http://xunitpatterns.com/
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the store keeps a value on disk", async () => {
  const store = await openStore(await mkdtemp(join(tmpdir(), "store-")));
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
});
