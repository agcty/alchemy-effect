import fs from "node:fs";
import path from "node:path";
import { exitHook } from "./exit-hook.ts";
import type { MtimePrecision } from "./mtime-precision.ts";
import * as mtimePrecision from "./mtime-precision.ts";
import * as retry from "./retry.ts";

type AnyFs = Record<string, any>;

export interface LockOptions {
  stale?: number;
  update?: number | null;
  realpath?: boolean;
  retries?: number | retry.OperationOptions;
  fs?: AnyFs;
  onCompromised?: (err: Error) => void;
  lockfilePath?: string;
}

interface ResolvedLockOptions {
  stale: number;
  update: number;
  realpath: boolean;
  retries: retry.OperationOptions;
  fs: AnyFs;
  onCompromised: (err: Error) => void;
  lockfilePath?: string;
}

export interface UnlockOptions {
  realpath?: boolean;
  fs?: AnyFs;
  lockfilePath?: string;
}

export interface CheckOptions {
  stale?: number;
  realpath?: boolean;
  fs?: AnyFs;
  lockfilePath?: string;
}

interface InternalLock {
  lockfilePath: string;
  mtime: Date;
  mtimePrecision: MtimePrecision;
  options: ResolvedLockOptions;
  lastUpdate: number;
  updateDelay?: number | null;
  updateTimeout?: ReturnType<typeof setTimeout> | null;
  released?: boolean;
}

type ReleaseCallback = (err?: NodeJS.ErrnoException | null) => void;
export type ReleaseFn = (releasedCallback?: ReleaseCallback) => void;

type LockCallback = (
  err: NodeJS.ErrnoException | null,
  release?: ReleaseFn,
) => void;
type UnlockCallback = (err?: NodeJS.ErrnoException | null) => void;
type CheckCallback = (
  err: NodeJS.ErrnoException | null,
  locked?: boolean,
) => void;
type AcquireCallback = (
  err: NodeJS.ErrnoException | null,
  mtime?: Date,
  mtimePrecision?: MtimePrecision,
) => void;

const locks: Record<string, InternalLock> = {};

function getLockFile(file: string, options: { lockfilePath?: string }): string {
  return options.lockfilePath || `${file}.lock`;
}

function resolveCanonicalPath(
  file: string,
  options: { realpath?: boolean; fs: AnyFs },
  callback: (err: NodeJS.ErrnoException | null, file: string) => void,
): void {
  if (!options.realpath) {
    return callback(null, path.resolve(file));
  }

  // Use realpath to resolve symlinks
  // It also resolves relative paths
  options.fs.realpath(file, callback);
}

function acquireLock(
  file: string,
  options: ResolvedLockOptions,
  callback: AcquireCallback,
): void {
  const lockfilePath = getLockFile(file, options);

  // Use mkdir to create the lockfile (atomic operation)
  options.fs.mkdir(lockfilePath, (err: NodeJS.ErrnoException | null) => {
    if (!err) {
      // At this point, we acquired the lock!
      // Probe the mtime precision
      return mtimePrecision.probe(
        lockfilePath,
        options.fs as any,
        (err, mtime, precision) => {
          /* istanbul ignore if */
          if (err) {
            options.fs.rmdir(lockfilePath, () => {});

            return callback(err);
          }

          callback(null, mtime, precision);
        },
      );
    }

    // If error is not EEXIST then some other error occurred while locking
    if (err.code !== "EEXIST") {
      return callback(err);
    }

    // Otherwise, check if lock is stale by analyzing the file mtime
    if (options.stale <= 0) {
      return callback(
        Object.assign(new Error("Lock file is already being held"), {
          code: "ELOCKED",
          file,
        }),
      );
    }

    options.fs.stat(
      lockfilePath,
      (err: NodeJS.ErrnoException | null, stat: import("node:fs").Stats) => {
        if (err) {
          // Retry if the lockfile has been removed (meanwhile)
          // Skip stale check to avoid recursiveness
          if (err.code === "ENOENT") {
            return acquireLock(file, { ...options, stale: 0 }, callback);
          }

          return callback(err);
        }

        if (!isLockStale(stat, options)) {
          return callback(
            Object.assign(new Error("Lock file is already being held"), {
              code: "ELOCKED",
              file,
            }),
          );
        }

        // If it's stale, remove it and try again!
        // Skip stale check to avoid recursiveness
        removeLock(file, options, (err) => {
          if (err) {
            return callback(err);
          }

          acquireLock(file, { ...options, stale: 0 }, callback);
        });
      },
    );
  });
}

function isLockStale(
  stat: import("node:fs").Stats,
  options: { stale: number },
): boolean {
  return stat.mtime.getTime() < Date.now() - options.stale;
}

function removeLock(
  file: string,
  options: { fs: AnyFs; lockfilePath?: string },
  callback: (err?: NodeJS.ErrnoException | null) => void,
): void {
  options.fs.rmdir(
    getLockFile(file, options),
    (err: NodeJS.ErrnoException | null) => {
      if (err && err.code !== "ENOENT") {
        return callback(err);
      }

      callback();
    },
  );
}

function updateLock(file: string, options: ResolvedLockOptions): void {
  const lock = locks[file];

  /* istanbul ignore if */
  if (lock.updateTimeout) {
    return;
  }

  lock.updateDelay = lock.updateDelay || options.update;
  lock.updateTimeout = setTimeout(() => {
    lock.updateTimeout = null;

    // Stat the file to check if mtime is still ours
    // If it is, we can still recover from a system sleep or a busy event loop
    options.fs.stat(
      lock.lockfilePath,
      (err: NodeJS.ErrnoException | null, stat: import("node:fs").Stats) => {
        const isOverThreshold = lock.lastUpdate + options.stale < Date.now();

        // If it failed to update the lockfile, keep trying unless
        // the lockfile was deleted or we are over the threshold
        if (err) {
          if (err.code === "ENOENT" || isOverThreshold) {
            return setLockAsCompromised(
              file,
              lock,
              Object.assign(err, { code: "ECOMPROMISED" }),
            );
          }

          lock.updateDelay = 1000;

          return updateLock(file, options);
        }

        const isMtimeOurs = lock.mtime.getTime() === stat.mtime.getTime();

        if (!isMtimeOurs) {
          return setLockAsCompromised(
            file,
            lock,
            Object.assign(
              new Error("Unable to update lock within the stale threshold"),
              { code: "ECOMPROMISED" },
            ),
          );
        }

        const mtime = mtimePrecision.getMtime(lock.mtimePrecision);

        options.fs.utimes(
          lock.lockfilePath,
          mtime,
          mtime,
          (err: NodeJS.ErrnoException | null) => {
            const isOverThreshold =
              lock.lastUpdate + options.stale < Date.now();

            if (lock.released) {
              return;
            }

            // If it failed to update the lockfile, keep trying unless
            // the lockfile was deleted or we are over the threshold
            if (err) {
              if (err.code === "ENOENT" || isOverThreshold) {
                return setLockAsCompromised(
                  file,
                  lock,
                  Object.assign(err, { code: "ECOMPROMISED" }),
                );
              }

              lock.updateDelay = 1000;

              return updateLock(file, options);
            }

            // All ok, keep updating..
            lock.mtime = mtime;
            lock.lastUpdate = Date.now();
            lock.updateDelay = null;
            updateLock(file, options);
          },
        );
      },
    );
  }, lock.updateDelay);

  // Unref the timer so that the nodejs process can exit freely
  // This is safe because all acquired locks will be automatically released
  // on process exit

  // We first check that `lock.updateTimeout.unref` exists because some users
  // may be using this module outside of NodeJS (e.g., in an electron app),
  // and in those cases `setTimeout` returns an integer.
  /* istanbul ignore else */
  if (
    lock.updateTimeout &&
    (lock.updateTimeout as { unref?: () => void }).unref
  ) {
    (lock.updateTimeout as { unref: () => void }).unref();
  }
}

function setLockAsCompromised(
  file: string,
  lock: InternalLock,
  err: Error,
): void {
  lock.released = true;

  // Cancel lock mtime update
  /* istanbul ignore if */
  if (lock.updateTimeout) {
    clearTimeout(lock.updateTimeout);
  }

  if (locks[file] === lock) {
    delete locks[file];
  }

  lock.options.onCompromised(err);
}

// ----------------------------------------------------------

export function lock(
  file: string,
  options: LockOptions | undefined,
  callback: LockCallback,
): void {
  /* istanbul ignore next */
  const merged = {
    stale: 10000,
    update: null as number | null,
    realpath: true,
    retries: 0 as number | retry.OperationOptions,
    fs: fs as AnyFs,
    onCompromised: ((err: Error) => {
      throw err;
    }) as (err: Error) => void,
    ...options,
  };

  const retriesValue = merged.retries || 0;
  const resolved: ResolvedLockOptions = {
    stale: Math.max(merged.stale || 0, 2000),
    update: 0,
    realpath: merged.realpath,
    retries:
      typeof retriesValue === "number"
        ? { retries: retriesValue }
        : retriesValue,
    fs: merged.fs,
    onCompromised: merged.onCompromised,
    lockfilePath: merged.lockfilePath,
  };

  const updateRaw =
    merged.update == null ? resolved.stale / 2 : merged.update || 0;
  resolved.update = Math.max(Math.min(updateRaw, resolved.stale / 2), 1000);

  // Resolve to a canonical file path
  resolveCanonicalPath(file, resolved, (err, file) => {
    if (err) {
      return callback(err);
    }

    // Attempt to acquire the lock
    const operation = retry.operation(resolved.retries);

    operation.attempt(() => {
      acquireLock(file, resolved, (err, mtime, precision) => {
        if (operation.retry(err as Error)) {
          return;
        }

        if (err) {
          return callback(operation.mainError());
        }

        // We now own the lock
        const internalLock: InternalLock = (locks[file] = {
          lockfilePath: getLockFile(file, resolved),
          mtime: mtime as Date,
          mtimePrecision: precision as MtimePrecision,
          options: resolved,
          lastUpdate: Date.now(),
        });

        // We must keep the lock fresh to avoid staleness
        updateLock(file, resolved);

        callback(null, (releasedCallback) => {
          if (internalLock.released) {
            return (
              releasedCallback &&
              releasedCallback(
                Object.assign(new Error("Lock is already released"), {
                  code: "ERELEASED",
                }),
              )
            );
          }

          // Not necessary to use realpath twice when unlocking
          unlock(
            file,
            { ...resolved, realpath: false },
            releasedCallback || (() => {}),
          );
        });
      });
    });
  });
}

export function unlock(
  file: string,
  options: UnlockOptions | undefined,
  callback: UnlockCallback,
): void {
  const resolved = {
    fs: fs as AnyFs,
    realpath: true,
    ...options,
  };

  // Resolve to a canonical file path
  resolveCanonicalPath(file, resolved, (err, file) => {
    if (err) {
      return callback(err);
    }

    const lock = locks[file];

    if (!lock) {
      return callback(
        Object.assign(new Error("Lock is not acquired/owned by you"), {
          code: "ENOTACQUIRED",
        }),
      );
    }

    if (lock.updateTimeout) {
      clearTimeout(lock.updateTimeout);
    }
    lock.released = true;
    delete locks[file];

    removeLock(file, resolved, callback);
  });
}

export function check(
  file: string,
  options: CheckOptions | undefined,
  callback: CheckCallback,
): void {
  const resolved = {
    stale: 10000,
    realpath: true,
    fs: fs as AnyFs,
    ...options,
  };

  resolved.stale = Math.max(resolved.stale || 0, 2000);

  // Resolve to a canonical file path
  resolveCanonicalPath(file, resolved, (err, file) => {
    if (err) {
      return callback(err);
    }

    // Check if lockfile exists
    resolved.fs.stat(
      getLockFile(file, resolved),
      (err: NodeJS.ErrnoException | null, stat: import("node:fs").Stats) => {
        if (err) {
          // If does not exist, file is not locked. Otherwise, callback with error
          return err.code === "ENOENT" ? callback(null, false) : callback(err);
        }

        // Otherwise, check if lock is stale by analyzing the file mtime
        return callback(null, !isLockStale(stat, resolved));
      },
    );
  });
}

export function getLocks(): Record<string, InternalLock> {
  return locks;
}

// Remove acquired locks on exit
/* istanbul ignore next */
exitHook(() => {
  for (const file in locks) {
    const options = locks[file].options;

    try {
      options.fs.rmdirSync(getLockFile(file, options));
    } catch (e) {
      /* Empty */
    }
  }
});
