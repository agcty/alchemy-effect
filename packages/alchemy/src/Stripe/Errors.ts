import * as Data from "effect/Data";

export class FeatureNotFoundError extends Data.TaggedError(
  "FeatureNotFoundError",
)<{
  readonly feature: string;
  readonly message: string;
}> {}

export class InactiveFeatureError extends Data.TaggedError(
  "InactiveFeatureError",
)<{
  readonly featureId: string;
  readonly message: string;
}> {}

export class InactiveFeatureAttachmentError extends Data.TaggedError(
  "InactiveFeatureAttachmentError",
)<{
  readonly featureId: string;
  readonly message: string;
}> {}

export class ProductReplacementBlockedError extends Data.TaggedError(
  "ProductReplacementBlockedError",
)<{
  readonly productId: string;
  readonly message: string;
}> {}

export class ResourceNotOwnedError extends Data.TaggedError(
  "ResourceNotOwnedError",
)<{
  readonly resourceType: string;
  readonly resourceId: string;
  readonly message: string;
}> {}
