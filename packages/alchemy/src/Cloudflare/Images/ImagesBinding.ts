/// <reference types="@cloudflare/workers-types" />

import type * as cf from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.ts";
import type { ResourceLike } from "../../Resource.ts";
import { isWorker, WorkerEnvironment } from "../Workers/Worker.ts";
import { type Images as ImagesLike } from "./Images.ts";

export interface ImagesClient {
  raw: Effect.Effect<cf.ImagesBinding, never, WorkerEnvironment>;
}

export class ImagesBinding extends Binding.Service<
  ImagesBinding,
  (images: ImagesLike) => Effect.Effect<ImagesClient>
>()("Cloudflare.Images.Binding") {}

export const ImagesBindingLive = Layer.effect(
  ImagesBinding,
  Effect.gen(function* () {
    const Policy = yield* ImagesBindingPolicy;

    return Effect.fn(function* (images: ImagesLike) {
      yield* Policy(images);
      const env = WorkerEnvironment.asEffect();
      return {
        raw: env.pipe(
          Effect.map(
            (env) => (env as Record<string, cf.ImagesBinding>)[images.name]!,
          ),
        ),
      } satisfies ImagesClient;
    });
  }),
);

export class ImagesBindingPolicy extends Binding.Policy<
  ImagesBindingPolicy,
  (images: ImagesLike) => Effect.Effect<void>
>()("Cloudflare.Images.Binding") {}

export const ImagesBindingPolicyLive = ImagesBindingPolicy.layer.succeed(
  Effect.fn(function* (host: ResourceLike, images: ImagesLike) {
    if (isWorker(host)) {
      yield* host.bind(images.name, {
        bindings: [
          {
            type: "images",
            name: images.name,
          },
        ],
      });
    } else {
      return yield* Effect.die(
        new Error(`ImagesBinding does not support runtime '${host.Type}'`),
      );
    }
  }),
);
