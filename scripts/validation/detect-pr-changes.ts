#!/usr/bin/env bun

import { appendFile } from 'node:fs/promises'

export type ChangeFlags = {
  'has-evals': boolean
  'has-docs': boolean
  'has-workflows': boolean
}

export function parseChangedPaths(input: string): string[] {
  return input.split('\0').filter((path) => path.length > 0)
}

export function classifyChangedPaths(paths: readonly string[]): ChangeFlags {
  return {
    'has-evals': paths.some((path) => path.startsWith('evals/')),
    'has-docs': paths.some((path) => path.startsWith('docs/')),
    'has-workflows': paths.some((path) => path.startsWith('.github/workflows/')),
  }
}

export function formatGitHubOutput(flags: ChangeFlags): string {
  return [
    `has-evals=${flags['has-evals']}`,
    `has-docs=${flags['has-docs']}`,
    `has-workflows=${flags['has-workflows']}`,
  ].join('\n') + '\n'
}

async function main(): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required but was not set')

  const paths = parseChangedPaths(await Bun.stdin.text())
  const output = formatGitHubOutput(classifyChangedPaths(paths))

  await appendFile(outputPath, output, 'utf8').catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to append change detection outputs to GITHUB_OUTPUT (${outputPath}): ${message}`)
  })
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`detect-pr-changes: ${message}`)
    process.exitCode = 1
  })
}
