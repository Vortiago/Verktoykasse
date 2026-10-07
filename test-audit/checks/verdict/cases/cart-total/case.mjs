// A matcher that reports the expected and the received value.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message).
//   http://xunitpatterns.com/Assertion%20Roulette.html
test("totals the cart", () => {
  expect(cartTotal([{ price: 2, qty: 3 }, { price: 1, qty: 1 }])).toBe(7);
});
