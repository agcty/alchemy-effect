# Monorepo Migration

This branch models `alchemy-effect`, `distilled`, and `cloudflare-tools` as one Bun/Nx workspace
without forcing a directory rename during the first production migration. It is intentionally split
into two concerns:

1. make the merged graph, CI, cache, and release model production-credible;
2. leave a later mechanical directory move to `projects/*` as a small, reviewable follow-up.

## Source Layout

The imported repositories keep their recognizable roots:

```text
packages/                         # Existing alchemy-effect packages
distilled/packages/*              # Imported distilled packages
cloudflare-tools/packages/*       # Imported Cloudflare tooling packages
cloudflare-tools/packages/vendor/* # Private vendored support packages
cloudflare-tools/packages/tools/*  # Private build/test support packages
```

Nx does not require a `projects/` directory to understand project boundaries. Each package root is
an Nx project through its `package.json`. For example:

| Package root                                           | Nx project name                                | Release group       |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------- |
| `packages/alchemy`                                     | `alchemy`                                      | `alchemy`           |
| `distilled/packages/stripe`                            | `@distilled.cloud/stripe`                      | `distilled`         |
| `cloudflare-tools/packages/cloudflare-vite-plugin`     | `@distilled.cloud/cloudflare-vite-plugin`      | `cloudflare-tools`  |
| `cloudflare-tools/packages/tools/test`                 | `@distilled.cloud/test-utils`                  | private, no release |

This keeps historical paths stable while still allowing Nx to answer the important questions:

- which packages are affected by a PR;
- which dependencies must build before a target package;
- which tasks can reuse local or remote cache artifacts;
- which package versions and changelogs must change together.

If the maintainers later want a uniform `projects/<repo>/...` hierarchy, that can be a second
mechanical move after the graph, CI, and release workflow are accepted.

The recommended final layout is:

```text
packages/                         # Shared repo infrastructure packages
├── nx-alchemy-plugin
├── nx-oxlint-plugin
├── nx-tsdown-plugin
├── nx-tsgo-plugin
└── oxlint-config
projects/
├── alchemy/
│   ├── apps/
│   │   └── website
│   ├── examples/
│   └── packages/
│       ├── alchemy
│       ├── better-auth
│       └── pr-package
├── distilled/
│   ├── apps/
│   │   └── website
│   └── packages/
│       └── ...
└── cloudflare-tools/
    ├── fixtures/
    └── packages/
        ├── cloudflare-runtime
        ├── cloudflare-vite-plugin
        └── cloudflare-rolldown-plugin
```

That mirrors the Oddlynew shape: root-level packages are shared monorepo infrastructure, and
product-owned code lives under `projects/<product>`. The current branch keeps the original paths
because it is easier for maintainers to review the actual Nx/cache/release behavior before a large
rename commit moves files.

## Inferred Targets

The repo includes private Nx plugins under `packages/nx-*-plugin`:

- `@alchemy.run/nx-tsdown-plugin` adds `build` when a project has `tsdown.config.ts`.
- `@alchemy.run/nx-tsgo-plugin` adds `typecheck` when a project has `tsconfig.json` and no existing
  `typecheck` package script.
- `@alchemy.run/nx-oxlint-plugin` adds `lint` when a project has oxlint config in its root or an
  ancestor directory and no existing `lint` package script.
- `@alchemy.run/nx-alchemy-plugin` adds `dev`, `deploy`, `destroy`, and `plan` when a project has
  `alchemy.run.ts`.

That keeps package `package.json` files focused on package behavior while Nx owns orchestration.
For this migration branch, lockfile changes intentionally mark all projects affected. Nx's smarter
`projectsAffectedByDependencyUpdates: "auto"` mode currently trips over this merged `bun.lock`
shape, and the safe fallback is to rebuild broadly when dependencies change.

Useful commands:

```bash
bun nx show projects
bun nx graph
bun nx show projects --affected --files=distilled/packages/stripe/src/index.ts
bun nx run @distilled.cloud/cloudflare-vite-plugin:build
```

## Shared Config

The branch follows the Oddlynew config pattern by putting shared lint rules in
`@alchemy.run/oxlint-config` and importing them from TypeScript oxlint config files:

- `oxlint.config.ts`
- `distilled/oxlint.config.ts`
- `cloudflare-tools/oxlint.config.ts`

That replaces the previous scattered `.oxlintrc.json` files and makes project-specific exceptions
explicit in code. A later `projects/*` move should keep this pattern and place product overrides at
`projects/<product>/oxlint.config.ts`.

The shared package intentionally exposes two presets:

- `@alchemy.run/oxlint-config/base-config` mirrors the minimal root/Distilled rules from the
  standalone repos.
- `@alchemy.run/oxlint-config/effect-config` mirrors the stricter Cloudflare-tools Effect-style
  rules, while keeping category-level type-aware checks as warnings/off by default like Oddlynew's
  baseline.

That preserves current generated-code behavior while still giving maintainers one package to evolve
when they want stricter linting across the merged workspace.

## Validation Scope

CI runs Nx affected checks for production/package projects, not every demo surface. Build and
`lint` validation use `.github/scripts/run-affected-production-target.ts` to skip aggregate and
non-hermetic demo roots:

- `.`
- `distilled`
- `cloudflare-tools`
- `examples/`
- `website`
- `cloudflare-tools/fixtures/`
- `packages/alchemy/test/`
- nested `test/fixtures/` package roots

Those projects still appear in the Nx graph and can be run directly, but they currently depend on
extra local tools or runtime-specific bundler behavior that should not block the first monorepo
cutover. They can be promoted into the required CI gate once each target is hermetic.

Distilled's existing `check` scripts still include `oxfmt --check src`, but the imported generated
AWS/GCP clients have pre-existing formatter drift. The migration CI therefore runs `lint`
instead of `check`; a future baseline cleanup can format generated clients and promote `check` once
that diff is reviewed separately.

## Release Groups

`nx.json` models the three public release surfaces separately:

- `alchemy`: `alchemy`, `@alchemy.run/better-auth`, `@alchemy.run/pr-package`
- `distilled`: the public `@distilled.cloud/*` provider packages from `distilled`
- `cloudflare-tools`: the public Cloudflare runtime, Vite plugin, and Rolldown plugin packages

Each group is fixed-versioned internally, matching the current repos. A release of the Alchemy group
or the Cloudflare-tools group can therefore bump every package in that group from conventional
commits and create matching per-project changelog entries.

Cross-group dependent bumps are intentionally disabled in this branch with
`version.updateDependents: "never"`. Nx can model dependent bumps across release groups, but the
current Alchemy tag history plus the unscoped `alchemy` package name exposes an Nx 23 RC resolver
edge case when a Cloudflare-tools release tries to pull `alchemy` in as a dependent. The safe
cutover is to first land fixed release groups, then switch `updateDependents` to `"auto"` after the
tag policy is finalized or the resolver issue is fixed.

Nx release is configured for conventional commits and per-project changelogs:

```bash
bun nx release --groups=alchemy --dry-run --preid beta --skip-publish
bun nx release --groups=cloudflare-tools --dry-run --first-release --preid beta --skip-publish
```

## Remote Cache

Local Nx caching works with no secrets. Remote cache is opt-in through environment variables so
fork PRs and local checkouts remain safe by default.

This branch includes `.github/scripts/configure-nx-r2-cache.sh`, which expects:

- `NX_R2_CACHE_SERVER_URL` as a repository variable;
- `NX_R2_CACHE_BRANCH_TOKEN` as a repository secret available to PR/branch CI;
- `NX_R2_CACHE_TRUSTED_TOKEN` as an environment secret available only to protected `main` pushes.

The script exports Nx's self-hosted cache variables:

- `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`
- `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`

The intended cache topology is two-tier:

| Tier        | Written by                   | Read by                                | Purpose                         |
| ----------- | ---------------------------- | -------------------------------------- | ------------------------------- |
| `trusted`   | protected `main` CI          | everyone through trusted fall-through  | artifacts allowed to ship       |
| `branches/*` | PR CI and developer branches | that branch namespace plus trusted miss | fast untrusted iteration        |

This avoids the dangerous shape where untrusted PRs can poison the same cache namespace used by
production builds. If cache credentials are missing, CI prints a notice and uses only local Nx
cache.

The self-hosted Worker/R2 cache implementation from the Oddlynew monorepo can be brought over as a
follow-up package, or this same contract can be backed by Nx Cloud/Enterprise. The key production
requirement is the trust boundary, not the storage provider.

## Cutover Plan

1. Land the monorepo branch without changing publish ownership.
2. Run `bun install` and verify `bun nx show projects` in CI.
3. Add cache variables and secrets, then confirm PR runs use branch cache and `main` uses trusted
   cache.
4. Run affected builds on integration PRs that touch both `alchemy` and `distilled`.
5. Dry-run Nx release until the generated version plan and changelogs match the existing release
   policy.
6. Move package publishing from repo-specific workflows to Nx release groups.
7. Archive or redirect the old standalone repos after release automation is proven.
