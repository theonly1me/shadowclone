import type { z } from "zod";
import { manifestViewSchema, type setupPreviewSchema } from "../../cloud/browserProtocol";
import { request } from "./api";
import { create } from "./dom";
import { botButton } from "./botControls";

type Preview = z.infer<typeof setupPreviewSchema>;

export function showBotPreview(options: {
  readonly container: HTMLElement;
  readonly status: HTMLElement;
  readonly preview: Preview;
}) {
  const { container, status, preview } = options;

  container.replaceChildren();
  container.append(
    create({
      tag: "p",
      text:
        `Repository: ${preview.repository} (ID ${preview.repositoryId}). ` +
        `App owner: ${preview.appOwner}. Requester: ${preview.owner}. ` +
        `Guidance: ${preview.bytes} encoded bytes.`,
    }),
  );
  container.append(
    create({
      tag: "p",
      text:
        "Review every file below. Approval uploads this exact bundle to a GitHub " +
        "environment for Claude subscription runs. The default-branch workflow and " +
        "code executed with credentials remain trusted.",
    }),
  );

  for (const file of preview.files) {
    const details = create({ tag: "details" });
    const bytes = Uint8Array.from(atob(file.content), (character) => character.charCodeAt(0));

    let text: string;

    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = `Binary resource (${bytes.length} bytes), shown as base64:\n${file.content}`;
    }

    details.append(create({ tag: "summary", text: file.path }), create({ tag: "pre", text }));
    container.append(details);
  }

  const approved = create({ tag: "input" });
  const consent = create({ tag: "label", className: "bot-consent" });

  approved.type = "checkbox";
  consent.append(
    approved,
    document.createTextNode("I reviewed the exact guidance and authorize its cloud use."),
  );
  container.append(consent);
  container.append(
    botButton({
      text: "Approve guidance and register my GitHub App",
      status,
      action: async () => {
        if (!approved.checked) {
          throw new Error("Review the files and select the approval checkbox.");
        }

        const view = await request({
          path: "/api/bot/manifest",
          body: { previewId: preview.id },
          schema: manifestViewSchema,
        });
        const form = create({ tag: "form" });
        const manifest = create({ tag: "input" });

        form.action = view.action;
        form.method = "post";
        manifest.type = "hidden";
        manifest.name = "manifest";
        manifest.value = view.manifest;
        form.append(manifest);
        container.append(form);
        sessionStorage.setItem("shadowclone-bot-preview", preview.id);
        form.submit();
      },
    }),
  );
  status.textContent = "Review the selected guidance before continuing.";
}
