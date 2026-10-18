import { randomBytes } from "node:crypto";
import type { HubStore } from "../store";

function ntfyTopic(): string {
  return `https://ntfy.sh/shadowclone-${randomBytes(15).toString("hex")}`;
}

function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "https:" &&
      url.pathname.length > 1 &&
      url.search === "" &&
      url.hash === ""
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function notifyLines(options: {
  readonly store: HubStore;
  readonly url?: string;
  readonly text?: boolean;
  readonly off?: boolean;
}): readonly string[] {
  const { store } = options;

  if (options.off === true) {
    store.setSetting({ key: "notifyUrl", value: null });

    return ["Push notifications are off."];
  }

  if (options.url !== undefined) {
    const url = httpsUrl(options.url);

    if (url === null) {
      throw new Error(
        "Pass the https URL of an ntfy topic, such as https://ntfy.example.com/my-topic.",
      );
    }

    store.setSetting({ key: "notifyUrl", value: url });
  } else if (store.settings().notifyUrl === null) {
    store.setSetting({ key: "notifyUrl", value: ntfyTopic() });
  }

  if (options.text !== undefined) {
    store.setSetting({ key: "notifyText", value: options.text ? "yes" : "no" });
  }

  const settings = store.settings();

  return [
    `Pushes go to ${settings.notifyUrl ?? "nowhere"}.`,
    "Subscribe to that topic in the ntfy app on your phone. Anyone who knows the topic can read the pushes, so keep it private.",
    settings.notifyText
      ? "Pushes include the repository and the question text."
      : "Pushes name the clone, its state, and its machine only. Run shadowclone hub notify --text to add the question text.",
  ];
}
