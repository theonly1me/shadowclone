import { z } from "zod";
import { boardPairSchema, boardSessionSchema } from "@shadowclone/live/board";

const nodeName = z.string().min(1);

export const fleetNodeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    name: nodeName,
    status: z.literal("online"),
    live: z.enum(["on", "off"]),
    ended: z.number().int().nonnegative(),
    clones: z.number().int().nonnegative(),
  }),
  z.strictObject({ name: nodeName, status: z.literal("text"), text: z.string() }),
  z.strictObject({ name: nodeName, status: z.literal("failed"), text: z.string() }),
  z.strictObject({
    name: nodeName,
    status: z.literal("offline"),
    lastSeenAt: z.string().nullable(),
  }),
]);

export type FleetNode = z.infer<typeof fleetNodeSchema>;

export const fleetSessionSchema = boardSessionSchema.extend({ node: nodeName });

export type FleetSession = z.infer<typeof fleetSessionSchema>;

export const fleetPairSchema = boardPairSchema.extend({ node: nodeName });

export type FleetPair = z.infer<typeof fleetPairSchema>;

export const fleetBoardSchema = z.strictObject({
  kind: z.literal("fleet"),
  hub: nodeName,
  nodes: z.array(fleetNodeSchema),
  sessions: z.array(fleetSessionSchema),
  pairs: z.array(fleetPairSchema),
});

export type FleetBoard = z.infer<typeof fleetBoardSchema>;
