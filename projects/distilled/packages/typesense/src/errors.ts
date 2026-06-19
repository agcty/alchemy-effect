/**
 * Typesense-specific error types.
 *
 * Re-exports common HTTP errors from sdk-core and adds Typesense-specific
 * error matching and API error types.
 */
export {
  BadGateway,
  BadRequest,
  Conflict,
  ConfigError,
  Forbidden,
  GatewayTimeout,
  InternalServerError,
  Locked,
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

// Unknown Typesense error - returned when an error code is not recognized
export class UnknownTypesenseError extends Schema.TaggedErrorClass<UnknownTypesenseError>()(
  "UnknownTypesenseError",
  {
    code: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
    body: Schema.Unknown,
  },
).pipe(Category.withServerError) {}

// Schema parse error wrapper
export class TypesenseParseError extends Schema.TaggedErrorClass<TypesenseParseError>()(
  "TypesenseParseError",
  {
    body: Schema.Unknown,
    cause: Schema.Unknown,
  },
).pipe(Category.withParseError) {}
