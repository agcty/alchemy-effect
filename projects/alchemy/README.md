# alchemy-effect

Alchemy Effect is an Infrastructure-as-Effects (iae) framework that unifies Business Logic and Infrastructure-as-Code into a single, unified model:
1. *Resources* declared in your code
2. *Business Logic* expressed as Effects accessing those resources
3. *Bindings* attached to Functions, Workers, Hosts, etc. ensure least-privilege IAM policies

```ts
// declare a FIFO SQS Queue with a String schema
export class Messages extends SQS.Queue("Messages", {
  fifo: true,
  schema: S.String,
}) {} 

// declare a Lambda Function that sends a message to the Messages Queue
export class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    // Infer sqs::SendMessage IAM Policy
    yield* SQS.sendMessage(Messages, "Hello, world!");
    return {
      body: JSON.stringify(null),
    };
  }),
}) ({
  main: import.meta.filename,
  // Type system guaranees least-privilege IAM policy
  bindings: $(SQS.SendMessage(Messages)),
}) {}

// export the API's handler with runtime layers provided for bundling and running in AWS
export default Api.handler.pipe(Effect.provide(SQS.clientFromEnv()), Lambda.toHandler);
```

