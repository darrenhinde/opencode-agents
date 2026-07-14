/**
 * Tests for ContextLoadingEvaluator
 * 
 * Verifies that the evaluator correctly:
 * 1. Detects context file reads
 * 2. Validates context is loaded before execution
 * 3. Handles bash-only tasks (no context required)
 * 4. Handles conversational sessions (no context required)
 */

import { describe, it, expect } from 'vitest';
import { ContextLoadingEvaluator } from '../context-loading-evaluator.js';
import type { TimelineEvent, SessionInfo } from '../../types/index.js';

describe('ContextLoadingEvaluator', () => {
  const evaluator = new ContextLoadingEvaluator();
  const mockSessionInfo: SessionInfo = {
    id: 'test-session',
    version: '1.0',
    title: 'Test Session',
    time: { created: Date.now(), updated: Date.now() },
  };

  describe('context file detection', () => {
    it('should detect .opencode/agent/*.md as context files', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/.opencode/agent/openagent.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.contextLoadedBeforeExecution).toBe(true);
    });

    it('should detect .opencode/context/*.md as context files', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/.opencode/context/code.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.contextLoadedBeforeExecution).toBe(true);
    });

    it('should detect .opencode/context/core/standards/*.md as context files', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/.opencode/context/core/standards/code.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
    });

    it('should detect docs/*.md as context files', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/docs/api.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
    });

    it('should detect README.md as context file', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/README.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
    });

    it('should detect CONTRIBUTING.md as context file', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/CONTRIBUTING.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
    });

    it('should NOT detect regular source files as context', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/src/utils.ts', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // No context loaded before execution is an error, so passed is false
      // And contextLoadedBeforeExecution should be false
      expect(result.metadata?.contextLoadedBeforeExecution).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('error');
    });
  });

  describe('timing validation', () => {
    it('should pass when context is loaded BEFORE execution', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/project/.opencode/context/code.md', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.contextCheck?.contextFileLoaded).toBe(true);
    });

    it('should detect when context is loaded AFTER execution', async () => {
      const timeline: TimelineEvent[] = [
        createWriteToolEvent('/src/app.ts', 1000),
        createReadToolEvent('/project/.opencode/context/code.md', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // Context loaded after execution - should have warning violation
      expect(result.metadata?.contextCheck?.contextFileLoaded).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should create violation when no context is loaded at all', async () => {
      const timeline: TimelineEvent[] = [
        createWriteToolEvent('/src/app.ts', 1000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // No context loaded - should have warning violation
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('no-context-loaded');
    });
  });

  describe('bash-only tasks', () => {
    it('should pass for bash-only tasks without context', async () => {
      const timeline: TimelineEvent[] = [
        createBashToolEvent('ls -la', 1000),
        createBashToolEvent('npm install', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.isBashOnly).toBe(true);
    });

    it('should require context when bash is mixed with write', async () => {
      const timeline: TimelineEvent[] = [
        createBashToolEvent('ls -la', 1000),
        createWriteToolEvent('/src/app.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // Not bash-only because write is present, so context is required
      expect(result.metadata?.isBashOnly).toBeFalsy();
      // Should have warning violation for missing context
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('conversational sessions', () => {
    it('should pass for sessions with no execution tools', async () => {
      const timeline: TimelineEvent[] = [
        createTextEvent('Hello, how can I help?', 1000),
        createTextEvent('I can explain that concept.', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.isTaskSession).toBe(false);
    });

    it('should pass for read-only sessions', async () => {
      const timeline: TimelineEvent[] = [
        createReadToolEvent('/src/app.ts', 1000),
        createReadToolEvent('/src/utils.ts', 2000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.metadata?.isTaskSession).toBe(false);
    });
  });

  describe('execution tool detection', () => {
    it('should detect write as execution tool', async () => {
      const timeline: TimelineEvent[] = [
        createWriteToolEvent('/src/app.ts', 1000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.metadata?.isTaskSession).toBe(true);
      expect(result.metadata?.executionToolCount).toBe(1);
    });

    it('should detect edit as execution tool', async () => {
      const timeline: TimelineEvent[] = [
        createEditToolEvent('/src/app.ts', 1000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.metadata?.isTaskSession).toBe(true);
    });

    it('should detect task as execution tool', async () => {
      const timeline: TimelineEvent[] = [
        createTaskToolEvent('subagents/code/coder-agent', 1000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.metadata?.isTaskSession).toBe(true);
    });

    it('should detect bash as execution tool', async () => {
      const timeline: TimelineEvent[] = [
        createBashToolEvent('npm test', 1000),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.metadata?.isTaskSession).toBe(true);
    });
  });
});

// Helper functions to create mock timeline events

function createReadToolEvent(filePath: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: {
      tool: 'read',
      input: { filePath },
    },
  };
}

function createWriteToolEvent(filePath: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: {
      tool: 'write',
      input: { filePath, content: 'test content' },
    },
  };
}

function createEditToolEvent(filePath: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: {
      tool: 'edit',
      input: { filePath, oldString: 'old', newString: 'new' },
    },
  };
}

function createBashToolEvent(command: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: {
      tool: 'bash',
      input: { command },
    },
  };
}

function createTaskToolEvent(subagentType: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: {
      tool: 'task',
      input: { subagent_type: subagentType, prompt: 'Do something' },
    },
  };
}

function createTextEvent(text: string, timestamp: number): TimelineEvent {
  return {
    timestamp,
    type: 'text',
    data: { text },
  };
}
