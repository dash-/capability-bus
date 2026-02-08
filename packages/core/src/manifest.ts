import type {
  AppContext,
  CapabilityDefinition,
  CapabilityManifest,
  ManifestCapabilityEntry,
  ToolDefinition,
} from './types.js';
import { zodToJsonSchema } from './schema-utils.js';

export function generateManifest(
  capabilities: Map<string, CapabilityDefinition>,
  context: AppContext,
  appInfo: { name: string; version: string },
): CapabilityManifest {
  const entries: ManifestCapabilityEntry[] = [];

  for (const cap of capabilities.values()) {
    const availability = cap.isAvailable?.(context) ?? { available: true };
    entries.push({
      name: cap.name,
      description: cap.description,
      input_schema: zodToJsonSchema(cap.input),
      output_schema: zodToJsonSchema(cap.output),
      side_effect: cap.sideEffect,
      permissions: cap.permissions,
      concurrency: cap.concurrency,
      available: availability.available,
      unavailable_reason: availability.unavailableReason ?? null,
    });
  }

  return {
    schema_version: '0.1.0',
    application: appInfo,
    capabilities: entries,
    generated_at: new Date().toISOString(),
  };
}

export function manifestToToolDefinitions(manifest: CapabilityManifest): ToolDefinition[] {
  return manifest.capabilities
    .filter((c) => c.available)
    .map((c) => ({
      name: c.name,
      description: c.description,
      input_schema: c.input_schema,
    }));
}
