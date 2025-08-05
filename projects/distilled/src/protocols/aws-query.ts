import type { ProtocolHandler, ServiceMetadata } from "./interface.ts";

export class AwsQueryHandler implements ProtocolHandler {
  readonly name = "awsQuery";
  readonly contentType = "application/x-www-form-urlencoded";

  buildRequest(
    input: unknown,
    action: string,
    _metadata: ServiceMetadata,
  ): string {
    const params = new URLSearchParams();
    params.append("Action", action);
    params.append("Version", "2016-11-15"); // Default version, could be service-specific

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
    // For awsQuery, we need XML parsing but current implementation falls back to JSON
    try {
      return JSON.parse(responseText);
    } catch {
      return { data: responseText };
    }
  }

  parseError(
    responseText: string,
    _statusCode: number,
    _headers?: Headers,
  ): unknown {
    try {
      // Try JSON first, then fall back to raw text
      return JSON.parse(responseText);
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
