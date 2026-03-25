import { AgentPermissionsSchema, type AgentPermissions, type SkillPermission } from '../context/types.js';

export interface PermissionValidationResult {
  valid: boolean;
  errors: string[];
}

export class PermissionValidator {
  validateAgentPermissions(data: unknown): PermissionValidationResult {
    const result = AgentPermissionsSchema.safeParse(data);
    
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }

  checkSkillAccess(agentPermissions: AgentPermissions, skillName: string, toolName: string): boolean {
    const permission = agentPermissions.permissions.find(p => p.skill === skillName);
    
    if (!permission) {
      // Default deny if no explicit permission for skill
      return false;
    }

    if (!permission.tools) {
      // If tools not specified, assume strict/deny or allow all?
      // Security best practice: Default deny.
      return false;
    }

    if (permission.tools.includes('*') || permission.tools.includes(toolName)) {
      return true;
    }

    return false;
  }
}
