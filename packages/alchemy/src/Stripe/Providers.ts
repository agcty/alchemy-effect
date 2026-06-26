import * as Layer from "effect/Layer";
import { CredentialsStoreLive } from "../Auth/Credentials.ts";
import { ProfileLive } from "../Auth/Profile.ts";
import * as Provider from "../Provider.ts";
import { StripeAuth } from "./AuthProvider.ts";
import { StripeClientLive } from "./Client.ts";
import * as Credentials from "./Credentials.ts";
import { Feature, FeatureProvider } from "./Feature.ts";
import { Price, PriceProvider } from "./Price.ts";
import { Product, ProductProvider } from "./Product.ts";
import { ProductFeature, ProductFeatureProvider } from "./ProductFeature.ts";
import { WebhookEndpoint, WebhookEndpointProvider } from "./WebhookEndpoint.ts";

export { Credentials } from "@distilled.cloud/stripe/Credentials";

export class Providers extends Provider.ProviderCollection<Providers>()(
  "Stripe",
) {}

export type ProviderRequirements = Layer.Services<ReturnType<typeof providers>>;

/**
 * Stripe providers and credentials. Wires catalog and webhook resources to
 * the generated Distilled Stripe REST client and registers the AuthProvider so
 * `alchemy login` can configure stored credentials.
 */
export const providers = () =>
  Layer.effect(
    Providers,
    Provider.collection([
      Feature,
      Price,
      Product,
      ProductFeature,
      WebhookEndpoint,
    ]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        FeatureProvider(),
        PriceProvider(),
        ProductProvider(),
        ProductFeatureProvider(),
        WebhookEndpointProvider(),
      ),
    ),
    Layer.provideMerge(StripeClientLive),
    Layer.provideMerge(Credentials.fromAuthProvider()),
    Layer.provideMerge(StripeAuth),
    Layer.provideMerge(ProfileLive),
    Layer.provideMerge(CredentialsStoreLive),
    Layer.orDie,
  );
