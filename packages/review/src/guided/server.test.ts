import { expect, test } from "bun:test";
import { guidedServerFixture } from "./server.fixtures";

test("opening a connected guide invokes no model and accepts no unauthenticated draft action", async () => {
  const fixture = await guidedServerFixture();
  try {
    const page = await fetch(fixture.server.origin);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('id="note-editor"');
    const denied = await fetch(fixture.server.origin + "/api/draft-review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify(fixture.input),
    });
    expect(denied.status).toBe(403);
    expect(fixture.state.modelCalls).toBe(0);
    expect(fixture.state.payloads).toEqual([]);
  } finally {
    fixture.server.stop();
  }
});

test("connected notes persist privately and an old revision cannot overwrite newer notes", async () => {
  const fixture = await guidedServerFixture();
  try {
    const state = {
      version: 1,
      reportId: fixture.report.reportId,
      notes: fixture.input.notes,
      progress: { retry: true },
      showProposals: false,
    };
    const saved = await fetch(fixture.server.origin + "/api/notes", {
      method: "POST",
      headers: fixture.headers,
      body: JSON.stringify({ expectedFingerprint: null, state }),
    });
    expect(saved.status).toBe(200);
    const restored = await fetch(fixture.server.origin + "/api/notes", {
      headers: fixture.headers,
    });
    expect(await restored.json()).toMatchObject({
      state: { notes: [{ body: "ask about the three attempt limit" }], progress: { retry: true } },
    });
    const stale = await fetch(fixture.server.origin + "/api/notes", {
      method: "POST",
      headers: fixture.headers,
      body: JSON.stringify({ expectedFingerprint: null, state: { ...state, notes: [] } }),
    });
    expect(stale.status).toBe(409);
    expect(fixture.state.modelCalls).toBe(0);
    expect(fixture.state.payloads).toEqual([]);
  } finally {
    fixture.server.stop();
  }
});

test("a second rejected request cannot release the first request's draft lock", async () => {
  const fixture = await guidedServerFixture();
  const waiting = Promise.withResolvers<void>();
  const running = Promise.withResolvers<void>();
  fixture.state.beforeReply = async () => {
    running.resolve();
    await waiting.promise;
  };
  const submit = () =>
    fetch(fixture.server.origin + "/api/draft-review", {
      method: "POST",
      headers: fixture.headers,
      body: JSON.stringify(fixture.input),
    });
  try {
    const first = submit();
    await running.promise;
    expect((await submit()).status).toBe(409);
    expect((await submit()).status).toBe(409);
    waiting.resolve();
    expect((await first).status).toBe(200);
    expect(fixture.state.modelCalls).toBe(1);
    expect(fixture.state.payloads).toHaveLength(1);
  } finally {
    waiting.resolve();
    fixture.server.stop();
  }
});
