/**
 * Unit tests for enhanced ToolUsageEvaluator
 * 
 * Tests the new pattern detection and suggestion features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolUsageEvaluator } from '../tool-usage-evaluator.js';
import type { TimelineEvent, SessionInfo } from '../../types/index.js';

describe('ToolUsageEvaluator - Enhanced Features', () => {
  let evaluator: ToolUsageEvaluator;
  let mockSessionInfo: SessionInfo;

  beforeEach(() => {
    evaluator = new ToolUsageEvaluator();
    mockSessionInfo = {
      id: 'test-session',
      version: '1.0',
      title: 'Test Session',
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    };
  });

  describe('Enhanced Pattern Detection', () => {
    it('should detect sed usage and suggest edit tool', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'sed -i "s/old/new/g" file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('bash-antipattern-edit');
      expect(result.violations[0].evidence.suggestedTool).toBe('edit');
    });

    it('should detect awk usage and suggest alternatives', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'awk \'{print $1}\' file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].evidence.suggestedTool).toBe('edit');
    });

    it('should allow grep commands (grep is valid bash)', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'grep "pattern" file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      // grep is allowed in bash per OpenCode docs
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should allow grep -r (recursive grep is valid bash)', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'grep -r "pattern" src/' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      // Should pass - recursive grep is allowed
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });

  describe('Contextual Suggestions', () => {
    it('should provide specific suggestion for head command', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'head -n 20 file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      const evidence = result.violations[0]?.evidence;
      expect(evidence.example).toContain('limit');
    });

    it('should provide specific suggestion for tail command', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'tail -n 10 file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      const evidence = result.violations[0]?.evidence;
      expect(evidence.example).toContain('offset');
    });

    it('should provide specific suggestion for echo redirection', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'echo "hello world" > output.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      const evidence = result.violations[0]?.evidence;
      expect(evidence.suggestedTool).toBe('write');
      expect(evidence.example).toContain('write');
    });

    it('should provide specific suggestion for find command', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'find . -name "*.ts"' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      const evidence = result.violations[0]?.evidence;
      expect(evidence.suggestedTool).toBe('glob');
      expect(evidence.example).toContain('glob');
    });
  });

  describe('Severity Levels', () => {
    it('should use error severity for cat usage', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'cat file.txt' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].type).toBe('bash-antipattern-read');
      expect(result.passed).toBe(false);
    });

    it('should use error severity for ls usage', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'ls src/' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].type).toBe('bash-antipattern-list');
      expect(result.passed).toBe(false);
    });
  });

  describe('Allowed Bash Commands', () => {
    it('should allow npm commands', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'npm install' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should allow git commands', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'git status' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
    });

    it('should allow piped commands', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'cat file.txt | grep pattern' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
    });

    it('should flag ls -la as a dedicated-listing-tool violation', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'ls -la' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('bash-antipattern-list');
    });

    it('should allow echo to stdout (no redirection)', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'echo "hello"' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('Multiple Commands', () => {
    it('should detect multiple anti-patterns', async () => {
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'cat file1.txt' },
          },
        },
        {
          timestamp: 2000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'head file2.txt' },
          },
        },
        {
          timestamp: 3000,
          type: 'tool_call',
          data: {
            tool: 'bash',
            input: { command: 'npm install' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.metadata?.antiPatternCount).toBe(2); // cat and head
      expect(result.metadata?.bashCallCount).toBe(3);
    });
  });
});
