import * as Alchemy from "@oddlynew/alchemy";
import * as AWS from "@oddlynew/alchemy/AWS";
import * as Output from "@oddlynew/alchemy/Output";
import * as Effect from "effect/Effect";
import { NetworkLive } from "./src/Network.ts";
import Server from "./src/Server.ts";

const aws = AWS.providers();

export default Alchemy.Stack(
  "AwsEc2Example",
  { providers: aws, state: Alchemy.localState() },
  Effect.gen(function* () {
    const instance = yield* Server;

    return {
      instanceId: instance.instanceId,
      publicIpAddress: instance.publicIpAddress,
      instanceUrl: Output.interpolate`http://${instance.publicIpAddress}:3000`,
      enqueueExample: Output.interpolate`http://${instance.publicIpAddress}:3000/enqueue?message=hello`,
    };
  }).pipe(Effect.provide(NetworkLive)),
);
