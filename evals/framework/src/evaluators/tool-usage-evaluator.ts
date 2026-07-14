/**
 * ToolUsageEvaluator - Checks if appropriate tools are used
 * 
 * Rules:
 * 1. Use specialized tools instead of bash when possible
 * 2. Use Read instead of cat/head/tail
 * 3. Use Edit instead of sed/awk
 * 4. Use Write instead of echo/cat with heredoc
 * 5. Use Glob/Grep instead of find/grep in bash
 * 6. Use List instead of ls
 * 
 * Checks:
 * - Detect bash commands that could use specialized tools
 * - Track which tools are being used correctly
 * - Report warnings for suboptimal tool usage
 */

import { BaseEvaluator } from './base-evaluator.js';
import {
  TimelineEvent,
  SessionInfo,
  EvaluationResult,
  Violation,
  Evidence,
  Check,
  ToolUsageCheck
} from '../types/index.js';

export class ToolUsageEvaluator extends BaseEvaluator {
  name = 'tool-usage';
  description = 'Validates appropriate tool usage over bash alternatives';

  // Patterns for detecting suboptimal bash usage
  // NOTE: grep, rg, npm, git, and other valid bash commands are ALLOWED
  private bashAntiPatterns = [
    {
      pattern: /\bcat\s+([^\s|>]+)(?!\s*[|>])/i,
      tool: 'read',
      message: 'Use Read tool instead of cat for reading files',
      severity: 'error' as const,
      example: 'read(filePath: "path/to/file")'
    },
    { 
      pattern: /\bhead\s+(-n\s*\d+\s+)?([^\s]+)/i, 
      tool: 'read', 
      message: 'Use Read tool with limit parameter instead of head',
      severity: 'warning' as const,
      example: 'read(filePath: "file", limit: 10)'
    },
    { 
      pattern: /\btail\s+(-n\s*\d+\s+)?([^\s]+)/i, 
      tool: 'read', 
      message: 'Use Read tool with offset parameter instead of tail',
      severity: 'warning' as const,
      example: 'read(filePath: "file", offset: -10)'
    },
    {
      pattern: /\bls(\s+|$)/i,
      tool: 'list',
      message: 'Use List tool (or Glob for patterns) instead of ls',
      severity: 'error' as const,
      example: 'list(path: "directory")'
    },
    { 
      pattern: /\bfind\s+.*-name\s+["']?([^"'\s]+)["']?/i, 
      tool: 'glob', 
      message: 'Use Glob tool instead of find for pattern matching',
      severity: 'warning' as const,
      example: 'glob(pattern: "**/*.ts")'
    },
    { 
      pattern: /echo\s+["']?([^"'>]+)["']?\s*>\s*([^\s]+)/i, 
      tool: 'write', 
      message: 'Use Write tool instead of echo redirection',
      severity: 'warning' as const,
      example: 'write(filePath: "file", content: "text")'
    },
    { 
      pattern: /cat\s*<<\s*EOF/i, 
      tool: 'write', 
      message: 'Use Write tool instead of cat with heredoc',
      severity: 'warning' as const,
      example: 'write(filePath: "file", content: "multiline\\ntext")'
    },
    {
      pattern: /\bsed\s+/i,
      tool: 'edit',
      message: 'Use Edit tool instead of sed for file modifications',
      severity: 'warning' as const,
      example: 'edit(filePath: "file", oldString: "old", newString: "new")'
    },
    {
      pattern: /\bawk\s+/i,
      tool: 'edit',
      message: 'Use Edit tool or Read tool instead of awk',
      severity: 'info' as const,
      example: 'read(filePath: "file") then process in code'
    }
  ];
  
  // Allowed bash commands that should NOT be flagged
  private allowedBashCommands = [
    /^\s*grep\s+/i,          // grep is fine (OpenCode docs say to use rg/grep)
    /^\s*rg\s+/i,            // ripgrep is preferred
    /^\s*npm\s+/i,           // npm commands
    /^\s*yarn\s+/i,          // yarn commands
    /^\s*pnpm\s+/i,          // pnpm commands
    /^\s*git\s+/i,           // git commands
    /^\s*node\s+/i,          // node execution
    /^\s*python\s+/i,        // python execution
    /^\s*docker\s+/i,        // docker commands
    /^\s*curl\s+/i,          // API calls
    /^\s*wget\s+/i,          // downloads
    /^\s*mkdir\s+/i,         // directory creation (no specialized tool)
    /^\s*rm\s+/i,            // deletion (requires approval anyway)
    /^\s*mv\s+/i,            // moving files
    /^\s*cp\s+/i,            // copying files
    /^\s*chmod\s+/i,         // permissions
    /^\s*cd\s+/i,            // navigation
    /^\s*pwd\s*/i,           // current directory
    /^\s*which\s+/i,         // command location
    /^\s*echo\s+[^>]+$/i,    // echo to stdout (not redirection)
    /\|/,                    // Any command with pipes is complex bash
  ];

  async evaluate(timeline: TimelineEvent[], sessionInfo: SessionInfo): Promise<EvaluationResult> {
    const checks: Check[] = [];
    const violations: Violation[] = [];
    const evidence: Evidence[] = [];

    // Get all bash tool calls
    const bashCalls = this.getToolCallsByName(timeline, 'bash');

    if (bashCalls.length === 0) {
      // No bash calls - perfect tool usage
      checks.push({
        name: 'no-bash-usage',
        passed: true,
        weight: 100,
        evidence: [
          this.createEvidence(
            'tool-usage',
            'No bash commands used - specialized tools preferred',
            { bashCallCount: 0 }
          )
        ]
      });

      return this.buildResult(this.name, checks, violations, evidence, {
        bashCallCount: 0,
        toolUsageChecks: []
      });
    }

    // Check each bash call for anti-patterns
    const toolUsageChecks: ToolUsageCheck[] = [];

    for (const bashCall of bashCalls) {
      const command = bashCall.data?.input?.command || '';
      const antiPattern = this.detectAntiPattern(command);

      const check: ToolUsageCheck = {
        correctToolUsed: !antiPattern,
        evidence: []
      };

      if (antiPattern) {
        const suggestion = this.generateSuggestion(command, antiPattern);
        
        check.toolUsed = 'bash';
        check.expectedTool = antiPattern.tool;
        check.reason = antiPattern.message;
        check.evidence.push(
          `Command: ${command}`,
          `Issue: ${antiPattern.message}`,
          `Suggested tool: ${antiPattern.tool}`,
          `Better approach: ${suggestion}`
        );

        // Add check (failed)
        checks.push({
          name: `tool-usage-${bashCall.timestamp}`,
          passed: false,
          weight: 100 / bashCalls.length,
          evidence: check.evidence.map(e =>
            this.createEvidence('suboptimal-tool', e, { 
              command, 
              suggestedTool: antiPattern.tool,
              example: antiPattern.example 
            })
          )
        });

        // Add violation with appropriate severity
        violations.push(
          this.createViolation(
            `bash-antipattern-${antiPattern.tool}`,
            antiPattern.severity,
            antiPattern.message,
            bashCall.timestamp,
            {
              command,
              suggestedTool: antiPattern.tool,
              actualTool: 'bash',
              example: antiPattern.example
            }
          )
        );
      } else {
        check.toolUsed = 'bash';
        check.evidence.push(
          `Command: ${command}`,
          `Appropriate bash usage (no specialized tool alternative)`
        );

        // Add check (passed)
        checks.push({
          name: `tool-usage-${bashCall.timestamp}`,
          passed: true,
          weight: 100 / bashCalls.length,
          evidence: check.evidence.map(e =>
            this.createEvidence('appropriate-tool', e, { command })
          )
        });
      }

      toolUsageChecks.push(check);
    }

    // Add general evidence
    evidence.push(
      this.createEvidence(
        'bash-calls',
        `${bashCalls.length} bash commands analyzed`,
        {
          bashCallCount: bashCalls.length,
          commands: bashCalls.map(call => call.data?.input?.command)
        }
      )
    );

    const antiPatternCount = toolUsageChecks.filter(c => !c.correctToolUsed).length;
    evidence.push(
      this.createEvidence(
        'anti-patterns',
        `${antiPatternCount} suboptimal tool usage patterns detected`,
        {
          antiPatternCount,
          totalBashCalls: bashCalls.length,
          percentage: Math.round((antiPatternCount / bashCalls.length) * 100)
        }
      )
    );

    return this.buildResult(this.name, checks, violations, evidence, {
      bashCallCount: bashCalls.length,
      antiPatternCount,
      toolUsageChecks
    });
  }

  /**
   * Detect anti-patterns in bash commands
   */
  private detectAntiPattern(command: string): { 
    pattern: RegExp; 
    tool: string; 
    message: string; 
    severity: 'error' | 'warning' | 'info';
    example: string;
  } | null {
    // First check if this is an allowed bash command
    for (const allowed of this.allowedBashCommands) {
      if (allowed.test(command)) {
        return null; // This is fine, not an anti-pattern
      }
    }
    
    // Then check for anti-patterns
    for (const antiPattern of this.bashAntiPatterns) {
      if (antiPattern.pattern.test(command)) {
        return antiPattern;
      }
    }
    return null;
  }

  /**
   * Generate a specific suggestion for a command
   */
  private generateSuggestion(command: string, antiPattern: { tool: string; example: string }): string {
    // Try to extract file path from command
    const fileMatch = command.match(/["']?([^\s"']+\.[a-z]+)["']?/i);
    const filePath = fileMatch ? fileMatch[1] : 'path/to/file';
    
    // Generate context-specific example
    switch (antiPattern.tool) {
      case 'read':
        if (command.includes('head')) {
          const limitMatch = command.match(/-n\s*(\d+)/);
          const limit = limitMatch ? limitMatch[1] : '10';
          return `read(filePath: "${filePath}", limit: ${limit})`;
        } else if (command.includes('tail')) {
          return `read(filePath: "${filePath}", offset: -10)`;
        }
        return `read(filePath: "${filePath}")`;
      
      case 'write':
        const contentMatch = command.match(/echo\s+["']?([^"'>]+)["']?/);
        const content = contentMatch ? contentMatch[1] : 'content';
        return `write(filePath: "${filePath}", content: "${content}")`;
      
      case 'list':
        const dirMatch = command.match(/ls\s+([^\s]+)/);
        const dir = dirMatch ? dirMatch[1] : '.';
        return `list(path: "${dir}")`;
      
      case 'glob':
        const patternMatch = command.match(/-name\s+["']?([^"'\s]+)["']?/);
        const pattern = patternMatch ? patternMatch[1] : '*.ts';
        return `glob(pattern: "**/${pattern}")`;
      
      case 'grep':
        const searchMatch = command.match(/grep\s+["']?([^"'\s]+)["']?/);
        const search = searchMatch ? searchMatch[1] : 'pattern';
        return `grep(pattern: "${search}", path: ".")`;
      
      case 'edit':
        return `edit(filePath: "${filePath}", oldString: "old", newString: "new")`;
      
      default:
        return antiPattern.example;
    }
  }
}
