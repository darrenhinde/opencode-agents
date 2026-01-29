#!/usr/bin/env node

/**
 * OpenAgents Control (OAC) CLI
 * 
 * This is the main entry point for the @openagents/control package.
 * It runs the install.sh script to set up the OpenAgents Control system.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the package root directory
const packageRoot = path.join(__dirname, '..');

// Path to install.sh
const installScript = path.join(packageRoot, 'install.sh');

// Check if install.sh exists
if (!fs.existsSync(installScript)) {
  console.error('Error: install.sh not found at', installScript);
  process.exit(1);
}

// Get command line arguments (skip node and script path)
const args = process.argv.slice(2);

// If no arguments provided, show help
if (args.length === 0) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  OpenAgents Control (OAC)                     ║
║   AI agent framework for plan-first development workflows     ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  oac [profile]           Install with a specific profile
  oac --help             Show this help message
  oac --version          Show version information

Available Profiles:
  essential              Minimal setup (OpenAgent only)
  developer              Full development setup (recommended)
  business               Business-focused agents
  advanced               Advanced features and specialists
  full                   Everything included

Examples:
  oac                    Interactive installation
  oac developer          Install with developer profile
  oac --help            Show detailed help

For more information, visit:
  https://github.com/darrenhinde/OpenAgentsControl
`);
  process.exit(0);
}

// Handle --version flag
if (args.includes('--version') || args.includes('-v')) {
  const packageJson = require(path.join(packageRoot, 'package.json'));
  console.log(`@openagents/control v${packageJson.version}`);
  process.exit(0);
}

// Handle --help flag
if (args.includes('--help') || args.includes('-h')) {
  // Run install.sh with --help
  args.push('--help');
}

// Run the install script with bash
const child = spawn('bash', [installScript, ...args], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    OAC_PACKAGE_ROOT: packageRoot
  }
});

child.on('error', (error) => {
  console.error('Error running install script:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
