import fs from "node:fs";

type AnyFs = Record<string, any>;
type AnyCallback = (err: NodeJS.ErrnoException | null, result?: any) => void;
type AsyncMethod = (...args: any[]) => void;

function createSyncFs(fs: AnyFs): AnyFs {
  const methods = ["mkdir", "realpath", "stat", "rmdir", "utimes"] as const;
  const newFs: AnyFs = { ...fs };

  methods.forEach((method) => {
    newFs[method] = (...args: any[]) => {
      const callback = args.pop() as AnyCallback;
      let ret;

      try {
        ret = fs[`${method}Sync`](...args);
      } catch (err) {
        return callback(err as NodeJS.ErrnoException);
      }

      callback(null, ret);
    };
  });

  return newFs;
}

// ----------------------------------------------------------

export function toPromise<T = any>(
  method: AsyncMethod,
): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => {
      args.push((err: NodeJS.ErrnoException | null, result: T) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });

      method(...args);
    });
}

export function toSync<T = any>(method: AsyncMethod): (...args: any[]) => T {
  return (...args: any[]) => {
    let err: NodeJS.ErrnoException | null | undefined;
    let result: T | undefined;

    args.push((_err: NodeJS.ErrnoException | null, _result: T) => {
      err = _err;
      result = _result;
    });

    method(...args);

    if (err) {
      throw err;
    }

    return result as T;
  };
}

export interface SyncOptions {
  fs?: AnyFs;
  retries?: number | { retries?: number };
  [key: string]: any;
}

export function toSyncOptions(options?: SyncOptions): SyncOptions {
  // Shallow clone options because we are going to mutate them
  const next: SyncOptions = { ...options };

  // Transform fs to use the sync methods instead
  next.fs = createSyncFs(next.fs || fs);

  // Retries are not allowed because it requires the flow to be sync
  if (
    (typeof next.retries === "number" && next.retries > 0) ||
    (next.retries &&
      typeof (next.retries as { retries?: number }).retries === "number" &&
      ((next.retries as { retries?: number }).retries as number) > 0)
  ) {
    throw Object.assign(new Error("Cannot use retries with the sync api"), {
      code: "ESYNC",
    });
  }

  return next;
}
