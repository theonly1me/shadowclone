import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sampleConfig } from "../fixtures";
import { modalDispatch } from "./modal";

const directories: string[] = [];

afterAll(async () => {
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const stubModal = `class _Image:
    def pip_install(self, *args): return self
class Image:
    @staticmethod
    def debian_slim(): return _Image()
    @staticmethod
    def from_registry(name): return _Image()
class App:
    def __init__(self, name): pass
    def function(self, **options): return lambda handler: handler
class Secret:
    @staticmethod
    def from_name(name): return name
def fastapi_endpoint(**options): return lambda handler: handler
`;

const stubFastapi = `class HTTPException(Exception):
    def __init__(self, status_code): self.status_code = status_code
class Request: pass
class Response:
    def __init__(self, status_code): self.status_code = status_code
`;

const probe = `import json, sys
import dispatch
config = {"repositoryId": 7, "ownerId": 11, "reviewerBots": ["coderabbitai[bot]"]}
comment = lambda sender, body: {"action": "created", "repository": {"id": 7}, "sender": sender, "issue": {"number": 12}, "comment": {"id": 501, "body": body}}
owner = {"id": 11, "login": "sample", "type": "User"}
print(json.dumps([
    dispatch.session_event("issue_comment", comment(owner, "/shadowclone fix it"), config),
    dispatch.session_event("issue_comment", comment({"id": 12, "login": "sample", "type": "User"}, "/shadowclone fix it"), config),
    dispatch.session_event("issue_comment", comment(owner, "no command"), config),
    dispatch.session_event("workflow_run", {"action": "completed", "repository": {"id": 7}, "workflow_run": {"id": 900, "actor": {"id": 11}}}, config),
]))
`;

test("the Modal receiver accepts only the owner's command and the owner's CI runs, like the TypeScript receiver", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-modal-"));

  directories.push(directory);
  await writeFile(
    path.join(directory, "dispatch.py"),
    modalDispatch(sampleConfig({ host: "modal" })),
  );
  await writeFile(path.join(directory, "modal.py"), stubModal);
  await writeFile(path.join(directory, "fastapi.py"), stubFastapi);
  await writeFile(path.join(directory, "probe.py"), probe);

  const child = Bun.spawn(["python3", "probe.py"], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(JSON.parse(stdout)).toEqual([
    { kind: "comment", source: "issue_comment", id: 501, entity: 12 },
    null,
    null,
    { kind: "ci", runId: 900 },
  ]);
});
