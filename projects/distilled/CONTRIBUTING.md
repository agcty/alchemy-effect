## Generating SDKs

Distilled now lives inside the Alchemy monorepo. From the repository root, install dependencies once
with `bun install`, then run the SDK generator from `projects/distilled`.

Every SDK has all of its sources as git submodules; you can either supply a git repo or an HTTP URL
to an OpenAPI spec. Use `--note` to specify where the OpenAPI spec lives in the repo when it is not
obvious.

```bash
cd projects/distilled
bun scripts/create-sdk.ts discord https://github.com/discord/discord-api-spec --note "use /specs/openapi.json from the provided repo"
```

This workflow uses local Claude Code. You must be signed in before running it.

For larger SDKs, rerun the command after limits refresh; the generator is designed to continue from
existing work. Use `bun scripts/create-sdk.ts --help` for skip/resume flags.
