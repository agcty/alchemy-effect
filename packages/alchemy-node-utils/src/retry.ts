export interface OperationOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  randomize?: boolean;
  forever?: boolean;
  unref?: boolean;
  maxRetryTime?: number;
}

interface RetryOperationOptions {
  forever?: boolean;
  unref?: boolean;
  maxRetryTime?: number;
}

interface AttemptTimeoutOptions {
  timeout?: number;
  cb?: (attempt?: number) => void;
}

type AttemptFn = (attempt: number) => void;

const DEFAULTS: Required<
  Omit<OperationOptions, "forever" | "unref" | "maxRetryTime">
> = {
  retries: 10,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: Infinity,
  randomize: false,
};

export function createTimeout(
  attempt: number,
  opts: Required<
    Pick<OperationOptions, "minTimeout" | "maxTimeout" | "factor" | "randomize">
  >,
): number {
  const random = opts.randomize ? Math.random() + 1 : 1;
  const timeout = Math.round(
    random * Math.max(opts.minTimeout, 1) * opts.factor ** attempt,
  );

  return Math.min(timeout, opts.maxTimeout);
}

export function timeouts(options?: OperationOptions | number[]): number[] {
  if (Array.isArray(options)) {
    return [...options];
  }

  const opts = { ...DEFAULTS, ...options };

  if (opts.minTimeout > opts.maxTimeout) {
    throw new Error("minTimeout is greater than maxTimeout");
  }

  const result: number[] = [];

  for (let i = 0; i < opts.retries; i++) {
    result.push(createTimeout(i, opts));
  }

  if (
    options &&
    !Array.isArray(options) &&
    options.forever &&
    result.length === 0
  ) {
    result.push(createTimeout(opts.retries, opts));
  }

  result.sort((a, b) => a - b);

  return result;
}

export class RetryOperation {
  private readonly originalTimeouts: number[];
  private remainingTimeouts: number[];
  private readonly options: RetryOperationOptions;
  private readonly maxRetryTime: number;
  private readonly cachedTimeouts: number[] | null;

  private fn: AttemptFn | null = null;
  private readonly errorList: Error[] = [];
  private attemptCount = 1;
  private operationTimeout: number | null = null;
  private operationTimeoutCb: ((attempt?: number) => void) | null = null;
  private operationTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private operationStart = 0;

  constructor(
    initialTimeouts: number[],
    options: RetryOperationOptions | boolean = {},
  ) {
    // Compatibility for the old (timeouts, retryForever) signature
    const opts: RetryOperationOptions =
      typeof options === "boolean" ? { forever: options } : options;

    this.originalTimeouts = [...initialTimeouts];
    this.remainingTimeouts = [...initialTimeouts];
    this.options = opts;
    this.maxRetryTime = opts.maxRetryTime ?? Infinity;
    this.cachedTimeouts = opts.forever ? [...initialTimeouts] : null;
  }

  reset(): void {
    this.attemptCount = 1;
    this.remainingTimeouts = [...this.originalTimeouts];
  }

  stop(): void {
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.remainingTimeouts = [];
  }

  retry(err?: Error | null): boolean {
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
    }

    if (!err) {
      return false;
    }

    const elapsed = Date.now() - this.operationStart;

    if (elapsed >= this.maxRetryTime) {
      this.errorList.push(err);
      this.errorList.unshift(new Error("RetryOperation timeout occurred"));

      return false;
    }

    this.errorList.push(err);

    let timeout = this.remainingTimeouts.shift();

    if (timeout === undefined) {
      if (this.cachedTimeouts) {
        // retry forever, only keep last error
        this.errorList.splice(0, this.errorList.length - 1);
        timeout = this.cachedTimeouts[this.cachedTimeouts.length - 1];
      } else {
        return false;
      }
    }

    this.retryTimer = setTimeout(() => {
      this.attemptCount += 1;

      if (this.operationTimeoutCb) {
        this.operationTimer = setTimeout(() => {
          this.operationTimeoutCb?.(this.attemptCount);
        }, this.operationTimeout ?? 0);

        if (
          this.options.unref &&
          typeof this.operationTimer.unref === "function"
        ) {
          this.operationTimer.unref();
        }
      }

      this.fn?.(this.attemptCount);
    }, timeout);

    if (this.options.unref && typeof this.retryTimer.unref === "function") {
      this.retryTimer.unref();
    }

    return true;
  }

  attempt(fn: AttemptFn, timeoutOps?: AttemptTimeoutOptions): void {
    this.fn = fn;

    if (timeoutOps) {
      if (timeoutOps.timeout != null) {
        this.operationTimeout = timeoutOps.timeout;
      }
      if (timeoutOps.cb) {
        this.operationTimeoutCb = timeoutOps.cb;
      }
    }

    if (this.operationTimeoutCb) {
      this.operationTimer = setTimeout(() => {
        this.operationTimeoutCb?.();
      }, this.operationTimeout ?? 0);
    }

    this.operationStart = Date.now();
    this.fn(this.attemptCount);
  }

  errors(): Error[] {
    return this.errorList;
  }

  attempts(): number {
    return this.attemptCount;
  }

  mainError(): Error | null {
    if (this.errorList.length === 0) {
      return null;
    }

    const counts = new Map<string, number>();
    let mainError: Error | null = null;
    let mainErrorCount = 0;

    for (const error of this.errorList) {
      const message = error.message;
      const count = (counts.get(message) ?? 0) + 1;

      counts.set(message, count);

      if (count >= mainErrorCount) {
        mainError = error;
        mainErrorCount = count;
      }
    }

    return mainError;
  }
}

export function operation(
  options?: OperationOptions | number[],
): RetryOperation {
  const computedTimeouts = timeouts(options);
  const opts = !Array.isArray(options) ? options : undefined;

  return new RetryOperation(computedTimeouts, {
    forever: opts?.forever || opts?.retries === Infinity,
    unref: opts?.unref,
    maxRetryTime: opts?.maxRetryTime,
  });
}

export function wrap<T extends Record<string, any>>(
  obj: T,
  optionsOrMethods?: OperationOptions | string[],
  methodList?: string[],
): void {
  let options: OperationOptions | undefined;
  let methods: string[] | undefined;

  if (Array.isArray(optionsOrMethods)) {
    methods = optionsOrMethods;
  } else {
    options = optionsOrMethods;
    methods = methodList;
  }

  if (!methods) {
    methods = [];
    for (const key in obj) {
      if (typeof obj[key] === "function") {
        methods.push(key);
      }
    }
  }

  for (const method of methods) {
    const original = obj[method] as (...args: any[]) => unknown;

    (obj as Record<string, any>)[method] = function retryWrapper(
      ...args: any[]
    ) {
      const op = operation(options);
      const callback = args.pop() as (
        err: Error | null,
        ...rest: any[]
      ) => void;

      args.push(function (this: unknown, err: Error | null, ...rest: any[]) {
        if (op.retry(err)) {
          return;
        }

        const finalErr = err ? op.mainError() : err;
        callback.call(this, finalErr, ...rest);
      });

      op.attempt(() => {
        original.apply(obj, args);
      });
    };

    (
      (obj as Record<string, any>)[method] as { options?: OperationOptions }
    ).options = options;
  }
}

export default { operation, timeouts, createTimeout, wrap, RetryOperation };
