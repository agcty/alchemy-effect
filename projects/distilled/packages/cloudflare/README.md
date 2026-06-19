# @oddlynew/distilled-cloudflare

Effect-native Cloudflare SDK generated from the [Cloudflare TypeScript SDK](https://github.com/cloudflare/cloudflare-typescript) source. Covers Workers, R2, KV, D1, Queues, DNS, and more with exhaustive error typing.

## Installation

```bash
npm install @oddlynew/distilled-cloudflare effect
```

## Quick Start

```typescript
import { Effect, Layer } from "effect";
import * as Stream from "effect/Stream";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as DNS from "@oddlynew/distilled-cloudflare/dns";
import * as R2 from "@oddlynew/distilled-cloudflare/r2";
import { CredentialsFromEnv } from "@oddlynew/distilled-cloudflare";

const program = Effect.gen(function* () {
  yield* R2.listBuckets({ account_id: "your-account-id" });

  const records = yield* DNS.listRecords
    .items({ zone_id: "your-zone-id" })
    .pipe(Stream.take(10), Stream.runCollect);
});

const CloudflareLive = Layer.mergeAll(
  FetchHttpClient.layer,
  CredentialsFromEnv,
);

program.pipe(Effect.provide(CloudflareLive), Effect.runPromise);
```

## Configuration

Set the following environment variable:

```bash
CLOUDFLARE_API_TOKEN=your-api-token
```

Create an API token in the [Cloudflare dashboard](https://dash.cloudflare.com/profile/api-tokens) under **My Profile > API Tokens**. Use a custom token scoped to the resources you need (e.g. R2 read/write, DNS edit, Workers edit).

## Error Handling

```typescript
R2.getBucket({ account_id: "...", bucket_name: "missing" }).pipe(
  Effect.catchTags({
    NoSuchBucket: () => Effect.succeed({ found: false }),
    UnknownCloudflareError: (e) =>
      Effect.fail(new Error(`Unknown: ${e.message}`)),
  }),
);
```

## Services

```typescript
import * as R2 from "@oddlynew/distilled-cloudflare/r2";
import * as Workers from "@oddlynew/distilled-cloudflare/workers";
import * as KV from "@oddlynew/distilled-cloudflare/kv";
import * as Queues from "@oddlynew/distilled-cloudflare/queues";
import * as DNS from "@oddlynew/distilled-cloudflare/dns";
```

## License

MIT
