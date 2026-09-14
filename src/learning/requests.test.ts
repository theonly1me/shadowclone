import { expect, test } from "bun:test";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { installIntegration } from "../integrations/install";
import {
  nativeSessionEnd,
  nativeSessionStart,
} from "../integrations/hooks";
import { integrationFixture } from "../integrations/fixtures";
import {
  claimLearningRequests,
  learningSessionKey,
  markLearningRequest,
} from "./requests";

test("only an explicit session request becomes eligible for learning", async () => {
  const fixture = await integrationFixture();
  await writeConfig({
    configPath: fixture.paths.configFile,
    config: {
      ...defaultConfig,
      distillation: { deep: true, automatic: true },
    },
  });
  const integration = await installIntegration({
    ...fixture,
    agent: "claude-code",
    scope: "global",
  });
  const input = JSON.stringify({
    cwd: fixture.cwd,
    session_id: "private-native-session",
  });
  const start = JSON.stringify(await nativeSessionStart({
    ...fixture,
    id: integration.id,
    input,
  }));
  const tokenMatch = /learn --session ([a-f0-9-]+)/.exec(start);
  if (!tokenMatch?.[1]) {
    throw new Error("Session hook did not issue a learning token");
  }
  expect(await claimLearningRequests({
    paths: fixture.paths,
    includeUnended: true,
  })).toEqual([]);
  expect(await markLearningRequest({
    paths: fixture.paths,
    token: tokenMatch[1],
  })).toBeFalse();
  await nativeSessionEnd({ ...fixture, id: integration.id, input });
  expect(await claimLearningRequests({ paths: fixture.paths })).toEqual([
    learningSessionKey({
      agent: "claude-code",
      nativeSessionId: "private-native-session",
    }),
  ]);
  const localState = await Bun.file(
    path.join(fixture.paths.shadowcloneDirectory, "session-learning.json"),
  ).text();
  expect(localState).not.toContain("private-native-session");
});
