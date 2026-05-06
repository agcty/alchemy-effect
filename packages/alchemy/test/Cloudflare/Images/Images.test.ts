import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
import * as workers from "@distilled.cloud/cloudflare/workers";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as pathe from "pathe";

const { test } = Test.make({ providers: Cloudflare.providers() });
const main = pathe.resolve(import.meta.dirname, "../Workers/worker.ts");

test.provider("worker bindings emit Cloudflare Images metadata", (stack) =>
  Effect.gen(function* () {
    const { accountId } = yield* CloudflareEnvironment;

    yield* stack.destroy();

    const worker = yield* stack.deploy(
      Effect.gen(function* () {
        return yield* Cloudflare.Worker("ImageWorker", {
          main,
          bindings: {
            MEDIA: Cloudflare.Images({ name: "IGNORED_BY_DIRECT_BINDING" }),
          },
        });
      }),
    );

    const settings = yield* workers.getScriptScriptAndVersionSetting({
      accountId,
      scriptName: worker.workerName,
    });
    expect(settings.bindings).toEqual(
      expect.arrayContaining([
        {
          type: "images",
          name: "MEDIA",
        },
      ]),
    );

    yield* stack.destroy();
  }),
);

test.provider("init-phase binding emits Cloudflare Images metadata", (stack) =>
  Effect.gen(function* () {
    const { accountId } = yield* CloudflareEnvironment;

    yield* stack.destroy();

    const worker = yield* stack.deploy(
      Effect.gen(function* () {
        const images = yield* Cloudflare.Images({ name: "IMAGE_PIPELINE" });

        return yield* Cloudflare.Worker(
          "ImageWorker",
          {
            main,
          },
          Effect.gen(function* () {
            yield* Cloudflare.Images.bind(images);
          }).pipe(Effect.provide(Cloudflare.ImagesBindingLive)),
        );
      }),
    );

    const settings = yield* workers.getScriptScriptAndVersionSetting({
      accountId,
      scriptName: worker.workerName,
    });
    expect(settings.bindings).toEqual(
      expect.arrayContaining([
        {
          type: "images",
          name: "IMAGE_PIPELINE",
        },
      ]),
    );

    yield* stack.destroy();
  }),
);
