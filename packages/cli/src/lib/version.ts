import pkgJson from '../../package.json' with { type: 'json' }

/** Returns the CLI version from package.json. Synchronous — no I/O. */
export function readCliVersion(): string {
  return pkgJson.version ?? '0.0.0'
}
