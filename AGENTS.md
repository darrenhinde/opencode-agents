

This repository defines task-focused agents to streamline planning, implementation, review, documentation, and testing.

Agents:

- `general`: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks
- `reviewer`: Code review, security, and quality assurance agent
- `subagents/codebase-pattern-analyst`: TypeScript implementation agent for modular and functional development
- `subagents/coder-agent`: Executes coding subtasks in sequence, ensuring completion as specified
- `subagents/build-agent`: Type check and build validation agent
- `subagents/tester`: Test authoring and TDD agent
- `subagents/documentation`: Documentation authoring agent
- `@task-manager`: Task planning and management agent
- `@tester`: Test execution and validation agent
- `@documentation`: Documentation generation and updates agent

Usage:

```bash
# Launch a task with a specific agent
task --description "Short task description" --prompt "Detailed task instructions" --subagent_type general

# Example for code review
task --description "Review code" --prompt "Review the changes in pull request #123" --subagent_type reviewer
```

Safety:

- Repo-level `permissions.json` sets baseline rules; per-agent `permissions` apply tighter, task-specific restrictions.

Approval-first workflow:

- Each agent begins by proposing a short plan and asks for approval before proceeding.
- Per-agent `permissions` enforce tighter rules than repo defaults.


