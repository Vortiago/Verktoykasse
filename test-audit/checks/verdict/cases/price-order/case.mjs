// A comparison folded into one boolean: a failure shows only true and false.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message).
//   http://xunitpatterns.com/Assertion%20Roulette.html
test("sorts by price ascending", () => {
  const sorted = sortByPrice([{ price: 3 }, { price: 1 }, { price: 2 }]);
  expect(JSON.stringify(sorted) === JSON.stringify([{ price: 1 }, { price: 2 }, { price: 3 }])).toBe(true);
});
