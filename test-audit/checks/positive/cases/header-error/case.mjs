// A real guard on a rejection: the thrown error and its message are a value
// the code must produce.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("rejects a header without a colon", () => {
  expect(() => parseHeader("content-length 12")).toThrow("missing colon");
});
