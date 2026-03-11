#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliDist = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');
const packageRoot = path.join(__dirname, '..');

if (!fs.existsSync(cliDist)) {
  console.error('Error: OAC CLI not built yet. Run: npm run build -w packages/cli');
  process.exit(1);
}

// On Windows, npm-installed executables are .cmd wrappers — use exact name to resolve them
const isWindows = process.platform === 'win32';
const bunExecutable = isWindows ? 'bun.cmd' : 'bun';

try {
  execFileSync(bunExecutable, [cliDist, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, OAC_PACKAGE_ROOT: packageRoot },
    shell: false,
  });
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('Error: Bun is required to run OAC CLI. Install from https://bun.sh');
    process.exit(1);
  }
  process.exitCode = err.status ?? 1;
}
