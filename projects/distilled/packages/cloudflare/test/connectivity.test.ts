import { describe, expect } from "vitest";
import * as Effect from "effect/Effect";
import { test, getAccountId, testRunId } from "./test.ts";
import * as Connectivity from "~/services/connectivity";
import * as ZeroTrust from "~/services/zero-trust";

const accountId = () => getAccountId();

const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

const serviceName = (suffix: string) =>
  `distilled-cf-vpc-${suffix}-${testRunId}`;

const tunnelSecret = (seed: string): string => {
  const bytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++)
    bytes[i] = (seed.charCodeAt(i % seed.length) + i) & 0xff;
  return bytes.toString("base64");
};

/**
 * Provision a tunnel for the duration of `fn`, then delete it.
 */
const withTunnel = <A, E, R>(
  name: string,
  fn: (tunnelId: string) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | any, R | any> =>
  Effect.gen(function* () {
    const created = yield* ZeroTrust.createTunnelCloudflared({
      accountId: accountId(),
      name,
      configSrc: "cloudflare",
      tunnelSecret: tunnelSecret(name),
    });
    return yield* fn(created.id!).pipe(
      Effect.ensuring(
        ZeroTrust.deleteTunnelCloudflared({
          accountId: accountId(),
          tunnelId: created.id!,
        }).pipe(Effect.catch(() => Effect.void)),
      ),
    );
  });

describe("Connectivity > DirectoryService (VpcService)", () => {
  test("error - VpcServiceNotFound for getDirectoryService with non-existent id", () =>
    Connectivity.getDirectoryService({
      accountId: accountId(),
      serviceId: NONEXISTENT_UUID,
    }).pipe(
      Effect.flip,
      Effect.map((e: any) => {
        expect(e._tag).toBe("VpcServiceNotFound");
        expect(e.code).toBe(5104);
      }),
    ));

  test("error - VpcServiceNotFound for deleteDirectoryService with non-existent id", () =>
    Connectivity.deleteDirectoryService({
      accountId: accountId(),
      serviceId: NONEXISTENT_UUID,
    }).pipe(
      Effect.flip,
      Effect.map((e: any) => {
        expect(e._tag).toBe("VpcServiceNotFound");
        expect(e.code).toBe(5104);
      }),
    ));

  test("error - VpcTunnelNotFound for createDirectoryService with non-existent tunnel id", () =>
    Connectivity.createDirectoryService({
      accountId: accountId(),
      name: serviceName("bad-tunnel"),
      type: "http",
      host: { ipv4: "10.0.0.1", network: { tunnelId: NONEXISTENT_UUID } },
    }).pipe(
      Effect.flip,
      Effect.map((e: any) => {
        expect(e._tag).toBe("VpcTunnelNotFound");
        expect(e.code).toBe(5101);
        expect(e.message).toContain("Tunnel ID Not Found");
      }),
    ));

  test("error - VpcServiceNameAlreadyExists for createDirectoryService with conflicting name", () =>
    withTunnel(`vpc-dup-tunnel-${testRunId}`, (tunnelId) =>
      Effect.gen(function* () {
        const name = serviceName("dup");
        const created = yield* Connectivity.createDirectoryService({
          accountId: accountId(),
          name,
          type: "http",
          host: { ipv4: "10.0.0.1", network: { tunnelId } },
        });

        try {
          const err: any = yield* Connectivity.createDirectoryService({
            accountId: accountId(),
            name,
            type: "http",
            host: { ipv4: "10.0.0.2", network: { tunnelId } },
          }).pipe(Effect.flip);

          expect(err._tag).toBe("VpcServiceNameAlreadyExists");
          expect(err.code).toBe(5101);
          expect(err.message).toMatch(/already exists/i);
        } finally {
          if (created.serviceId) {
            yield* Connectivity.deleteDirectoryService({
              accountId: accountId(),
              serviceId: created.serviceId,
            }).pipe(Effect.catch(() => Effect.void));
          }
        }
      }),
    ));
});
