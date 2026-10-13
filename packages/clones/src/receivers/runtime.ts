import type { SessionEvent } from "../trigger/event";
import type { ReceiverSettings } from "./handler";

export type ReceiverEnvironment = Readonly<Record<string, string | undefined>>;

export const configVariable = "SHADOWCLONE_SESSION_CONFIG";
export const webhookSecretVariable = "SHADOWCLONE_WEBHOOK_SECRET";
export const forwardVariable = "SHADOWCLONE_FORWARD";

export type ReceiverRuntime = {
  readonly settings: ReceiverSettings;
  readonly host: string;
  readonly image: string;
  readonly sandboxEnvironment: (event: SessionEvent) => Record<string, string>;
};

function numberField(options: {
  readonly value: Record<string, unknown>;
  readonly name: string;
}): number {
  const field = options.value[options.name];

  if (typeof field !== "number") {
    throw new Error(`${configVariable} has no ${options.name}.`);
  }

  return field;
}

function stringField(options: {
  readonly value: Record<string, unknown>;
  readonly name: string;
}): string {
  const field = options.value[options.name];

  if (typeof field !== "string") {
    throw new Error(`${configVariable} has no ${options.name}.`);
  }

  return field;
}

export function receiverRuntime(environment: ReceiverEnvironment): ReceiverRuntime {
  const configText = environment[configVariable] ?? "";
  const parsed: unknown = JSON.parse(configText);
  const config =
    typeof parsed === "object" && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
  const reviewerBots = Array.isArray(config.reviewerBots)
    ? config.reviewerBots.filter((bot) => typeof bot === "string")
    : [];
  const forwarded = (environment[forwardVariable] ?? "")
    .split(",")
    .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));

  return {
    settings: {
      webhookSecret: environment[webhookSecretVariable] ?? "",
      ownerId: numberField({ value: config, name: "ownerId" }),
      repositoryId: numberField({ value: config, name: "repositoryId" }),
      reviewerBots,
    },
    host: stringField({ value: config, name: "host" }),
    image: stringField({ value: config, name: "image" }),
    sandboxEnvironment: (event) => ({
      ...Object.fromEntries(
        forwarded.flatMap((name) => {
          const value = environment[name];

          return value === undefined || value === "" ? [] : [[name, value]];
        }),
      ),
      [configVariable]: configText,
      SHADOWCLONE_SESSION_EVENT: JSON.stringify(event),
      IS_SANDBOX: "1",
    }),
  };
}
