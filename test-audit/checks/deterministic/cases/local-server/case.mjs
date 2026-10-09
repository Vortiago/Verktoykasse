// The test starts its own server and browser, so nothing outside it can change
// the result. HTTP inside the test is not a risk; a service it does not start is.
// Source: Kent Beck, Test Desiderata (2019): Deterministic, Isolated.
//   https://kentbeck.github.io/TestDesiderata/
test("saving in the browser updates the list", async () => {
  const server = await startServer({ port: 0 });
  const browser = await launchBrowser();
  const page = await browser.newPage(server.url);
  await page.click("#save");
  await page.waitForSelector(".saved");
  expect(await page.text(".saved")).toBe("Saved");
  await browser.close();
  await server.close();
});
