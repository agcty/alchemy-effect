/**
 * Run a child process in the foreground: proxy signals to it, forward stdio,
 * bridge IPC, and exit with the child's code/signal. A watchdog process
 * ensures the child is killed if the parent dies unexpectedly.
 *
 * Adapted from `foreground-child@4.0.3` (© Isaac Z. Schlueter et al.):
 *   https://github.com/tapjs/foreground-child
 * Licensed under the Blue Oak Model License 1.0.0:
 *   https://blueoakcouncil.org/license/1.0.0
 *
 * The behavioral additions on top of upstream are:
 *   1. Optional `stderrFilter` — upstream hardcodes `stdio = [0, 1, 2]`,
 *      which makes intercepting child stderr impossible without forking.
 *      When `stderrFilter` is provided, the child's stderr is piped,
 *      line-buffered, and each line is passed through the filter
 *      (return `false` to drop, `true` to forward).
 *   2. Uses the in-tree {@link exitHook} instead of `signal-exit`, so this
 *      package has no external runtime dependencies.
 *
 * Everything else — signal proxying, the watchdog, IPC bridging, exit-code
 * forwarding — is preserved verbatim from upstream.
 */
import { type ChildProcess, spawn } from "node:child_process";
import constants from "node:constants";
import { exitHook } from "./exit-hook.ts";

type Signal = NodeJS.Signals;

const allSignals = Object.keys(constants).filter(
  (k) => k.startsWith("SIG") && k !== "SIGPROF" && k !== "SIGKILL",
) as Signal[];

function proxySignals(child: ChildProcess): () => void {
  const listeners = new Map<Signal, () => void>();
  for (const sig of allSignals) {
    const listener = (): void => {
      try {
        child.kill(sig);
      } catch (_) {}
    };
    try {
      process.on(sig, listener);
      listeners.set(sig, listener);
    } catch (_) {}
  }
  const unproxy = (): void => {
    for (const [sig, listener] of listeners) {
      process.removeListener(sig, listener);
    }
  };
  child.on("exit", unproxy);
  return unproxy;
}

const watchdogCode = String.raw`
const pid = parseInt(process.argv[1], 10)
process.title = 'node (foreground-child watchdog pid=' + pid + ')'
if (!isNaN(pid)) {
  let barked = false
  const interval = setInterval(() => {}, 60000)
  const bark = () => {
    clearInterval(interval)
    if (barked) return
    barked = true
    process.removeListener('SIGHUP', bark)
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL')
        setTimeout(() => process.exit(), 200)
      } catch (_) {}
    }, 500)
  }
  process.on('SIGHUP', bark)
}
`;

function watchdog(child: ChildProcess): ChildProcess {
  let dogExited = false;
  const dog = spawn(process.execPath, ["-e", watchdogCode, String(child.pid)], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  dog.on("exit", () => {
    dogExited = true;
  });
  dog.stderr?.pipe(process.stderr, { end: false });
  child.on("exit", () => {
    if (!dogExited) dog.kill("SIGKILL");
  });
  process.on("exit", () => {
    if (!dogExited) dog.kill("SIGKILL");
  });
  return dog;
}

function isPromise<T>(o: unknown): o is Promise<T> {
  return (
    !!o &&
    typeof o === "object" &&
    typeof (o as { then?: unknown }).then === "function"
  );
}

type SyncCleanupResult =
  | void
  | undefined
  | null
  | boolean
  | number
  | string
  | NodeJS.Signals;

export type CleanupResult = SyncCleanupResult | Promise<SyncCleanupResult>;

export interface ForegroundChildOptions {
  /**
   * Line-level filter for the child's stderr. Return `true` to forward the
   * line to the parent's stderr, `false` to drop it. When omitted, the
   * child's stderr is inherited directly (no buffering, no filtering).
   */
  stderrFilter?: (line: string) => boolean;
  /**
   * Called when the child closes. May return:
   *   - `false` — suppress propagation of the child's exit
   *   - `number` — override the parent's exit code
   *   - `string` (a signal name) — kill the parent with that signal
   *   - `void` / `undefined` — propagate the child's code/signal verbatim
   * Async (Promise-returning) cleanup is supported.
   */
  cleanup?: (
    code: number | null,
    signal: NodeJS.Signals | null,
    extra: { watchdogPid: number | undefined },
  ) => CleanupResult;
}

/**
 * Run `program` with `args` as a foreground child of the current process.
 *
 * Signals received by the parent are proxied to the child, the child's stdio
 * is connected to the parent's (with optional stderr filtering via
 * {@link ForegroundChildOptions.stderrFilter}), IPC messages are bridged in
 * both directions, and the parent exits with the child's exit code or
 * signal. A watchdog subprocess ensures the child is force-killed if the
 * parent dies unexpectedly.
 */
export function foregroundChild(
  program: string,
  args: ReadonlyArray<string>,
  opts: ForegroundChildOptions = {},
): ChildProcess {
  const { stderrFilter, cleanup = (): void => {} } = opts;

  const stdio: Array<"pipe" | "ignore" | "inherit" | number> = stderrFilter
    ? [0, 1, "pipe"]
    : [0, 1, 2];
  if (process.send) stdio.push("ipc" as unknown as number);

  const child = spawn(program, args as string[], { stdio });

  if (stderrFilter && child.stderr) {
    let buf = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      buf += chunk.toString();
      let nl: number;
      while ((nl = buf.search(/\r?\n/)) !== -1) {
        const eol = buf.startsWith("\r\n", nl) ? 2 : 1;
        const line = buf.slice(0, nl + eol);
        buf = buf.slice(nl + eol);
        if (stderrFilter(line)) process.stderr.write(line);
      }
    });
    child.stderr.on("end", () => {
      if (buf && stderrFilter(buf)) process.stderr.write(buf);
    });
  }

  const childHangup = (): void => {
    try {
      child.kill("SIGHUP");
    } catch (_) {
      child.kill("SIGTERM");
    }
  };
  const removeOnExit = exitHook(childHangup);

  proxySignals(child);
  const dog = watchdog(child);

  let done = false;
  dog.on("close", (code, signal) => {
    if (done) return;
    child.kill("SIGKILL");
    throw new Error("foreground-child watchdog process died unexpectedly!", {
      cause: {
        pid: dog.pid,
        code,
        signal,
        watchedProcess: { cmd: program, args, pid: child.pid },
      },
    });
  });

  child.on("close", async (code, signal) => {
    if (done) return;
    done = true;
    const result = cleanup(code, signal, { watchdogPid: dog.pid });
    const res = isPromise<SyncCleanupResult>(result) ? await result : result;
    removeOnExit();
    if (res === false) return;
    let finalCode: number | null = code;
    let finalSignal: NodeJS.Signals | null = signal;
    if (typeof res === "string") {
      finalSignal = res as NodeJS.Signals;
      finalCode = null;
    } else if (typeof res === "number") {
      finalCode = res;
      finalSignal = null;
    }
    if (finalSignal) {
      setTimeout(() => {}, 2000);
      try {
        process.kill(process.pid, finalSignal);
      } catch (_) {
        process.kill(process.pid, "SIGTERM");
      }
    } else {
      process.exit(finalCode ?? 0);
    }
  });

  if (process.send) {
    process.removeAllListeners("message");
    child.on("message", (message, sendHandle) => {
      process.send?.(message, sendHandle);
    });
    process.on("message", (message, sendHandle) => {
      if (message === null) return;
      child.send(message, sendHandle);
    });
  }

  return child;
}
