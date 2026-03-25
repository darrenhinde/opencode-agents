/**
 * @openagents/plugin-abilities - Minimal Version
 * 
 * Enforced, validated workflows for OpenCode agents.
 * Stripped to essentials for testing core concept.
 */

// Core types
export type {
  Ability,
  Step,
  ScriptStep,
  InputDefinition,
  InputValues,
  AbilityExecution,
  StepResult,
  ExecutorContext,
  LoadedAbility,
  ValidationResult,
} from './types/index.js'

// Loader
export { loadAbilities, loadAbility } from './loader/index.js'

// Validator
export { validateAbility, validateInputs } from './validator/index.js'
export { PermissionValidator } from './validator/permissions.js'

// Context Discovery
export { ContextDiscovery } from './context/discovery.js'
export type { ContextDefinition, LoadedContext, AgentPermissions } from './context/types.js'

// Executor
export { executeAbility, formatExecutionResult } from './executor/index.js'
export { ExecutionManager } from './executor/execution-manager.js'

// Plugin
export { AbilitiesPlugin } from './opencode-plugin.js'
export { default } from './opencode-plugin.js'
