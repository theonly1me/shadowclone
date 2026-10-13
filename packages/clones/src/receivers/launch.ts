export type LaunchSandbox = (options: {
  readonly image: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string | undefined>>;
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly wait?: (milliseconds: number) => Promise<void>;
}) => Promise<void>;

export function sandboxTemplateName(image: string): string {
  return `shadowclone-clone-${(image.split(":").at(-1) ?? "latest").replace(/[^a-z0-9-]/g, "-")}`;
}
