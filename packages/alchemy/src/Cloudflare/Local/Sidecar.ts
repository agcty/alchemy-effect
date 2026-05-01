import {
  ServeError,
  type ServeResult,
} from "@distilled.cloud/cloudflare-runtime/Server";
import * as Worker from "@distilled.cloud/cloudflare-runtime/Worker";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { BundleError } from "../../Bundle/Bundle.ts";
import * as RpcClient from "../../Sidecar/RpcClient.ts";
import { defineSchema } from "../../Sidecar/RpcHandler.ts";
import type { WorkerBinding } from "../Workers/Worker.ts";
import type { WorkerBundleOptions } from "../Workers/WorkerBundle.ts";

export interface ServeOptions extends WorkerBundleOptions {
  name: string;
  bindings: WorkerBinding[];
  durableObjectNamespaces: Worker.DurableObjectNamespace[];
}

export const SidecarSchema = defineSchema<Sidecar["Service"]>({
  serve: {
    success: Schema.Struct({
      name: Schema.String,
      address: Schema.String,
    }),
    error: Schema.Union([ServeError, BundleError]),
  },
  stop: { success: Schema.Void, error: Schema.Never },
});

export class Sidecar extends RpcClient.RpcClientService<
  Sidecar,
  {
    readonly serve: (
      options: ServeOptions,
    ) => Effect.Effect<ServeResult, ServeError | BundleError>;
    readonly stop: (name: string) => Effect.Effect<void>;
  }
>()("Sidecar") {}

// Resolve via the package name rather than `./SidecarServer.ts` so the path
// stays correct after this module is inlined into `bin/alchemy.js` by tsdown.
// A relative `import.meta.resolve` would resolve against the bundle's
// location (`bin/`) instead of the original Sidecar.ts source location.
// See PR #128 for the same pattern applied to bin/exec.ts.
export const SidecarLive = RpcClient.layer(Sidecar, {
  main: import.meta.resolve("alchemy/Cloudflare/Local/SidecarServer.ts"),
  schema: SidecarSchema,
});
