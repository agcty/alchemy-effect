export const toEnvKey = <const ID extends string, const Suffix extends string>(
  id: ID,
  suffix: Suffix,
) => `${replace(toUpper(id))}_${replace(toUpper(suffix))}` as const;

const toUpper = <const S extends string>(str: S) =>
  str.toUpperCase() as string extends S ? S : Uppercase<S>;

const replace = <const S extends string>(str: S) =>
  str.replace(/-/g, "_") as Replace<S>;

type Replace<S extends string, Accum extends string = ""> = string extends S
  ? S
  : S extends ""
    ? Accum
    : S extends `${infer S}${infer Rest}`
      ? S extends "-"
        ? Replace<Rest, `${Accum}_`>
        : Replace<Rest, `${Accum}${S}`>
      : Accum;

function _test_both_literals() {
  const key = toEnvKey("my-id", "my-suffix");
  const _: typeof key = "MY_ID_MY_SUFFIX";
  // @ts-expect-error
  const _err: typeof key = "MY_ID_MY_SUFFIX2";
}
function _test_replace_wide_string() {
  const ___ = toUpper(undefined! as string);
  const id: string = "my-id";
  const key = toEnvKey(id, "my-suffix");
  const _: typeof key = "MY_ID_MY_SUFFIX";
  const _2: typeof key = `${id}_MY_SUFFIX` as const;
  // @ts-expect-error
  const _err: typeof key = "MY_ID_MY_SUFFIX2";
  // @ts-expect-error
  const _err2: typeof key = `${id}_MY_SUFFIX2` as const;
}

function _test_replace_wide_suffix() {
  const ___ = toUpper(undefined! as string);
  const id = "my-id";
  const suffix = "my-suffix" as string;
  const key = toEnvKey(id, suffix);
  const _: typeof key = "MY_ID_MY_SUFFIX";
  const _2: typeof key = `MY_ID_${suffix}` as const;
  // @ts-expect-error
  const _err: typeof key = "WRONG_PREFIX_MY_SUFFIX";
  // @ts-expect-error
  const _err2: typeof key = `WRONG_PREFIX_${suffix}`;
}
