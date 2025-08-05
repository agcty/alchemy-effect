// Protocol abstraction exports
export type { ProtocolHandler, ServiceMetadata } from "./interface.ts";
export { ProtocolRegistry } from "./registry.ts";
export { AwsJson10Handler } from "./aws-json-1-0.ts";
export { AwsJson11Handler } from "./aws-json-1-1.ts";
export { RestJson1Handler } from "./rest-json-1.ts";
export { AwsQueryHandler } from "./aws-query.ts";
export { Ec2QueryHandler } from "./ec2-query.ts";
export { RestXmlHandler } from "./rest-xml.ts";
