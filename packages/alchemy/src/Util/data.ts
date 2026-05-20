import * as Redacted from "effect/Redacted";

export type Primitive =
  | never
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | symbol;

export const isPrimitive = (value: any): value is Primitive =>
  value === undefined ||
  value === null ||
  typeof value === "boolean" ||
  typeof value === "number" ||
  typeof value === "string" ||
  typeof value === "symbol" ||
  typeof value === "bigint";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

export const stripFields = <T>(value: T, empty: null | undefined): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripFields(item, empty)) as T;
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== empty)
      .map(([key, entry]) => [key, stripFields(entry, empty)]),
  ) as T;
};

export const stripNullFields = <T>(value: T): T => stripFields(value, null);

export const stripUndefinedFields = <T>(value: T): T =>
  stripFields(value, undefined);

export const unwrapRedacted = <T>(value: T): T => {
  if (Redacted.isRedacted(value)) {
    return Redacted.value(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(unwrapRedacted) as T;
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, unwrapRedacted(entry)]),
  ) as T;
};
