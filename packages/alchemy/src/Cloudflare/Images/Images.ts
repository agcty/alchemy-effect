import * as Effect from "effect/Effect";
import { ImagesBinding } from "./ImagesBinding.ts";

type ImagesTypeId = typeof ImagesTypeId;
const ImagesTypeId = "Cloudflare.Images" as const;

export type ImagesProps = {
  /**
   * Binding name used when `Cloudflare.Images.bind(images)` attaches Images
   * from inside a Worker init phase. When Images is passed through
   * `Worker({ bindings: { ... } })`, the object key remains the binding name.
   *
   * @default "IMAGES"
   */
  name?: string;
};

/**
 * Marker for a Cloudflare Images binding.
 *
 * Images bindings are configured directly on Workers and do not have a
 * standalone provisioning API. The Worker provider sees this object in
 * `bindings: { ... }` and emits the corresponding `{ type: "images" }`
 * metadata binding to the script.
 */
export type Images = {
  kind: ImagesTypeId;
  name: string;
};

export const isImages = (value: unknown): value is Images =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value as Images).kind === ImagesTypeId;

/**
 * A Cloudflare Images binding for image transformation and manipulation inside
 * Workers.
 *
 * @section Declaring Images
 * @example
 * ```typescript
 * const Images = yield* Cloudflare.Images();
 * ```
 *
 * @section Binding to a Worker
 * @example
 * ```typescript
 * export const Worker = Cloudflare.Worker("Worker", {
 *   main: "./src/worker.ts",
 *   bindings: { Images },
 * });
 *
 * export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;
 * //   { Images: ImagesBinding }
 * ```
 *
 * @section Effect-style Worker
 * @example
 * ```typescript
 * const images = yield* Cloudflare.Images.bind(Images);
 * ```
 *
 * @see https://developers.cloudflare.com/images/transform-images/bindings/
 */
export const Images: {
  (props?: ImagesProps): Effect.Effect<Images>;
  /**
   * Bind Cloudflare Images to the surrounding Worker, returning an
   * Effect-native client with access to the native Workers runtime binding.
   */
  bind: typeof ImagesBinding.bind;
} = Object.assign(
  Effect.fn(function* (props?: ImagesProps) {
    return {
      kind: ImagesTypeId,
      name: props?.name ?? "IMAGES",
    } satisfies Images;
  }),
  {
    bind: (...args: Parameters<typeof ImagesBinding.bind>) =>
      ImagesBinding.bind(...args),
  },
);
