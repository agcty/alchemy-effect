import type { ProtocolHandler } from "./interface.ts";
import { AwsJson10Handler } from "./aws-json-1-0.ts";
import { AwsJson11Handler } from "./aws-json-1-1.ts";
import { RestJson1Handler } from "./rest-json-1.ts";
import { AwsQueryHandler } from "./aws-query.ts";
import { Ec2QueryHandler } from "./ec2-query.ts";
import { RestXmlHandler } from "./rest-xml.ts";

export class ProtocolRegistry {
  private handlers = new Map<string, ProtocolHandler>();

  register(protocol: string, handler: ProtocolHandler): void {
    this.handlers.set(protocol, handler);
  }

  get(protocol: string): ProtocolHandler {
    const handler = this.handlers.get(protocol);
    if (!handler) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }
    return handler;
  }

  has(protocol: string): boolean {
    return this.handlers.has(protocol);
  }

  getSupportedProtocols(): string[] {
    return Array.from(this.handlers.keys());
  }

  static createDefault(): ProtocolRegistry {
    const registry = new ProtocolRegistry();

    // Register all built-in protocol handlers
    registry.register("awsJson1_0", new AwsJson10Handler());
    registry.register("awsJson1_1", new AwsJson11Handler());
    registry.register("restJson1", new RestJson1Handler());
    registry.register("awsQuery", new AwsQueryHandler());
    registry.register("ec2Query", new Ec2QueryHandler());
    registry.register("restXml", new RestXmlHandler());

    return registry;
  }
}
