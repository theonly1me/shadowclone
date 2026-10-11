import { z } from "zod";
import path from "node:path";
import { projectPaths, readManagedPolicy } from "@shadowclone/core";
import { redactSecrets } from "@shadowclone/redact";
import { readGuidedDocument } from "./readDocument";
import { trustedGuidedHtml } from "./trustedDocument";
import { guidedGitHub, readReviewer } from "./github";
import { readGuidedVoice } from "./guidance";
import { selectGuidedEngine } from "./engine";
import { stageGuidedNotes } from "./draft";
import { guidedNoteStore } from "./noteStore";

import type { GuidedServerOptions } from "./serverOptions";
export type { GuidedServerOptions } from "./serverOptions";

function response(options: { readonly body: unknown; readonly status?: number }): Response {
  return Response.json(options.body, {
    status: options.status ?? 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function serveGuidedReview(options: GuidedServerOptions) {
  const { report, data } = await readGuidedDocument(options.file);
  const html = await trustedGuidedHtml(data);
  const managedFile =
    options.managedConfigFile === undefined
      ? projectPaths.managedConfigFile
      : options.managedConfigFile;
  const policy = await readManagedPolicy(managedFile);
  const github = options.github ?? guidedGitHub(options.checkout);
  const login = options.login ?? (await readReviewer(github));
  const engine =
    options.engine === undefined
      ? await selectGuidedEngine({
          preferred: options.preferredEngine,
          allowed: policy.allowedEngines,
        })
      : options.engine;
  const receiptDirectory =
    options.receiptDirectory ??
    path.join(projectPaths.shadowcloneDirectory, "reviews", "guided", report.reportId);
  const notes = guidedNoteStore({
    directory: receiptDirectory,
    reportId: report.reportId,
    prIds: report.pulls.map((pull) => pull.id),
  });
  const token = crypto.randomUUID() + crypto.randomUUID();
  const active = new Set<string>();
  let origin = "";
  const authorize = async () => {
    const current = await readManagedPolicy(managedFile);
    if (
      !current.enabled ||
      current.maxActionTier === "observe" ||
      current.distillation !== "allowed" ||
      !engine ||
      !current.allowedEngines.includes(engine.id)
    )
      throw new Error("Managed policy blocks this draft action. Your notes remain local.");
    if (
      report.pulls.some((pull) =>
        current.blockedOrigins.some((blocked) =>
          [pull.repository.toLowerCase(), "github.com/" + pull.repository.toLowerCase()].includes(
            blocked.toLowerCase(),
          ),
        ),
      )
    )
      throw new Error("Managed policy blocks a repository in this report.");
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    idleTimeout: 255,
    maxRequestBodySize: 2_000_000,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.origin !== origin)
        return response({ status: 403, body: { error: "Use the local review link." } });
      if (request.method === "GET" && url.pathname === "/")
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
          },
        });
      const requestOrigin = request.headers.get("origin");
      if (
        (requestOrigin !== null && requestOrigin !== origin) ||
        (request.method !== "GET" && requestOrigin !== origin) ||
        request.headers.get("X-Shadowclone-Token") !== token
      )
        return response({
          status: 403,
          body: { error: "Open the authorized local link printed by your CLI." },
        });
      if (request.method === "GET" && url.pathname === "/api/connection")
        return response({
          body: {
            reportId: report.reportId,
            engine:
              policy.enabled &&
              policy.maxActionTier !== "observe" &&
              policy.distillation === "allowed"
                ? (engine?.id ?? null)
                : null,
            login,
          },
        });
      if (
        url.pathname === "/api/notes" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        try {
          if (
            request.method === "POST" &&
            request.headers.get("content-type") !== "application/json"
          )
            return response({ status: 415, body: { error: "Expected JSON notes." } });
          return response({
            body:
              request.method === "GET"
                ? await notes.read()
                : await notes.save(await request.json()),
          });
        } catch (error) {
          return response({
            status: 409,
            body: {
              error:
                error instanceof z.ZodError
                  ? "The note state is invalid."
                  : error instanceof Error
                    ? error.message
                    : "Notes could not be saved.",
            },
          });
        }
      }
      if (request.method !== "POST" || url.pathname !== "/api/draft-review")
        return response({ status: 404, body: { error: "Unknown guided-review action." } });
      if (request.headers.get("content-type") !== "application/json")
        return response({ status: 415, body: { error: "Expected a JSON note selection." } });
      let key: string | null = null;
      try {
        const input: unknown = await request.json();
        const target = z.object({ pr: z.string() }).parse(input);
        if (active.has(target.pr))
          return response({
            status: 409,
            body: {
              error: "A draft action is already running for this PR. Your notes remain saved.",
            },
          });
        key = target.pr;
        active.add(key);
        if (!engine)
          throw new Error(
            "No authenticated Claude Code or Codex engine is available. Your notes remain local.",
          );
        const result = await stageGuidedNotes({
          input,
          report,
          checkout: options.checkout,
          github,
          login,
          engine,
          receiptDirectory,
          guidance: await readGuidedVoice(options),
          model: options.model,
          signal: request.signal,
          authorize,
        });
        return response({ body: result });
      } catch (error) {
        const message =
          error instanceof z.ZodError
            ? "The selected notes or agent response are invalid. Export your notes and inspect the review."
            : error instanceof Error
              ? redactSecrets({ text: error.message })
              : "The draft action failed. Your notes remain local.";
        return response({ status: 400, body: { error: message } });
      } finally {
        if (key !== null) active.delete(key);
      }
    },
  });
  origin = "http://127.0.0.1:" + server.port;
  return { url: origin + "/#" + token, origin, token, report, stop: () => server.stop(true) };
}
