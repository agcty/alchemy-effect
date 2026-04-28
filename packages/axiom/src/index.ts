/**
 * Axiom SDK for Effect
 *
 * The package root re-exports the v2 (control-plane) operations. The v1 edge
 * APIs are available under their own subpath imports:
 *
 * @example
 * \`\`\`ts
 * import * as Operations from "@distilled.cloud/axiom";
 * import * as EdgeIngest from "@distilled.cloud/axiom/edge-ingest";
 * import * as EdgeQuery from "@distilled.cloud/axiom/edge-query";
 * \`\`\`
 */
export * from "./credentials.ts";
export * as Category from "./category.ts";
export * as T from "./traits.ts";
export * as Retry from "./retry.ts";
export { API } from "./client.ts";
export * from "./errors.ts";
export { SensitiveString, SensitiveNullableString } from "./sensitive.ts";
export * from "./operations/index.ts";
