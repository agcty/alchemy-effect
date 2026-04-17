import { Fiber, Schedule } from "effect";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

export class Monitor extends Context.Service<
  Monitor,
  {
    heartbeat: Effect.Effect<void>;
    exit: Effect.Effect<void>;
  }
>()("Monitor") {}

const IDLE_TIMEOUT = Duration.seconds(10);

export const make = Effect.fnUntraced(function* (
  shutdown: Deferred.Deferred<void>,
) {
  const last = yield* Ref.make(Date.now());

  const fiber = yield* Effect.gen(function* () {
    console.log("[monitor] waiting");
    yield* Effect.sleep(IDLE_TIMEOUT);
    console.log("[monitor]", {
      now: Date.now(),
      last: yield* Ref.get(last),
    });
    const elapsed = Date.now() - (yield* Ref.get(last));
    if (elapsed >= Duration.toMillis(IDLE_TIMEOUT)) {
      console.log("[monitor] shutting down");
      yield* Deferred.succeed(shutdown, void 0);
    } else {
      console.log("[monitor] not shutting down");
    }
  }).pipe(Effect.repeat(Schedule.spaced(IDLE_TIMEOUT)), Effect.forkScoped);

  return Monitor.of({
    heartbeat: Effect.gen(function* () {
      console.log("[monitor] heartbeat", {
        now: Date.now(),
        last: yield* Ref.get(last),
      });
      yield* Ref.set(last, Date.now());
    }),
    exit: Effect.gen(function* () {
      console.log("[monitor] exiting");
      yield* Fiber.interrupt(fiber);
      yield* Deferred.succeed(shutdown, void 0);
    }),
  });
});
