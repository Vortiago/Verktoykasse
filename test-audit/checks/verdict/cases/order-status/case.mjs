// A status code the reader must look up in the code under test.
// Source: testsmells.org, Open Catalog of Test Smells: Magic Number Test.
//   https://testsmells.org/pages/testsmells.html
test("maps a paid, unshipped order to its status code", () => {
  expect(statusCode({ paid: true, shipped: false })).toBe(7);
});
