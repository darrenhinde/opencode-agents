#!/usr/bin/env node

import { Command } from 'commander'
import { readCliVersion } from './lib/version.js'
import { checkForUpdate } from './lib/update-check.js'

const program = new Command()

program
  .name('oac')
  .description('OpenAgents Control — install, manage, and update AI agents and context files')
  .version(readCliVersion(), '-v, --version', 'Print version and exit')
  .addHelpText('after', `
Examples:
  $ oac init                    Set up OAC in the current project
  $ oac update                  Update OAC files (skips files you modified)
  $ oac update --dry-run        Preview what would be updated
  $ oac doctor                  Check your setup and report issues
  $ oac add agent:openagent     Add a specific agent from the registry
  $ oac apply cursor            Generate Cursor IDE rules file
  $ oac clean --dry-run         Preview what oac clean would remove

Docs: https://github.com/darrenhinde/OpenAgentsControl#readme
`)

// Restore terminal state on Ctrl-C or kill signal
// Exit codes follow Unix convention: 128 + signal number
process.on('SIGINT', () => process.exit(130))   // 128 + 2 (SIGINT)
process.on('SIGTERM', () => process.exit(143))  // 128 + 15 (SIGTERM)

// Lazy-load command modules in parallel — keeps startup < 100ms
async function main(): Promise<void> {
  // Fast path: --version only — --help needs all commands registered first
  const args = process.argv.slice(2)
  const isFastPath =
    args.includes('--version') || args.includes('-v')

  if (isFastPath) {
    await program.parseAsync(process.argv)
    return
  }

  const [
    { registerInitCommand },
    { registerUpdateCommand },
    { registerAddCommand },
    { registerApplyCommand },
    { registerDoctorCommand },
    { registerListCommand },
    { registerStatusCommand },
    { registerCleanCommand },
  ] = await Promise.all([
    import('./commands/init.js'),
    import('./commands/update.js'),
    import('./commands/add.js'),
    import('./commands/apply.js'),
    import('./commands/doctor.js'),
    import('./commands/list.js'),
    import('./commands/status.js'),
    import('./commands/clean.js'),
  ])

  registerInitCommand(program)
  registerUpdateCommand(program)
  registerAddCommand(program) // also registers `remove`
  registerApplyCommand(program)
  registerDoctorCommand(program)
  registerListCommand(program)
  registerStatusCommand(program)
  registerCleanCommand(program)

  // Unknown commands: print a helpful error and exit 1
  program.on('command:*', (operands: string[]) => {
    console.error(`error: unknown command '${operands[0]}'\n`)
    console.error(`Run 'oac --help' to see available commands.`)
    process.exitCode = 1
  })

  // Print help when no command is given — must happen before update check
  // so we don't fire a background fetch that gets abandoned on process.exit()
  if (args.length === 0) {
    program.help() // exits the process
  }

  await program.parseAsync(process.argv)

  // Non-blocking update check — runs after command completes, max once per 24h
  // void: intentionally not awaited — failure must never affect exit code
  // Note: skipped on --version fast path (returns before reaching this line)
  void checkForUpdate()
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
