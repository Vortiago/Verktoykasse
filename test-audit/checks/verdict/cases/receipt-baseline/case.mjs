// A characterization test: it pins the current output as a baseline before a
// rewrite.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy.
//   http://xunitpatterns.com/
test("pins the current receipt layout before the rewrite", () => {
  const order = { lines: [{ name: "Coffee", qty: 2, price: 3.5 }] };
  expect(renderReceipt(order)).toMatchInlineSnapshot(`"Coffee x2 @ 3.50 = 7.00"`);
});
