import * as Effect from "effect/Effect";
import * as HyperdriveBindingWorker from "worker:./hyperdrive-binding.worker.ts";
import type { Plugin } from "../Plugin.ts";
import { ConfigError } from "../RuntimeError.shared.ts";

export const HyperdrivePlugin: Plugin<ConfigError> = {
  name: "hyperdrive",
  make: Effect.fn(function* (worker) {
    const bindings = worker.bindings.filter((binding) => binding.type === "hyperdrive");
    if (bindings.length === 0) return {};
    const resolvedBindings = yield* Effect.forEach(bindings, (binding) => {
      const origin = worker.hyperdrives?.[binding.id];
      if (!origin) {
        return Effect.fail(
          new ConfigError({
            subtag: "HyperdriveOriginMissing",
            message: `No hyperdrive origin was provided for binding "${binding.name}" (id: ${binding.id}).`,
            hint: `Add an entry for "${binding.id}" to \`worker.hyperdrives\`.`,
            detail: { bindingName: binding.name, hyperdriveId: binding.id },
          }),
        );
      }
      return Effect.succeed({
        name: binding.name,
        wrapped: {
          moduleName: "cloudflare-runtime:hyperdrive",
          innerBindings: [{ name: "ORIGIN", json: JSON.stringify(origin) }],
        },
      });
    });
    return {
      bindings: resolvedBindings,
      extensions: [
        {
          modules: [
            {
              name: "cloudflare-runtime:hyperdrive",
              internal: true,
              esModule: HyperdriveBindingWorker.modules[0].content as string,
            },
          ],
        },
      ],
    };
  }),
};
