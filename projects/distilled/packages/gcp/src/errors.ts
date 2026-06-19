/**
 * GCP-specific error types.
 */
export {
  BadGateway,
  BadRequest,
  Conflict,
  ConfigError,
  Forbidden,
  GatewayTimeout,
  InternalServerError,
  NotFound,
  ServiceUnavailable,
  TooManyRequests,
  Unauthorized,
  UnprocessableEntity,
  HTTP_STATUS_MAP,
  DEFAULT_ERRORS,
  API_ERRORS,
} from "@oddlynew/distilled-core/errors";
export type { DefaultErrors } from "@oddlynew/distilled-core/errors";

import * as Schema from "effect/Schema";
import * as Category from "@oddlynew/distilled-core/category";

// Unknown GCP error - returned when an error code is not recognized
export class UnknownGCPError extends Schema.TaggedErrorClass<UnknownGCPError>()(
  "UnknownGCPError",
  {
    code: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
    status: Schema.optional(Schema.String),
    body: Schema.Unknown,
  },
).pipe(Category.withServerError) {}

// Schema parse error wrapper
export class GCPParseError extends Schema.TaggedErrorClass<GCPParseError>()(
  "GCPParseError",
  {
    body: Schema.Unknown,
    cause: Schema.Unknown,
  },
).pipe(Category.withParseError) {}
