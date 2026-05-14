/// <reference types="@cloudflare/workers-types/experimental" />

import { CONTROLLER_SECRET_KEY, CONTROLLER_WEBSOCKET_PATH } from "../ProxyApi.shared.ts";

const encoder = new TextEncoder();

export class ProxyError extends Error {
  readonly _tag = "ProxyError";
  readonly hint: string | undefined;
  readonly status: number;
  readonly retryable: boolean;

  constructor(props: {
    message: string;
    hint?: string;
    retryable?: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(props.message, { cause: props.cause });
    this.hint = props.hint;
    this.status = props.status ?? 500;
    this.retryable = props.retryable ?? false;
  }

  toJSON() {
    return {
      _tag: this._tag,
      message: this.message,
      hint: this.hint,
      cause: this.cause ? serializeError(this.cause) : undefined,
    };
  }

  toResponse(): Response {
    return Response.json(
      {
        ok: false,
        error: this.toJSON(),
      },
      { status: this.status, headers: this.retryable ? { "retry-after": "0" } : undefined },
    );
  }

  static fromUnknown(error: unknown): ProxyError {
    if (error instanceof ProxyError) {
      return error;
    }
    if (error instanceof Error && "_tag" in error && error._tag === "ProxyError") {
      return Object.setPrototypeOf(error, ProxyError.prototype) as ProxyError;
    }
    return new ProxyError({
      message: "An unknown error occurred",
      cause: error,
    });
  }
}

export const isProxyControllerRequest = (
  request: Request,
  env: { PROXY_SECRET: string },
): boolean => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === CONTROLLER_WEBSOCKET_PATH) {
    const secret = url.searchParams.get(CONTROLLER_SECRET_KEY);
    if (
      !secret ||
      secret.length !== env.PROXY_SECRET.length ||
      !crypto.subtle.timingSafeEqual(encoder.encode(secret), encoder.encode(env.PROXY_SECRET))
    ) {
      throw new ProxyError({
        message: "Proxy authorization failed",
        hint: `The "${CONTROLLER_SECRET_KEY}" query parameter is missing or incorrect.`,
        status: 401,
      });
    }
    return true;
  }
  return false;
};

interface SerializedError {
  message?: string;
  name?: string;
  stack?: string;
  cause?: SerializedError;
  [key: string]: unknown;
}

const serializeError = (e: any): SerializedError => {
  const error: SerializedError = {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === undefined ? undefined : serializeError(e.cause),
  };
  for (const [key, value] of Object.entries(e)) {
    error[key] = value;
  }
  return error;
};
