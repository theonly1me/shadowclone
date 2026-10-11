import { expect, test } from "bun:test";
import { serveGuidedReview } from "./index";
import { guidedServerFixture } from "./server.fixtures";

test("the CLI reconstructs the report through its own renderer instead of running scripts from an edited document", async () => {
  const fixture = await guidedServerFixture();
  fixture.server.stop();
  await Bun.write(
    fixture.file,
    (await Bun.file(fixture.file).text()).replace(
      "</body>",
      "<script>globalThis.untrustedReviewScript = true;</script></body>",
    ),
  );
  const server = await serveGuidedReview({
    ...fixture.options,
    file: fixture.file,
    managedConfigFile: null,
  });
  try {
    const html = await (await fetch(server.origin)).text();
    expect(html).not.toContain("untrustedReviewScript");
    expect(html).toContain(fixture.report.reportId);
    expect(fixture.state.modelCalls).toBe(0);
  } finally {
    server.stop();
  }
});

test("a missing engine leaves the report readable and rejects staging without a GitHub write", async () => {
  const fixture = await guidedServerFixture();
  fixture.server.stop();
  const server = await serveGuidedReview({
    ...fixture.options,
    engine: null,
    file: fixture.file,
    managedConfigFile: null,
  });
  try {
    expect((await fetch(server.origin)).status).toBe(200);
    const response = await fetch(server.origin + "/api/draft-review", {
      method: "POST",
      headers: { ...fixture.headers, Origin: server.origin, "X-Shadowclone-Token": server.token },
      body: JSON.stringify(fixture.input),
    });
    expect(response.status).toBe(400);
    expect(fixture.state.payloads).toEqual([]);
    expect(fixture.state.modelCalls).toBe(0);
  } finally {
    server.stop();
  }
});
