import { z } from "zod";
import type { BuildContext } from "../../builds/types";
import type { GitRemoteReader } from "../../signal";
import { browserJson } from "../../web/security";
import { accountSetupInput } from "../browserProtocol";
import { setUpAccountClone } from "./accountSetup";
import type { GhApiCall } from "./ghApi";
import type { GhCommand } from "./github";

export async function handleAccountSetup(
  context: BuildContext & {
    readonly request: Request;
    readonly call: GhApiCall;
    readonly command: GhCommand;
    readonly readRemote?: GitRemoteReader;
  },
): Promise<Response> {
  const { request } = context;

  if (request.method !== "POST" || request.headers.get("content-type") !== "application/json") {
    return browserJson({ status: 400, body: { error: "Expected a JSON setup action." } });
  }

  try {
    const input = accountSetupInput.parse(await request.json());
    const outcome = await setUpAccountClone({
      ...context,
      repository: input.repository,
      botLogin: input.botLogin,
      approveSkills: input.approveSkills,
    });

    return browserJson({
      body:
        outcome.kind === "configured"
          ? { kind: outcome.kind, pullUrl: outcome.pullUrl, checklist: outcome.checklist }
          : outcome,
    });
  } catch (error) {
    return browserJson({
      status: 400,
      body: {
        error:
          error instanceof z.ZodError
            ? "Enter the repository as owner/repository and the bot's GitHub login."
            : error instanceof Error
              ? error.message
              : "Setup could not complete.",
      },
    });
  }
}
