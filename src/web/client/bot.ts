import { setupPreviewSchema, setupStateSchema } from "../../cloud/browserProtocol";
import { request } from "./api";
import { create } from "./dom";
import { botButton, botField } from "./botControls";
import { showBotPreview } from "./botPreview";

export function initializeBotSetup(): void {
  const dialog = create({ tag: "dialog" });
  dialog.className = "bot-dialog";
  const title = create({ tag: "h2", text: "Your personal GitHub clone" });
  const content = create({ tag: "div" });
  const status = create({ tag: "p" });
  const close = create({ tag: "button", className: "quiet-button", text: "Close" });

  title.id = "bot-title";
  dialog.setAttribute("aria-labelledby", title.id);
  status.setAttribute("role", "status");
  close.addEventListener("click", () => dialog.close());
  dialog.append(title, content, status, close);
  document.body.append(dialog);

  async function load(): Promise<void> {
    const state = await request({ path: "/api/bot/state", schema: setupStateSchema });

    content.replaceChildren();

    if (state.pullUrl) {
      const link = create({ tag: "a", text: "Review the setup PR" });

      link.href = state.pullUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      content.append(link);
      status.textContent =
        "The clone starts after you merge its setup PR. Create one small issue to " +
        "verify the installation.";
      return;
    }

    if (state.app) {
      const install = create({ tag: "a", text: `Install ${state.app.name} on GitHub` });
      const token = botField({ label: "Claude subscription token", type: "password" });
      const approve = create({ tag: "input" });
      const consent = create({ tag: "label", className: "bot-consent" });

      install.href = state.app.installUrl;
      install.target = "_blank";
      install.rel = "noreferrer";
      token.input.autocomplete = "off";
      approve.type = "checkbox";
      consent.append(
        approve,
        document.createTextNode(
          "I authorize this repository to use my Claude subscription and the reviewed " +
            "guidance.",
        ),
      );
      content.append(
        install,
        create({
          tag: "p",
          text:
            `Choose Only select repositories. Include ${state.repository}. ` +
            "Return to this tab after installation. All repositories is rejected.",
        }),
        create({
          tag: "p",
          text:
            "Run claude setup-token in your terminal. Use Safari for your personal " +
            "Claude sign-in. Paste the resulting token below.",
        }),
        token.label,
        consent,
        botButton({
          text: "Verify installation and create the setup PR",
          status,
          action: async () => {
            const previewId = sessionStorage.getItem("shadowclone-bot-preview");

            if (!previewId || !approve.checked) {
              throw new Error("Approve subscription use after reviewing the guidance.");
            }

            const credential = token.input.value.trim();

            token.input.value = "";
            await request({
              path: "/api/bot/activate",
              body: { previewId, token: credential },
              schema: setupStateSchema,
            });
            await load();
          },
        }),
      );
      status.textContent = "GitHub controls account and organization installation approval.";
      return;
    }

    const repository = botField({
      label: "Repository (owner/repository)",
      value: new URLSearchParams(location.search).get("repository") ?? state.repository ?? "",
    });
    const name = botField({ label: "Clone name", value: "my-shadowclone" });
    const skills = botField({
      label: "Selected skill names, separated by commas",
      value: state.skills.length ? state.skills.join(", ") : "shadowclone-work",
    });

    content.append(
      create({
        tag: "p",
        text:
          "Create a GitHub App that you own and name. Only selected repositories " +
          "receive access. Owner issues start work; @shadowclone requests changes. You " +
          "review and merge each PR.",
      }),
      repository.label,
      name.label,
      skills.label,
      botButton({
        text: "Preview the exact guidance",
        status,
        action: async () => {
          const preview = await request({
            path: "/api/bot/preview",
            schema: setupPreviewSchema,
            body: {
              repository: repository.input.value.trim(),
              name: name.input.value.trim(),
              skills: skills.input.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            },
          });

          showBotPreview({ container: content, status, preview });
        },
      }),
    );
    status.textContent =
      "Start in this repository checkout with gh auth login and an active " +
      "Shadowclone skills environment.";
  }

  const button = botButton({
    text: "GitHub clone",
    status,
    action: async () => {
      dialog.showModal();
      await load();
    },
  });

  document.querySelector(".toolbar")?.append(button);

  if (new URLSearchParams(location.search).get("bot") === "github") {
    button.click();
  }
}
