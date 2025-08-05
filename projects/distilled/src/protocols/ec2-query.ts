import type { ProtocolHandler, ServiceMetadata } from "./interface.ts";
import { parseEC2Response } from "../ec2-parsers.js";

export class Ec2QueryHandler implements ProtocolHandler {
  readonly name = "ec2Query";
  readonly contentType = "application/x-www-form-urlencoded";

  buildRequest(
    input: unknown,
    action: string,
    _metadata: ServiceMetadata,
  ): string {
    const params = new URLSearchParams();
    params.append("Action", action);
    params.append("Version", "2016-11-15"); // EC2 API version

    // Flatten the input object into query parameters
    this.flattenObject(input, "", params);

    return params.toString();
  }

  getHeaders(
    _action: string,
    _metadata: ServiceMetadata,
    _body?: string,
  ): Record<string, string> {
    return {
      "Content-Type": this.contentType,
      "User-Agent": "itty-aws",
    };
  }

  parseResponse(responseText: string, _statusCode: number): unknown {
    if (!responseText) return {};
    // Use specialized EC2 parser with registry-based dynamic parsing
    return parseEC2Response(responseText);
  }

  parseError(
    responseText: string,
    _statusCode: number,
    _headers?: Headers,
  ): unknown {
    try {
      // Parse as EC2 XML response, which may contain error information
      return parseEC2Response(responseText);
    } catch {
      return { message: responseText };
    }
  }

  private flattenObject(
    obj: any,
    prefix: string,
    params: URLSearchParams,
  ): void {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const value = obj[key];
        const paramKey = prefix ? `${prefix}.${key}` : key;

        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === "object") {
                this.flattenObject(item, `${paramKey}.${index + 1}`, params);
              } else {
                params.append(`${paramKey}.${index + 1}`, String(item));
              }
            });
          } else if (typeof value === "object") {
            this.flattenObject(value, paramKey, params);
          } else {
            params.append(paramKey, String(value));
          }
        }
      }
    }
  }
}
