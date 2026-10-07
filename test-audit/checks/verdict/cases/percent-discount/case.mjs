// A test that builds only the data its behaviour needs.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test).
//   http://xunitpatterns.com/Obscure%20Test.html
test("takes ten percent off the total", () => {
  const cart = { items: [{ price: 100 }] };
  expect(applyDiscount(cart, 10).total).toBe(90);
});
