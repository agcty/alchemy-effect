import * as Schema from "effect/Schema";

export class ProcessAlreadyExistsError extends Schema.TaggedErrorClass<ProcessAlreadyExistsError>()(
  "ProcessAlreadyExistsError",
  {
    message: Schema.String,
    id: Schema.String,
  },
) {}

export class ProcessNotFoundError extends Schema.TaggedErrorClass<ProcessNotFoundError>()(
  "ProcessNotFoundError",
  {
    message: Schema.String,
    id: Schema.String,
  },
) {}
