import { Capability, Policy, Runtime } from "@alchemy.run/effect";

export type { Context } from "aws-lambda";

export interface FunctionProps<Req = any> {
  main: string;
  handler?: string;
  memory?: number;
  runtime?: "nodejs20x" | "nodejs22x";
  architecture?: "x86_64" | "arm64";
  url?: boolean;
  bindings: Policy<Function, Extract<Req, Capability>>;
}

export type FunctionAttr<Props extends FunctionProps = FunctionProps> = {
  functionArn: string;
  functionName: string;
  functionUrl: Props["url"] extends true ? string : undefined;
  roleName: string;
  roleArn: string;
  code: {
    hash: string;
  };
};

export interface Function extends Runtime<"AWS.Lambda.Function"> {
  readonly attr: FunctionAttr<Extract<this["props"], FunctionProps>>;
}
export const Function = Runtime("AWS.Lambda.Function")<Function>();
