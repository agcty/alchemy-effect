import * as Context from "effect/Context";

/**
 * Namespace-qualified resource identifier for the lifecycle operation currently
 * being evaluated.
 */
export class ResourceFqn extends Context.Service<ResourceFqn, string>()(
  "resource-fqn",
) {}
