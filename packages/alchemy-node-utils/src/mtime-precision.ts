import type { Stats } from "node:fs";

export type MtimePrecision = "s" | "ms";

export interface MtimePrecisionFs {
  stat(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, stats: Stats) => void,
  ): void;
  utimes(
    path: string,
    atime: Date,
    mtime: Date,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
}

type ProbeCallback = (
  err: NodeJS.ErrnoException | null,
  mtime?: Date,
  precision?: MtimePrecision,
) => void;

const cacheSymbol = Symbol();

interface CachedFs extends MtimePrecisionFs {
  [cacheSymbol]?: MtimePrecision;
}

export function probe(
  file: string,
  fs: MtimePrecisionFs,
  callback: ProbeCallback,
): void {
  const cachedFs = fs as CachedFs;
  const cachedPrecision = cachedFs[cacheSymbol];

  if (cachedPrecision) {
    return fs.stat(file, (err, stat) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      callback(null, stat.mtime, cachedPrecision);
    });
  }

  // Set mtime by ceiling Date.now() to seconds + 5ms so that it's "not on the second"
  const mtime = new Date(Math.ceil(Date.now() / 1000) * 1000 + 5);

  fs.utimes(file, mtime, mtime, (err) => {
    /* istanbul ignore if */
    if (err) {
      return callback(err);
    }

    fs.stat(file, (err, stat) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      const precision: MtimePrecision =
        stat.mtime.getTime() % 1000 === 0 ? "s" : "ms";

      // Cache the precision in a non-enumerable way
      Object.defineProperty(fs, cacheSymbol, { value: precision });

      callback(null, stat.mtime, precision);
    });
  });
}

export function getMtime(precision: MtimePrecision): Date {
  let now = Date.now();

  if (precision === "s") {
    now = Math.ceil(now / 1000) * 1000;
  }

  return new Date(now);
}
