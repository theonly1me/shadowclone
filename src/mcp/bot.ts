import { z } from "zod";
import type { BuildContext } from "../builds/types";
import { serveBuildWizard } from "../web";
import { cloneStatus } from "../cloud/status";
import { isRecord } from "./protocol";

export const botTools = [
  {
    name: "shadowclone_bot",
    description:
      "Start the personal GitHub clone setup in the local browser, or read " +
      "installation status. The owner must approve registration, repository " +
      "access, guidance upload, and subscription use in the browser.",
    inputSchema: {
      type: "object",
      properties: { operation: { type: "string", enum: ["setup", "status"] } },
      required: ["operation"],
      additionalProperties: false,
    },
  },
];

const inputSchema = z.strictObject({ operation: z.enum(["setup", "status"]) });

export function createBotTool(context: BuildContext) {
  let wizard: ReturnType<typeof serveBuildWizard> | null = null;

  return {
    stop: () => wizard?.stop(),
    run: async (params: unknown) => {
      if (!isRecord(params) || params.name !== "shadowclone_bot") {
        return null;
      }

      const input = inputSchema.safeParse(params.arguments);

      if (!input.success) {
        return {
          content: [
            {
              type: "text",
              text: "Use operation setup or status. Activation requires the owner in the browser.",
            },
          ],
          isError: true,
        };
      }

      if (input.data.operation === "status") {
        return {
          content: [{ type: "text", text: JSON.stringify(await cloneStatus(context.paths)) }],
          isError: false,
        };
      }

      wizard ??= serveBuildWizard({ ...context, bot: true });
      return {
        content: [
          {
            type: "text",
            text:
              `Open ${wizard.url}. Review the exact guidance and complete GitHub ` +
              "registration, selected repository installation, and subscription " +
              "authorization yourself. Keep this MCP connection open until setup finishes.",
          },
        ],
        isError: false,
      };
    },
  };
}
