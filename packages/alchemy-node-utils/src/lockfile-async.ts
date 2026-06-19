import { toPromise, toSync, toSyncOptions } from "./adapter.ts";
import type {
  CheckOptions,
  LockOptions,
  ReleaseFn,
  UnlockOptions,
} from "./lockfile.ts";
import * as lockfile from "./lockfile.ts";

export type { CheckOptions, LockOptions, ReleaseFn, UnlockOptions };

export async function lock(
  file: string,
  options?: LockOptions,
): Promise<() => Promise<void>> {
  const release = await toPromise<ReleaseFn>(lockfile.lock)(file, options);

  return toPromise<void>(release);
}

export function lockSync(file: string, options?: LockOptions): () => void {
  const release = toSync<ReleaseFn>(lockfile.lock)(
    file,
    toSyncOptions(options),
  );

  return toSync<void>(release);
}

export function unlock(file: string, options?: UnlockOptions): Promise<void> {
  return toPromise<void>(lockfile.unlock)(file, options);
}

export function unlockSync(file: string, options?: UnlockOptions): void {
  return toSync<void>(lockfile.unlock)(file, toSyncOptions(options));
}

export function check(file: string, options?: CheckOptions): Promise<boolean> {
  return toPromise<boolean>(lockfile.check)(file, options);
}

export function checkSync(file: string, options?: CheckOptions): boolean {
  return toSync<boolean>(lockfile.check)(file, toSyncOptions(options));
}
