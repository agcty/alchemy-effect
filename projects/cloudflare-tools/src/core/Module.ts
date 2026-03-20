import * as Schema from "effect/Schema";

export const ModuleType = Schema.Literals([
  "ESModule",
  "CommonJS",
  "Text",
  "Data",
  "CompiledWasm",
  "PythonModule",
  "PythonRequirement",
  "SourceMap",
]);
export type ModuleType = typeof ModuleType.Type;

export class Module extends Schema.Class<Module>("distilled-core/Module")({
  name: Schema.String,
  content: Schema.Uint8Array,
  hash: Schema.String,
  type: ModuleType,
}) {}

// Note: The following is a mapping of we support.
// The full list is: application/javascript+module, text/javascript+module, application/javascript, text/javascript, text/x-python, text/x-python-requirement, application/wasm, text/plain, application/octet-stream, application/source-map.
export const MODULE_TYPE_TO_CONTENT_TYPE: Record<ModuleType, string> = {
  ESModule: "application/javascript+module",
  CommonJS: "application/javascript",
  CompiledWasm: "application/wasm",
  Text: "text/plain",
  Data: "application/octet-stream",
  SourceMap: "application/source-map",
  PythonModule: "text/x-python",
  PythonRequirement: "text/x-python-requirement",
};
