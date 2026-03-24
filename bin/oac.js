#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliDist = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');

if (!fs.existsSync(cliDist)) {
  console.error('Error: OAC CLI not built yet. Run: npm run build -w packages/cli');
  process.exit(1);
}

try {
  execFileSync('bun', [cliDist, ...process.argv.slice(2)], { stdio: 'inherit' });
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('Error: Bun is required to run OAC CLI. Install from https://bun.sh');
    process.exit(1);
  }
  process.exitCode = err.status ?? 1;
}
