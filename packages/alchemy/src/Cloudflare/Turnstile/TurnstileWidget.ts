import * as turnstile from "@distilled.cloud/cloudflare/turnstile";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { deepEqual, isResolved } from "../../Diff.ts";
import { createPhysicalName } from "../../PhysicalName.ts";
import * as Provider from "../../Provider.ts";
import { Resource } from "../../Resource.ts";
import { CloudflareEnvironment } from "../CloudflareEnvironment.ts";
import type { Providers } from "../Providers.ts";

export type TurnstileWidgetMode = turnstile.CreateWidgetRequest["mode"];
export type TurnstileWidgetClearanceLevel =
  turnstile.CreateWidgetRequest["clearanceLevel"];
export type TurnstileWidgetRegion = turnstile.CreateWidgetRequest["region"];

export interface TurnstileWidgetProps {
  /**
   * Existing widget sitekey to manage. Omit this to create a new widget.
   *
   * Cloudflare generates sitekeys and widget names are not unique, so Alchemy
   * can only recover a widget after state loss when this is supplied.
   */
  sitekey?: string;
  /**
   * Human-readable widget name.
   * @default ${app}-${stage}-${id}
   */
  name?: string;
  /**
   * Hostnames allowed to use this widget.
   */
  domains: string[];
  /**
   * Widget mode.
   * @default "managed"
   */
  mode?: TurnstileWidgetMode;
  /**
   * Whether Cloudflare issues computationally expensive challenges to
   * malicious bots. Enterprise-only.
   * @default false
   */
  botFightMode?: boolean;
  /**
   * Clearance level granted when the widget is embedded on a Cloudflare site.
   * @default "no_clearance"
   */
  clearanceLevel?: TurnstileWidgetClearanceLevel;
  /**
   * Whether the widget returns the Ephemeral ID in `/siteverify`.
   * Enterprise-only.
   * @default false
   */
  ephemeralId?: boolean;
  /**
   * Whether to hide Cloudflare branding on the widget. Enterprise-only.
   * @default false
   */
  offlabel?: boolean;
  /**
   * Region where this widget can be used. Cloudflare does not allow changing
   * the region after creation.
   * @default "world"
   */
  region?: TurnstileWidgetRegion;
  /**
   * Cloudflare account id. Defaults to the configured Cloudflare account.
   */
  accountId?: string;
}

export type TurnstileWidget = Resource<
  "Cloudflare.TurnstileWidget",
  TurnstileWidgetProps,
  {
    /**
     * Widget sitekey.
     */
    sitekey: string;
    /**
     * Human-readable widget name.
     */
    name: string;
    /**
     * Widget secret key.
     */
    secret: Redacted.Redacted<string>;
    /**
     * Hostnames allowed to use this widget.
     */
    domains: string[];
    /**
     * Widget mode.
     */
    mode: TurnstileWidgetMode;
    /**
     * Whether Bot Fight Mode is enabled for the widget.
     */
    botFightMode: boolean;
    /**
     * Clearance level granted by the widget.
     */
    clearanceLevel: NonNullable<TurnstileWidgetClearanceLevel>;
    /**
     * Whether the widget returns the Ephemeral ID in `/siteverify`.
     */
    ephemeralId: boolean;
    /**
     * Whether Cloudflare branding is hidden on the widget.
     */
    offlabel: boolean;
    /**
     * Widget region.
     */
    region: NonNullable<TurnstileWidgetRegion>;
    /**
     * Creation timestamp.
     */
    createdOn: string;
    /**
     * Last modification timestamp.
     */
    modifiedOn: string;
    /**
     * Cloudflare account id that owns the widget.
     */
    accountId: string;
  },
  never,
  Providers
>;

/**
 * A Cloudflare Turnstile widget.
 *
 * Turnstile widgets protect forms and other flows from automated abuse.
 * Cloudflare generates the public sitekey and secret key when a widget is
 * created; Alchemy stores both as resource attributes.
 *
 * Widget names are not unique in Cloudflare. If local state is lost, pass an
 * existing `sitekey` to manage that widget explicitly.
 *
 * @section Creating Widgets
 * @example Managed widget for one domain
 * ```typescript
 * const widget = yield* Cloudflare.TurnstileWidget("SignupChallenge", {
 *   name: "signup",
 *   domains: ["example.com"],
 * });
 * ```
 *
 * @section Existing Widgets
 * @example Manage an existing widget
 * ```typescript
 * const widget = yield* Cloudflare.TurnstileWidget("ExistingChallenge", {
 *   sitekey: "0x4AAAAAA...",
 *   name: "signup",
 *   domains: ["example.com"],
 * });
 * ```
 */
export const TurnstileWidget = Resource<TurnstileWidget>(
  "Cloudflare.TurnstileWidget",
);

type WidgetResponse =
  | turnstile.CreateWidgetResponse
  | turnstile.GetWidgetResponse
  | turnstile.UpdateWidgetResponse;

const DEFAULT_MODE: TurnstileWidgetMode = "managed";
const DEFAULT_CLEARANCE_LEVEL: NonNullable<TurnstileWidgetClearanceLevel> =
  "no_clearance";
const DEFAULT_REGION: NonNullable<TurnstileWidgetRegion> = "world";

const resolveName = (id: string, name: string | undefined) =>
  Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id }));
  });

const desiredConfig = (props: TurnstileWidgetProps, name: string) => ({
  name,
  domains: props.domains,
  mode: props.mode ?? DEFAULT_MODE,
  botFightMode: props.botFightMode ?? false,
  clearanceLevel: props.clearanceLevel ?? DEFAULT_CLEARANCE_LEVEL,
  ephemeralId: props.ephemeralId ?? false,
  offlabel: props.offlabel ?? false,
  region: props.region ?? DEFAULT_REGION,
});

type MutableWidgetConfig = {
  name: string;
  domains: string[];
  mode: TurnstileWidgetMode;
  botFightMode: boolean;
  clearanceLevel: NonNullable<TurnstileWidgetClearanceLevel>;
  ephemeralId: boolean;
  offlabel: boolean;
};

const mutableConfig = (widget: MutableWidgetConfig) => ({
  name: widget.name,
  domains: [...widget.domains].sort(),
  mode: widget.mode,
  botFightMode: widget.botFightMode,
  clearanceLevel: widget.clearanceLevel,
  ephemeralId: widget.ephemeralId,
  offlabel: widget.offlabel,
});

const toAttributes = (
  accountId: string,
  widget: WidgetResponse,
): TurnstileWidget["Attributes"] => ({
  sitekey: widget.sitekey,
  name: widget.name,
  secret: Redacted.make(widget.secret),
  domains: widget.domains,
  mode: widget.mode,
  botFightMode: widget.botFightMode,
  clearanceLevel: widget.clearanceLevel,
  ephemeralId: widget.ephemeralId,
  offlabel: widget.offlabel,
  region: widget.region,
  createdOn: widget.createdOn,
  modifiedOn: widget.modifiedOn,
  accountId,
});

export const TurnstileWidgetProvider = () =>
  Provider.effect(
    TurnstileWidget,
    Effect.gen(function* () {
      const { accountId: defaultAccountId } = yield* CloudflareEnvironment;
      const createWidget = yield* turnstile.createWidget;
      const getWidget = yield* turnstile.getWidget;
      const updateWidget = yield* turnstile.updateWidget;
      const deleteWidget = yield* turnstile.deleteWidget;

      const observeBySitekey = (accountId: string, sitekey: string) =>
        getWidget({ accountId, sitekey }).pipe(
          Effect.map((widget) => toAttributes(accountId, widget)),
          Effect.catchIf(isMissingTurnstileWidget, () =>
            Effect.succeed(undefined),
          ),
        );

      return {
        stables: ["sitekey", "accountId"],
        diff: Effect.fn(function* ({ id, olds, news, output }) {
          if (!isResolved(news)) return undefined;
          if (!olds && !output) return undefined;

          const newAccountId = news.accountId ?? defaultAccountId;
          const oldAccountId =
            output?.accountId ?? olds?.accountId ?? defaultAccountId;
          if (oldAccountId !== newAccountId) {
            return { action: "replace" } as const;
          }

          // `sitekey` is generated by Cloudflare. Only compare explicit props
          // here so removing `sitekey` switches from managing an existing
          // widget to creating a replacement instead of reusing output.sitekey.
          if (olds && olds.sitekey !== news.sitekey) {
            return { action: "replace" } as const;
          }

          if (
            !olds &&
            output &&
            news.sitekey &&
            output.sitekey !== news.sitekey
          ) {
            return { action: "replace" } as const;
          }

          const oldRegion = output?.region ?? olds?.region ?? DEFAULT_REGION;
          const newRegion = news.region ?? DEFAULT_REGION;
          if (oldRegion !== newRegion) {
            return { action: "replace" } as const;
          }

          const name = yield* resolveName(id, news.name);
          const next = desiredConfig(news, name);
          const previous =
            output ??
            (olds
              ? {
                  ...next,
                  ...desiredConfig(olds, yield* resolveName(id, olds.name)),
                }
              : undefined);

          if (
            previous &&
            !deepEqual(
              mutableConfig(previous),
              mutableConfig({ ...previous, ...next }),
            )
          ) {
            return { action: "update" } as const;
          }
        }),
        reconcile: Effect.fn(function* ({ id, news, output }) {
          const accountId =
            news.accountId ?? output?.accountId ?? defaultAccountId;
          const name = yield* resolveName(id, news.name);
          const desired = desiredConfig(news, name);
          const sitekey = news.sitekey ?? output?.sitekey;
          const observed = sitekey
            ? yield* observeBySitekey(accountId, sitekey)
            : undefined;

          if (!observed) {
            if (news.sitekey) {
              return yield* Effect.fail(
                new Error(
                  `Cloudflare Turnstile widget "${news.sitekey}" was not found. Omit sitekey to create a new widget.`,
                ),
              );
            }

            return toAttributes(
              accountId,
              yield* createWidget({
                accountId,
                ...desired,
              }),
            );
          }

          if (
            deepEqual(
              mutableConfig(observed),
              mutableConfig({ ...observed, ...desired }),
            )
          ) {
            return observed;
          }

          return toAttributes(
            accountId,
            yield* updateWidget({
              accountId,
              sitekey: observed.sitekey,
              ...desired,
            }),
          );
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* deleteWidget({
            accountId: output.accountId,
            sitekey: output.sitekey,
          }).pipe(Effect.catchIf(isMissingTurnstileWidget, () => Effect.void));
        }),
        read: Effect.fn(function* ({ olds, output }) {
          const accountId =
            output?.accountId ?? olds?.accountId ?? defaultAccountId;
          const sitekey = output?.sitekey ?? olds?.sitekey;
          if (!sitekey) return undefined;
          return yield* observeBySitekey(accountId, sitekey);
        }),
      };
    }),
  );

const isMissingTurnstileWidget = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("_tag" in error && (error as { _tag: unknown })._tag === "NotFound") ||
    ("_tag" in error &&
      (error as { _tag: unknown })._tag === "CloudflareHttpError" &&
      "status" in error &&
      (error as { status: unknown }).status === 404));
