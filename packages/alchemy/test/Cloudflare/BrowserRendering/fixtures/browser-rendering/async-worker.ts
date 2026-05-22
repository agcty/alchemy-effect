import type { AsyncWorkerEnv } from "./stack.ts";

export default {
  async fetch(_request: Request, env: AsyncWorkerEnv): Promise<Response> {
    return Response.json({
      mode: "async",
      bound: typeof env.BROWSER.fetch === "function",
    });
  },
};
