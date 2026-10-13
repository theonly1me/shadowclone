import { launchDaytona } from "./daytona";
import { launchE2b } from "./e2b";
import type { LaunchSandbox } from "./launch";

export const launchers: Readonly<Record<string, LaunchSandbox>> = {
  daytona: launchDaytona,
  e2b: launchE2b,
};
