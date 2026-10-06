// A general fixture: the hook builds far more than the test reads.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test).
//   http://xunitpatterns.com/Obscure%20Test.html
let tenant;

beforeEach(() => {
  tenant = createTenant({
    name: "Acme",
    plan: "enterprise",
    region: "eu",
    users: [{ name: "Ada", role: "owner" }, { name: "Bob", role: "member" }],
    invoices: [{ id: 1, total: 100 }, { id: 2, total: 250 }],
    settings: { theme: "dark", locale: "en-GB", mfa: true },
  });
});

test("slugs the tenant name", () => {
  expect(tenant.slug).toBe("acme");
});
