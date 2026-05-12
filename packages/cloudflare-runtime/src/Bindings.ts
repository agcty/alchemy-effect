import * as Effect from "effect/Effect";
import { absurd } from "effect/Function";
import * as RemoteBindings from "./remote-bindings/RemoteBindings.ts";
import type { RemoteBinding } from "./remote-bindings/RemoteWorkerConfig.shared.ts";
import { ConfigError } from "./RuntimeError.shared.ts";
import type * as Worker from "./Worker.ts";
import type * as Config from "./workerd/Config.ts";

export const buildBindings = Effect.fn(function* (bindings: ReadonlyArray<Worker.Binding>) {
  const remoteBindings: Array<RemoteBinding> = [];
  const workerBindings = yield* Effect.forEach(
    bindings,
    Effect.fn(function* (binding): Effect.fn.Return<
      Config.Worker_Binding | undefined,
      ConfigError
    > {
      switch (binding.type) {
        case "ai": {
          remoteBindings.push({
            name: binding.name,
            type: "ai",
            raw: true,
          });
          return {
            name: binding.name,
            wrapped: {
              moduleName: "cloudflare-internal:ai-api",
              innerBindings: [
                {
                  name: "fetcher",
                  service: RemoteBindings.makeServiceDesignator(binding.name),
                },
              ],
            },
          };
        }
        case "analytics_engine":
          return yield* makeUnsupportedBindingError(binding);
        case "artifacts": {
          remoteBindings.push({
            name: binding.name,
            // @ts-expect-error - TODO: add artifacts binding type to distilled.cloud/cloudflare/workers
            type: "artifacts",
            namespace: binding.namespace,
          });
          return {
            name: binding.name,
            service: RemoteBindings.makeServiceDesignator(binding.name),
          };
        }
        case "assets":
          return yield* makeUnsupportedBindingError(binding);
        case "browser":
          return yield* makeUnsupportedBindingError(binding);
        case "d1": {
          remoteBindings.push({
            name: binding.name,
            type: "d1",
            id: binding.id,
            raw: true,
          });
          return {
            name: binding.name,
            wrapped: {
              moduleName: "cloudflare-internal:d1-api",
              innerBindings: [
                {
                  name: "fetcher",
                  service: RemoteBindings.makeServiceDesignator(binding.name),
                },
              ],
            },
          };
        }
        case "data_blob": {
          return {
            name: binding.name,
            data: new TextEncoder().encode(binding.part),
          };
        }
        case "dispatch_namespace":
          return yield* makeUnsupportedBindingError(binding);
        case "durable_object_namespace": {
          if (binding.scriptName) {
            return yield* new ConfigError({
              subtag: "DurableObjectExternalScript",
              message: `Durable Object binding "${binding.name}" references a script other than the current worker, which is not supported.`,
              hint: "Remove the `scriptName` field so the binding refers to the current worker.",
              detail: { binding },
            });
          }
          return {
            name: binding.name,
            durableObjectNamespace: { className: binding.className },
          };
        }
        case "hyperdrive": {
          // handled by Hyperdrive plugin
          return;
        }
        case "images": {
          remoteBindings.push({
            name: binding.name,
            type: "images",
            raw: true,
          });
          return {
            name: binding.name,
            wrapped: {
              moduleName: "cloudflare-internal:images-api",
              innerBindings: [
                {
                  name: "fetcher",
                  service: RemoteBindings.makeServiceDesignator(binding.name),
                },
              ],
            },
          };
        }
        case "inherit":
          return yield* makeUnsupportedBindingError(binding);
        case "json": {
          return {
            name: binding.name,
            json: typeof binding.json === "string" ? binding.json : JSON.stringify(binding.json),
          };
        }
        case "kv_namespace": {
          remoteBindings.push({
            name: binding.name,
            type: "kv_namespace",
            namespaceId: binding.namespaceId,
            raw: true,
          });
          return {
            name: binding.name,
            kvNamespace: RemoteBindings.makeServiceDesignator(binding.name),
          };
        }
        case "mtls_certificate":
          return yield* makeUnsupportedBindingError(binding);
        case "pipelines":
          return yield* makeUnsupportedBindingError(binding);
        case "plain_text": {
          return {
            name: binding.name,
            text: binding.text,
          };
        }
        case "queue": {
          // This makes the whole remote worker fail with 503 errors!
          // remoteBindings.push({
          //   name: binding.name,
          //   type: "queue",
          //   queueName: binding.queueName,
          //   raw: true,
          // });
          // return {
          //   name: binding.name,
          //   queue: makeServiceDesignator(binding.name),
          // };
          return yield* makeUnsupportedBindingError(binding);
        }
        case "ratelimit":
          return yield* makeUnsupportedBindingError(binding);
        case "r2_bucket": {
          remoteBindings.push({
            name: binding.name,
            type: "r2_bucket",
            bucketName: binding.bucketName,
            jurisdiction: binding.jurisdiction,
            raw: true,
          });
          return {
            name: binding.name,
            r2Bucket: RemoteBindings.makeServiceDesignator(binding.name),
          };
        }
        case "secret_key":
          return yield* makeUnsupportedBindingError(binding);
        case "secret_text": {
          return {
            name: binding.name,
            text: binding.text,
          };
        }
        case "secrets_store_secret":
          return yield* makeUnsupportedBindingError(binding);
        case "send_email":
          return yield* makeUnsupportedBindingError(binding);
        case "service": {
          remoteBindings.push({
            name: binding.name,
            type: "service",
            service: binding.service,
            environment: binding.environment,
          });
          return {
            name: binding.name,
            service: RemoteBindings.makeServiceDesignator(binding.name),
          };
        }
        case "text_blob": {
          return {
            name: binding.name,
            data: new TextEncoder().encode(binding.part),
          };
        }
        case "vectorize":
          return yield* makeUnsupportedBindingError(binding);
        case "version_metadata": {
          return {
            name: binding.name,
            json: JSON.stringify({
              id: crypto.randomUUID(),
              tag: "",
              timestamp: "0",
            }),
          };
        }
        case "wasm_module": {
          return {
            name: binding.name,
            wasmModule: new TextEncoder().encode(binding.part),
          };
        }
        case "worker_loader": {
          return {
            name: binding.name,
            workerLoader: {},
          };
        }
        case "workflow": {
          // remoteBindings.push({
          //   name: binding.name,
          //   type: "workflow",
          //   className: binding.className!,
          //   workflowName: binding.workflowName,
          //   scriptName: binding.scriptName,
          //   raw: true,
          // });
          return yield* makeUnsupportedBindingError(binding);
        }
        default:
          return absurd(binding);
      }
    }),
    { concurrency: "unbounded" },
  );
  return {
    remoteBindings,
    workerBindings: workerBindings.filter((b) => b !== undefined),
  };
});

function makeUnsupportedBindingError(binding: Worker.Binding): ConfigError {
  return new ConfigError({
    subtag: "UnsupportedBinding",
    message: `Unsupported binding type "${binding.type}" for binding "${binding.name}".`,
    hint: `Bindings of type "${binding.type}" are not yet supported by cloudflare-runtime.`,
    detail: { binding },
  });
}
