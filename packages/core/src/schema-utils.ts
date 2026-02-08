import type { z } from 'zod';
import { zodToJsonSchema as convert } from 'zod-to-json-schema';

export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convert(schema, { target: 'openApi3' }) as Record<string, unknown>;
}
