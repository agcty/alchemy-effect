import * as Cloudflare from "@/Cloudflare";
import { inMemoryState } from "@/State";
import * as Stack from "@/Stack";
import { Stage } from "@/Stage";
import * as Test from "@/Test/Vitest";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const { test } = Test.make({ providers: Layer.empty });

const compileStackWithProviders =
  (providers: Layer.Layer<any, never, any>) =>
  <A, Err = never>(
    effect: Effect.Effect<A, Err, any>,
  ): Effect.Effect<Stack.CompiledStack<A>, Err> =>
    // @ts-expect-error - Stack.make's typing erases R unsoundly here
    effect.pipe(
      Stack.make({
        name: "test",
        providers,
        state: inMemoryState(),
      }),
      Effect.provideService(Stage, "test"),
    );

const emptyProviders = Layer.empty as unknown as Layer.Layer<any, never, any>;

const compileStack = compileStackWithProviders(emptyProviders);

const compileStackWithImagesBinding = compileStackWithProviders(
  Cloudflare.ImagesBindingPolicyLive,
);

const provideImagesBinding = <A, Err, Req>(
  effect: Effect.Effect<A, Err, Req>,
) =>
  effect.pipe(
    Effect.provide(
      Layer.mergeAll(
        Cloudflare.ImagesBindingLive,
        Cloudflare.ImagesBindingPolicyLive,
      ),
    ),
  );

test(
  "worker bindings emit Cloudflare Images metadata",
  Effect.gen(function* () {
    const stack = yield* Effect.gen(function* () {
      yield* Cloudflare.Worker("ImageWorker", {
        main: "./worker.ts",
        bindings: {
          MEDIA: Cloudflare.Images({ name: "IGNORED_BY_DIRECT_BINDING" }),
        },
      });
    }).pipe(compileStack);

    expect(stack.bindings.ImageWorker).toEqual([
      {
        sid: "MEDIA",
        data: {
          bindings: [
            {
              type: "images",
              name: "MEDIA",
            },
          ],
        },
      },
    ]);
  }),
);

test(
  "init-phase binding emits Cloudflare Images metadata",
  Effect.gen(function* () {
    const stack = yield* Effect.gen(function* () {
      const images = yield* Cloudflare.Images({ name: "IMAGE_PIPELINE" });

      yield* Cloudflare.Worker(
        "ImageWorker",
        {
          main: "./worker.ts",
        },
        Effect.gen(function* () {
          yield* Cloudflare.Images.bind(images);
        }).pipe(provideImagesBinding),
      );
    }).pipe(compileStackWithImagesBinding);

    expect(stack.bindings.ImageWorker).toEqual([
      {
        sid: "IMAGE_PIPELINE",
        data: {
          bindings: [
            {
              type: "images",
              name: "IMAGE_PIPELINE",
            },
          ],
        },
      },
    ]);
  }),
);
