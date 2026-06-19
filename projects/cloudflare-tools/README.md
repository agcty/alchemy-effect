# cloudflare-tools

Monorepo for Cloudflare developer tooling powered by Rolldown, Effect, and Vite. Dogfood packages
are published under [`@oddlynew`](https://www.npmjs.com/org/oddlynew) on npm.

> Note: The Effect-native Cloudflare API client is published as [`@oddlynew/distilled-cloudflare`](https://www.npmjs.com/package/@oddlynew/distilled-cloudflare) on npm and now lives at [`projects/distilled/packages/cloudflare`](../distilled/packages/cloudflare) in the same replacement monorepo.

## Packages

| Package                                                                                 | Description                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`@oddlynew/distilled-cloudflare-rolldown-plugin`](packages/cloudflare-rolldown-plugin) | Rolldown plugin for Cloudflare Workers.             |
| [`@oddlynew/distilled-cloudflare-runtime`](packages/cloudflare-runtime)                 | Effect-native local runtime for Cloudflare Workers. |
| [`@oddlynew/distilled-cloudflare-vite-plugin`](packages/cloudflare-vite-plugin)         | Vite plugin for Cloudflare Workers.                 |

## Development

```bash
bun install
bun nx lint @oddlynew/distilled-cloudflare-runtime
bun nx typecheck @oddlynew/distilled-cloudflare-runtime
bun nx build @oddlynew/distilled-cloudflare-runtime
bun nx test @oddlynew/distilled-cloudflare-runtime
```

Workspace packages live under [`packages/`](packages/).

## License

MIT
