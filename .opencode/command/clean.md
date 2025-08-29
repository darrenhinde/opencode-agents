---
description: Clean the codebase or current working task in focus via Prettier, Import Sorter, ESLint, and TypeScript Compiler
agent: build
model: anthropic/claude-3-5-sonnet-20241022
---

# Code Quality Cleanup

Prepares code for review and builds by cleaning up the specified files or directories. If no arguments are provided, cleans the current working task currently in focus.

## What This Command Does

1. **Remove Debug Code**: Strips out console.log, debugger statements, and temporary debugging code
2. **Format Code**: Runs Prettier to ensure consistent formatting if in the codebase
3. **Organize Imports**: Sorts and removes unused imports
4. **Fix Linting Issues**: Resolves ESLint errors and warnings
5. **Type Check**: Validates TypeScript types and fixes obvious type issues
6. **Condense Comments**: Simplifies overly verbose comments while preserving important documentation

## Usage
