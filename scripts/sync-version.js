#!/usr/bin/env node
'use strict';
const fs = require('fs');
const root = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const cliPkgPath = './packages/cli/package.json';
const cliPkg = JSON.parse(fs.readFileSync(cliPkgPath, 'utf8'));
cliPkg.version = root.version;
fs.writeFileSync(cliPkgPath, JSON.stringify(cliPkg, null, 2) + '\n');
console.log(`Synced packages/cli version to ${root.version}`);
