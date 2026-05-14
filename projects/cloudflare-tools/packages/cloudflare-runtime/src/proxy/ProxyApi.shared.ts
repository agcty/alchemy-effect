export const CONTROLLER_WEBSOCKET_PATH = "/__distilled/proxy/websocket";
export const CONTROLLER_SECRET_KEY = "distilled-proxy-secret";

export interface ProxyController {
  readonly listWorkers: () => Array<string>;
  readonly registerWorker: (workerName: string) => void;
  readonly unregisterWorker: (workerName: string) => void;
  readonly setLocalAddress: (workerName: string, address: string) => void;
  readonly unsetLocalAddress: (workerName: string, address: string) => void;
  readonly setRemoteAddress: (workerName: string, address: string) => Promise<void>;
  readonly unsetRemoteAddress: (workerName: string) => void;
}

export interface WebSocketProxy {
  readonly webSocketMessage: (id: string, message: string | ArrayBuffer) => Promise<void>;
  readonly webSocketClose: (
    id: string,
    code: number,
    reason: string,
    wasClean: boolean,
  ) => Promise<void>;
  readonly webSocketError: (id: string, error: unknown) => Promise<void>;
}

export interface WorkerProxy extends WebSocketProxy {
  readonly fetch: (request: Request) => Promise<WorkerProxy.FetchResult>;
}

export declare namespace WorkerProxy {
  interface FetchResponse {
    readonly _tag: "Response";
    readonly response: Response;
  }
  interface FetchUpgradeResponse {
    readonly _tag: "Upgrade";
    readonly status: number;
    readonly headers: Headers;
    readonly id: string;
  }
  type FetchResult = FetchResponse | FetchUpgradeResponse;
}
