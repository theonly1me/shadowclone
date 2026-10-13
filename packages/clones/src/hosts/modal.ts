import type { SessionConfig } from "../session/config";
import { deploymentName } from "./cloudflare";

export const modalCli = ["modal"] as const;

export const modalInstall = "pip install modal==1.6.1";

export function modalNames(config: Pick<SessionConfig, "repository">) {
  const app = deploymentName(config);

  return { app, receiverSecret: `${app}-receiver`, runSecret: `${app}-run` };
}

export function modalDispatch(config: SessionConfig): string {
  const names = modalNames(config);

  return `import hashlib
import hmac
import json
import os
import re

import modal
from fastapi import HTTPException, Request, Response

APP_NAME = ${JSON.stringify(names.app)}
RUN_SECRET = ${JSON.stringify(names.runSecret)}
RECEIVER_SECRET = ${JSON.stringify(names.receiverSecret)}
CLONE_IMAGE = ${JSON.stringify(config.image)}
COMMAND = re.compile(r"^\\s*/shadowclone(?=$|\\s)", re.IGNORECASE)
COMMENT_EVENTS = {
    "issue_comment": ("comment", "issue", ("created", "edited")),
    "pull_request_review_comment": ("comment", "pull_request", ("created", "edited")),
    "pull_request_review": ("review", "pull_request", ("submitted", "edited")),
}

app = modal.App(APP_NAME)
receiver_image = modal.Image.debian_slim().pip_install("fastapi[standard]")
clone_image = modal.Image.from_registry(CLONE_IMAGE)


def session_event(name, payload, config):
    if (payload.get("repository") or {}).get("id") != config["repositoryId"]:
        return None

    action = payload.get("action")

    if name == "workflow_run":
        run = payload.get("workflow_run") or {}
        owner_run = (run.get("actor") or {}).get("id") == config["ownerId"]
        return {"kind": "ci", "runId": run["id"]} if action == "completed" and isinstance(run.get("id"), int) and owner_run else None

    shape = COMMENT_EVENTS.get(name)

    if shape is None or action not in shape[2]:
        return None

    item = payload.get(shape[0]) or {}
    entity = (payload.get(shape[1]) or {}).get("number")
    sender = payload.get("sender") or {}
    first_line = (item.get("body") or "").split("\\n")[0]
    owner = sender.get("id") == config["ownerId"] and sender.get("type") == "User" and COMMAND.match(first_line) is not None
    reviewer_bot = sender.get("type") == "Bot" and sender.get("login") in config.get("reviewerBots", [])

    if not isinstance(item.get("id"), int) or not isinstance(entity, int) or not (owner or reviewer_bot):
        return None

    return {"kind": "comment", "source": name, "id": item["id"], "entity": entity}


@app.function(image=receiver_image, secrets=[modal.Secret.from_name(RECEIVER_SECRET)])
@modal.fastapi_endpoint(method="POST")
async def webhook(request: Request):
    body = await request.body()
    secret = os.environ["SHADOWCLONE_WEBHOOK_SECRET"].encode()
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(status_code=401)

    name = request.headers.get("x-github-event", "")
    config_text = os.environ["SHADOWCLONE_SESSION_CONFIG"]
    event = None if name == "ping" else session_event(name, json.loads(body), json.loads(config_text))

    if event is None:
        return Response(status_code=204)

    sessions = await modal.App.lookup.aio(APP_NAME + "-sessions", create_if_missing=True)
    await modal.Sandbox.create.aio(
        "shadowclone",
        "session",
        "run",
        app=sessions,
        image=clone_image,
        timeout=3 * 60 * 60,
        secrets=[
            modal.Secret.from_name(RUN_SECRET),
            modal.Secret.from_dict(
                {"SHADOWCLONE_SESSION_CONFIG": config_text, "SHADOWCLONE_SESSION_EVENT": json.dumps(event), "IS_SANDBOX": "1"}
            ),
        ],
    )
    return Response(status_code=202)
`;
}

export function modalUrl(deployOutput: string): string | null {
  return /https:\/\/[a-z0-9-]+--[a-z0-9-]+\.modal\.run/.exec(deployOutput)?.[0] ?? null;
}
