#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Import the metadata directly from the file
const { serviceMetadata } = await import("../src/metadata.ts");

// Count services by protocol
const protocolCounts: Record<string, number> = {};
const services = Object.entries(serviceMetadata);

for (const [, metadata] of services) {
  const protocol = metadata.protocol;
  protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
}

// Sort protocols by count (descending) then alphabetically
const sortedProtocols = Object.entries(protocolCounts).sort(
  ([a, countA], [b, countB]) => {
    if (countA !== countB) return countB - countA;
    return a.localeCompare(b);
  },
);

// Generate the markdown content
const markdown = `# AWS Service Support

This document provides an overview of AWS services supported by itty-aws.

## Summary

- **Total Services**: ${services.length}

### By Protocol

${sortedProtocols
  .map(([protocol, count]) => `- **${protocol}**: ${count} services`)
  .join("\n")}

## Full Service Details

| Service Name | SDK ID | Protocol | Version | ARN Namespace | Endpoint Prefix |
|--------------|--------|----------|---------|---------------|-----------------|
${services
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([serviceName, metadata]) => {
    return `| ${serviceName} | ${metadata.sdkId} | ${metadata.protocol} | ${metadata.version} | ${metadata.arnNamespace} | ${metadata.endpointPrefix} |`;
  })
  .join("\n")}

---

*Generated on ${new Date().toISOString().split("T")[0]} by itty-aws service support table generator*
`;

// Write the markdown file
const outputPath = join(import.meta.dir, "../AWS_SERVICE_SUPPORT.md");
writeFileSync(outputPath, markdown, "utf-8");

console.log(
  `✅ Generated AWS_SERVICE_SUPPORT.md with ${services.length} services`,
);
console.log("📊 Protocol breakdown:");
for (const [protocol, count] of sortedProtocols) {
  console.log(`   ${protocol}: ${count} services`);
}
