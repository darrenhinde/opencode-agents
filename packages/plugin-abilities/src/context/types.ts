import { z } from 'zod';

export const ContextTypeSchema = z.enum(['file', 'url', 'api', 'snippet']);

export const ContextDefinitionSchema = z.object({
  id: z.string(),
  type: ContextTypeSchema,
  path: z.string(),
  description: z.string().optional(),
  priority: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ContextDefinition = z.infer<typeof ContextDefinitionSchema>;

export interface LoadedContext {
  definition: ContextDefinition;
  content: string;
  source: string;
}

export const SkillPermissionSchema = z.object({
  skill: z.string(),
  tools: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const AgentPermissionsSchema = z.object({
  agent: z.string(),
  permissions: z.array(SkillPermissionSchema),
});

export type SkillPermission = z.infer<typeof SkillPermissionSchema>;
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
