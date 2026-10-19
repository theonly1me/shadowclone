import { liveSessionsEnabled } from "./consent";
import { livePaths } from "./paths";
import { localLive, type LiveSessions } from "./sessions";
import { terminalTyper } from "./terminal";

export function machineLive(): LiveSessions {
  return localLive({
    paths: livePaths(),
    enabled: () => liveSessionsEnabled(),
    typeText: terminalTyper(),
  });
}
