// A characterization guard: the exact output is pinned.
test("formats a receipt line", () => {
  expect(formatReceiptLine("Coffee", 2, 3.5)).toBe("Coffee x2 @ 3.50 = 7.00");
});
