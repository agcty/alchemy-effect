import * as Effect from "effect/Effect";
import { Daemon } from "./Daemon/Client.ts";

export const spawn = Effect.fnUntraced(function* (
  id: string,
  command: string,
  args?: string[],
  options?: { cwd?: string; env?: Record<string, string> },
) {
  const daemon = yield* Daemon;
  yield* daemon.spawn({
    id,
    command,
    args: args ?? [],
    options: {
      cwd: options?.cwd,
      env: options?.env,
      stdout: "pipe",
      stderr: "pipe",
    },
  });

  daemon.watch({
    id,
    fd: "stdout",
  });
});
