import type { KV } from "cloudflare/resources";
import * as Effect from "effect/Effect";

import { Binding } from "../../internal/Binding.ts";
import type { Capability, To } from "../../internal/Capability.ts";
import { createPhysicalName } from "../../internal/createPhysicalName.ts";
import { Resource, type ResourceEffect } from "../../Resource.ts";
import { Account } from "../Account.ts";
import { CloudflareApi } from "../CloudflareApi.ts";
import { Worker } from "../Worker/worker.ts";

export type NamespaceProps = {
  title?: string;
};

export type NamespaceAttr<Props extends NamespaceProps> = {
  title: Props["title"] extends string ? Props["title"] : string;
  namespaceId: string;
  supportsUrlEncoding?: boolean;
  accountId: string;
};

export interface Namespace<
  ID extends string = string,
  Props extends NamespaceProps = NamespaceProps,
> extends Resource<
  Namespace,
  "Cloudflare.KV.Namespace",
  ID,
  Props,
  NamespaceAttr<Props>,
  Namespace
> {}

export const Namespace = Resource<{
  <const ID extends string, const Props extends NamespaceProps>(
    id: ID,
    props?: Props,
  ): ResourceEffect<Namespace<ID, Props>>;
}>("Cloudflare.KV.Namespace");

export const namespaceProvider = () =>
  Namespace.provider.effect(
    Effect.gen(function* () {
      const api = yield* CloudflareApi;
      const accountId = yield* Account;

      const createTitle = (id: string, title: string | undefined) =>
        Effect.gen(function* () {
          return title ?? (yield* createPhysicalName({ id }));
        });

      const mapResult = <Props extends NamespaceProps>(
        result: KV.Namespace,
      ): NamespaceAttr<Props> => ({
        title: result.title,
        namespaceId: result.id,
        supportsUrlEncoding: result.supports_url_encoding,
        accountId,
      });

      return {
        stables: ["namespaceId", "accountId"],
        diff: Effect.fn(function* ({ id, news, output }) {
          if (output.accountId !== accountId) {
            return { action: "replace" };
          }
          const title = yield* createTitle(id, news.title);
          if (title !== output.title) {
            return { action: "update" };
          }
        }),
        create: Effect.fn(function* ({ id, news }) {
          const title = yield* createTitle(id, news.title);
          return yield* api.kv.namespaces
            .create({
              account_id: accountId,
              title,
            })
            .pipe(Effect.map(mapResult<NamespaceProps>));
        }),
        update: Effect.fn(function* ({ id, news, output }) {
          const title = yield* createTitle(id, news.title);
          return yield* api.kv.namespaces
            .update(output.namespaceId, {
              account_id: accountId,
              title,
            })
            .pipe(Effect.map(mapResult<NamespaceProps>));
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* api.kv.namespaces
            .delete(output.namespaceId, {
              account_id: output.accountId,
            })
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
          if (output?.namespaceId) {
            return yield* api.kv.namespaces
              .get(output.namespaceId, {
                account_id: output.accountId,
              })
              .pipe(
                Effect.map(mapResult<NamespaceProps>),
                Effect.catchTag("NotFound", () => Effect.succeed(undefined)),
              );
          }
          const title = yield* createTitle(id, olds?.title); // why is olds optional? because read can be called before the resource exists (sync)
          let page = 1;
          while (true) {
            // todo: abstract pagination
            const namespaces = yield* api.kv.namespaces.list({
              account_id: accountId,
              page,
              per_page: 100,
            });
            const match = namespaces.result.find(
              (namespace) => namespace.title === title,
            );
            if (match) {
              return mapResult<NamespaceProps>(match);
            }
            if (namespaces.nextPageInfo()) {
              page++;
            } else {
              return undefined;
            }
          }
        }),
      };
    }),
  );

export interface Bind<B = Namespace<string, NamespaceProps>> extends Capability<
  "Cloudflare.KV.Namespace.Bind",
  B
> {}

export const Bind = Binding<
  <B extends Namespace<string, NamespaceProps>>(
    namespace: B,
  ) => Binding<Worker, Bind<To<B>>>
>(Worker, "Cloudflare.KV.Namespace.Bind");

export const bindFromWorker = () =>
  Bind.provider.succeed({
    attach: ({ source }) => ({
      bindings: [
        {
          type: "kv_namespace",
          name: source.id,
          namespace_id: source.attr.namespaceId,
        },
      ],
    }),
  });
