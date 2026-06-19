import * as Alchemy from "@oddlynew/alchemy";

export class Backend extends Alchemy.Stack<
  Backend,
  {
    url: string;
  }
>()("Backend") {}
