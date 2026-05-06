import * as Effect from "effect/Effect";
import * as HyperdriveBindingWorker from "worker:./hyperdrive-binding.worker.ts";
import type { Plugin } from "../Plugin.ts";

export const HyperdrivePlugin: Plugin = {
  name: "hyperdrive",
  make: (worker) =>
    Effect.sync(() => {
      const bindings = worker.bindings.filter((binding) => binding.type === "hyperdrive");
      if (bindings.length === 0) return {};
      return {
        bindings: bindings.map((binding) => {
          const origin = worker.hyperdrives?.[binding.id];
          if (!origin) throw new Error(`Hyperdrive binding ${binding.id} not found`);
          return {
            name: binding.name,
            wrapped: {
              moduleName: "cloudflare-runtime:hyperdrive",
              innerBindings: [{ name: "ORIGIN", json: JSON.stringify(origin) }],
            },
          };
        }),
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
