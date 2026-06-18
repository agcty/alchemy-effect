# Alchemy Monorepo Spike

This branch is a fork-only viability spike. It is intentionally not a
production migration and should not be opened as an upstream PR in this form.

The goal is to show what changes when `alchemy-effect`, `distilled`, and
`cloudflare-tools` share one Bun/Nx workspace:

- cross-package feature work can live on one branch;
- package links use `workspace:*` instead of preview releases or version bumps;
- Nx can show and execute the affected graph across the previously separate repos;
- release automation can be modeled centrally before replacing the current workflows.

## What Changed

- Imported `cloudflare-tools` under `cloudflare-tools/`.
- Added the Cloudflare tool packages and fixtures to the root Bun workspace.
- Switched the Cloudflare tool packages consumed by `alchemy` to workspace catalog entries:
  - `@distilled.cloud/cloudflare-rolldown-plugin`
  - `@distilled.cloud/cloudflare-runtime`
  - `@distilled.cloud/cloudflare-vite-plugin`
- Added a minimal `nx.json` that lets Nx infer projects from package manifests and cache
  common `build`, `typecheck`, `test`, `lint`, `dev`, `deploy`, and `destroy` targets.
- Added `nx@23.0.0-rc.3`, matching the already-proven Oddlynew Nx line and avoiding
  this repo's Bun minimum-release-age guard for freshly published packages.

## Demo Commands

Install once:

```sh
bun install
```

Show the unified project list:

```sh
bun nx show projects
```

At the time of this spike, Nx discovers 65 projects across:

- `packages/*` from `alchemy-effect`;
- `distilled/packages/*`;
- `cloudflare-tools/packages/*`;
- `cloudflare-tools/packages/vendor/*`;
- `cloudflare-tools/packages/tools/*`;
- `cloudflare-tools/fixtures/*`;
- existing Alchemy examples and website projects.

Show the graph:

```sh
bun nx graph
```

Generate a static graph artifact:

```sh
bun nx graph --file=dist/nx-graph.json
```

Simulate a change in the Cloudflare Vite plugin:

```sh
bun nx show projects --affected \
  --files=cloudflare-tools/packages/cloudflare-vite-plugin/src/plugin.ts
```

This proves the central workflow improvement. A change in the formerly separate
Cloudflare tooling repo marks these downstream areas affected, including:

- `@distilled.cloud/cloudflare-vite-plugin`;
- Cloudflare tool fixtures such as `@fixtures/static-website`, `@fixtures/tanstack-start`,
  `@fixtures/solidstart`, and `@fixtures/solid-ssr`;
- `alchemy`;
- Alchemy Cloudflare examples and integration fixtures;
- Alchemy package dependents such as `@alchemy.run/better-auth`,
  `@alchemy.run/pr-package`, and `website`.

That is the current multi-PR workflow collapsed into one graph query.

Run one real cross-repo build target:

```sh
bun nx run @distilled.cloud/cloudflare-vite-plugin:build
```

This succeeds on the spike branch and schedules seven dependency tasks first,
including distilled core/cloudflare and Cloudflare runtime/tooling packages.

## Why This Matters

The active RSC/Vite stack is the best example:

1. `cloudflare-tools`: add RSC dev support.
2. `cloudflare-tools`: emit a deploy manifest.
3. `alchemy-effect`: consume that manifest.
4. `alchemy-effect`: harden `alchemy dev` bindings.

In separate repos, this requires stacked PRs, preview packages, submodule/version
alignment, and manual verification. In this workspace, it can be one branch with:

```sh
bun nx affected -t build,typecheck,test --base=origin/main
```

For this spike, prefer `bun nx show projects --affected --files=...` for demos.
`nx affected -t ... --dry-run` on the pinned Nx version still began invoking tasks
locally, so use the project-list command when you want a non-destructive proof.

## Release Direction

Nx Release can replace much of the custom version/publish orchestration once the
workspace shape is settled. The migration should keep separate release intent:

- Alchemy release group:
  - `alchemy`
  - `@alchemy.run/better-auth`
  - `@alchemy.run/pr-package`
- Distilled SDK release group:
  - `@distilled.cloud/core`
  - provider SDKs such as `@distilled.cloud/aws`, `@distilled.cloud/cloudflare`, etc.
- Cloudflare tooling release group:
  - `@distilled.cloud/cloudflare-rolldown-plugin`
  - `@distilled.cloud/cloudflare-runtime`
  - `@distilled.cloud/cloudflare-vite-plugin`

The spike config starts with independent project releases because that is safer
for discovery. A production migration should refine this into explicit release
groups, run `bun nx release --dry-run`, and compare the proposed version bumps
against the existing release workflows before publishing anything.

## Remote Cache Direction

This repo can use Nx remote caching after the project graph is stable. For an
Alchemy-owned setup, an S3/R2-backed cache is attractive because the team already
has Cloudflare infrastructure patterns.

Important constraint: bucket-backed remote caches must not accept writes from
untrusted PRs. Nx documents cache-poisoning risk for bucket-style remote caches.
For public forks, use one of these patterns:

- trusted branches write to remote cache, fork PRs read or skip writes;
- separate read/write credentials by CI trust level;
- use Nx Cloud/Enterprise if the project wants managed cache integrity.

## What This Spike Does Not Do

- It does not preserve `cloudflare-tools` Git history inside this branch.
- It does not remove the existing `distilled` submodule.
- It does not replace the current GitHub release workflows.
- It does not initialize external provider spec submodules.
- It does not add custom Oddlynew-style Nx plugins yet.

Those are follow-up steps after maintainers agree that the workflow improvement
is compelling.

## Production Migration Sketch

1. Re-import `cloudflare-tools` and `distilled` with a history-preserving strategy.
2. Replace the `distilled` submodule with source packages.
3. Keep package roots stable first; avoid source moves during the initial migration.
4. Add custom target inference only where package scripts are insufficient.
5. Wire CI around `nx affected` and trusted remote cache.
6. Convert release workflows to `nx release --dry-run`, then publishing.
7. Only then open the upstream PR.
