# Protocol Abstraction Plan

## Overview

This document outlines the plan to refactor the current protocol handling in itty-aws to use a more modular, extensible architecture based on AWS Smithy protocol specifications.

## Current State Issues

1. **Tightly coupled protocol handling** - Content-Type selection is hardcoded in switch statements
2. **Scattered serialization logic** - Request body preparation mixes protocol-specific logic with generic handling
3. **Inconsistent response parsing** - Basic protocol detection but limited extensibility
4. **Missing protocol abstractions** - No clear separation between protocol-specific serializers/deserializers

## Proposed Architecture

### Protocol Handler Interface

```typescript
interface ProtocolHandler {
  readonly name: string;
  readonly contentType: string;
  
  // Request serialization
  serializeInput(input: unknown, action: string, metadata: ServiceMetadata): string;
  getHeaders(action: string, metadata: ServiceMetadata): Record<string, string>;
  
  // Response deserialization  
  deserializeOutput(responseText: string, statusCode: number): unknown;
  deserializeError(responseText: string, statusCode: number): unknown;
}
```

### Concrete Protocol Implementations

#### JSON Protocols
- **AwsJson10Handler** - `awsJson1_0` with target prefix headers
- **AwsJson11Handler** - `awsJson1_1` with different error serialization  
- **RestJson1Handler** - `restJson1` with HTTP method/URI bindings

#### Query Protocols
- **AwsQueryHandler** - `awsQuery` with URL-encoded form data
- **Ec2QueryHandler** - `ec2Query` with specialized XML parsing

#### XML Protocols
- **RestXmlHandler** - `restXml` for S3-like services

### Protocol Registry

```typescript
class ProtocolRegistry {
  private handlers = new Map<string, ProtocolHandler>();
  
  register(protocol: string, handler: ProtocolHandler): void;
  get(protocol: string): ProtocolHandler;
  
  static createDefault(): ProtocolRegistry;
}
```

## Implementation Phases

### Phase 1: Extract Existing Logic
- Create `ProtocolHandler` interface
- Implement concrete handlers for current protocols:
  - `AwsJson10Handler`
  - `AwsJson11Handler` 
  - `RestJson1Handler`
  - `AwsQueryHandler`
  - `Ec2QueryHandler`
- Create `ProtocolRegistry` class

### Phase 2: Replace Switch Statements
- Modify `createServiceProxy()` to use protocol registry
- Replace hardcoded Content-Type logic with handler delegation
- Replace serialization switch with handler calls

### Phase 3: Add Comprehensive Tests
- Unit tests for each protocol handler
- Integration tests for protocol registry
- Regression tests for existing functionality

### Phase 4: Add Missing Protocols
- Implement `RestXmlHandler` for S3 support
- Add any other missing protocol handlers

## Benefits

- **Separation of concerns** - Each protocol encapsulated in its own handler
- **Extensibility** - Easy to add new protocols without modifying core client
- **Testability** - Each protocol handler can be unit tested independently  
- **Maintainability** - Protocol-specific logic is easy to locate and modify
- **AWS Smithy alignment** - Matches Smithy's protocol-agnostic design philosophy

## Files to Modify

- `src/client.ts` - Remove hardcoded protocol logic, use registry
- `src/protocols/` - New directory for protocol handlers
- `src/protocols/interface.ts` - Protocol handler interface
- `src/protocols/registry.ts` - Protocol registry implementation
- `src/protocols/aws-json-1-0.ts` - AWS JSON 1.0 handler
- `src/protocols/aws-json-1-1.ts` - AWS JSON 1.1 handler
- `src/protocols/rest-json-1.ts` - REST JSON 1 handler
- `src/protocols/aws-query.ts` - AWS Query handler
- `src/protocols/ec2-query.ts` - EC2 Query handler

## Migration Strategy

This refactoring maintains backward compatibility while providing a cleaner architecture for future protocol additions. The existing `parseEC2Response` function will be integrated into the `Ec2QueryHandler`, preserving current functionality.