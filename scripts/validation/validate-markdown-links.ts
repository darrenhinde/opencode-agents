#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKIP_RULES_FILE = join(REPO_ROOT, 'scripts', 'validation', 'markdown-link-skip-patterns.txt')
const TARGET_DIRS = [
  '.opencode/agent',
  '.opencode/skills',
  '.opencode/command',
  '.opencode/context'
]

type MissingRef = {
  source: string
  line: number
  target: string
  resolved: string
  kind: 'link' | 'path'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseRegexRule(rule: string): RegExp {
  const trimmed = rule.trim()

  if (trimmed.startsWith('/') && trimmed.length > 2) {
    const lastSlash = trimmed.lastIndexOf('/')
    if (lastSlash > 0) {
      const pattern = trimmed.slice(1, lastSlash)
      const flags = trimmed.slice(lastSlash + 1)
      return new RegExp(pattern, flags)
    }
  }

  return new RegExp(trimmed)
}

function loadSkipPatterns(): RegExp[] {
  if (!existsSync(SKIP_RULES_FILE)) {
    throw new Error(`Skip rules file not found: ${SKIP_RULES_FILE}`)
  }

  const lines = readFileSync(SKIP_RULES_FILE, 'utf-8').split('\n')
  const patterns: RegExp[] = []

  for (const line of lines) {
    const rule = line.trim()
    if (!rule || rule.startsWith('#')) continue

    // Literal rule: literal:foo/bar
    if (rule.startsWith('literal:')) {
      const literal = rule.slice('literal:'.length).trim()
      if (!literal) continue
      patterns.push(new RegExp(escapeRegExp(literal)))
      continue
    }

    patterns.push(parseRegexRule(rule))
  }

  return patterns
}

function shouldSkipFile(filePath: string, skipPatterns: RegExp[]): boolean {
  const relPath = filePath.replace(`${REPO_ROOT}/`, '')
  return skipPatterns.some((pattern) => pattern.test(relPath))
}

function walkMdFiles(dir: string, out: string[], skipPatterns: RegExp[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'build') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkMdFiles(full, out, skipPatterns)
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      if (!shouldSkipFile(full, skipPatterns)) {
        out.push(full)
      }
    }
  }
}

function lineFromIndex(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function shouldSkip(rawTarget: string, skipPatterns: RegExp[]): boolean {
  const value = rawTarget.trim()
  if (!value) return true
  if (value.startsWith('http://') || value.startsWith('https://')) return true
  if (value.startsWith('mailto:') || value.startsWith('#')) return true
  return skipPatterns.some((pattern) => pattern.test(value))
}

function cleanupTarget(rawTarget: string): string {
  let target = rawTarget.trim()
  if (!target) return target

  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1)
  }

  const firstSpace = target.indexOf(' ')
  if (firstSpace >= 0) {
    target = target.slice(0, firstSpace)
  }

  target = target.replace(/^@/, '')
  target = target.split('#')[0]
  target = target.split('?')[0]
  return target
}

function resolveTarget(sourceFile: string, rawTarget: string): string {
  const target = cleanupTarget(rawTarget)
  if (target.startsWith('.opencode/')) return join(REPO_ROOT, target)
  if (target.startsWith('/')) return join(REPO_ROOT, target.slice(1))
  return join(dirname(sourceFile), target)
}

function collectMissingRefs(file: string, skipPatterns: RegExp[]): MissingRef[] {
  const content = readFileSync(file, 'utf-8')
  const rel = file.replace(`${REPO_ROOT}/`, '')
  const missing: MissingRef[] = []

  const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g
  for (const match of content.matchAll(linkRegex)) {
    const rawTarget = match[1]
    if (!rawTarget) continue
    if (shouldSkip(rawTarget, skipPatterns)) continue

    const cleaned = cleanupTarget(rawTarget)
    if (!cleaned) continue
    if (!cleaned.includes('.md') && !cleaned.startsWith('.opencode/')) continue

    const resolved = normalize(resolveTarget(file, cleaned))
    if (!existsSync(resolved)) {
      missing.push({
        source: rel,
        line: lineFromIndex(content, match.index ?? 0),
        target: rawTarget,
        resolved: resolved.replace(`${REPO_ROOT}/`, ''),
        kind: 'link',
      })
    }
  }

  const pathRegex = /@?(\.opencode\/[A-Za-z0-9_./-]+\.md)/g
  for (const match of content.matchAll(pathRegex)) {
    const rawTarget = match[1]
    if (!rawTarget) continue
    if (shouldSkip(rawTarget, skipPatterns)) continue

    const cleaned = cleanupTarget(rawTarget)
    const resolved = normalize(resolveTarget(file, cleaned))
    if (!existsSync(resolved)) {
      missing.push({
        source: rel,
        line: lineFromIndex(content, match.index ?? 0),
        target: rawTarget,
        resolved: resolved.replace(`${REPO_ROOT}/`, ''),
        kind: 'path',
      })
    }
  }

  return missing
}

function dedupe(refs: MissingRef[]): MissingRef[] {
  const seen = new Set<string>()
  const out: MissingRef[] = []
  for (const ref of refs) {
    const key = `${ref.source}:${ref.line}:${ref.target}:${ref.kind}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref)
  }
  return out
}

const skipPatterns = loadSkipPatterns()

const files: string[] = []
for (const dir of TARGET_DIRS) {
  const absolute = join(REPO_ROOT, dir)
  if (existsSync(absolute)) walkMdFiles(absolute, files, skipPatterns)
}

let missing: MissingRef[] = []
for (const file of files) {
  missing = missing.concat(collectMissingRefs(file, skipPatterns))
}

missing = dedupe(missing)

if (missing.length === 0) {
  console.log(`OK: validated ${files.length} markdown files, no broken internal references found.`)
  process.exit(0)
}

console.log(`ERROR: found ${missing.length} broken internal markdown references:`)
for (const ref of missing) {
  console.log(`- ${ref.source}:${ref.line} [${ref.kind}] ${ref.target} -> ${ref.resolved}`)
}

process.exit(1)
