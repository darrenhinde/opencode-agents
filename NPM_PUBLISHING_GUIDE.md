# NPM Publishing Guide for @openagents/control

## 📦 Package Information

- **Package Name**: `@openagents/control`
- **Current Version**: 0.7.0
- **Package Size**: 610KB (2.4MB unpacked)
- **Total Files**: 353
- **CLI Command**: `oac`

## ✅ What's Been Done

### 1. Package Configuration
- ✅ Updated `package.json` with scoped package name `@openagents/control`
- ✅ Removed `"private": true` to allow publishing
- ✅ Added `bin` field to create the `oac` CLI command
- ✅ Added `files` field to control what gets published
- ✅ Added proper keywords for discoverability
- ✅ Added `engines` field (Node.js >= 14.0.0)
- ✅ Added `bugs` and `homepage` URLs

### 2. Files Included in Package
- ✅ `.opencode/` directory (agents, commands, context, profiles, skills, tools)
- ✅ `scripts/` directory (installation and utility scripts)
- ✅ `bin/` directory (CLI entry point)
- ✅ `registry.json` (component registry)
- ✅ `install.sh` (main installer)
- ✅ Documentation files (README, CHANGELOG, LICENSE, etc.)
- ✅ **Excluded**: node_modules, evals, dev files, .tmp, etc.

### 3. CLI Entry Point
- ✅ Created `bin/oac.js` - Node.js wrapper that runs `install.sh`
- ✅ Made executable with proper shebang
- ✅ Handles `--help`, `--version`, and profile arguments
- ✅ Shows helpful usage information

### 4. Ignore Files
- ✅ Created `.npmignore` to exclude development files
- ✅ Configured to exclude node_modules everywhere
- ✅ Keeps essential files only

## 🚀 How to Publish

### Step 1: Login to npm
```bash
npm login
```
You'll need:
- npm username
- npm password
- npm email
- 2FA code (if enabled - **highly recommended**)

### Step 2: Enable 2FA (Recommended)
```bash
npm profile enable-2fa auth-and-writes
```
This protects your `@openagents` scope from hijacking.

### Step 3: Test the Package Locally (Optional but Recommended)
```bash
# Install the package globally from the tarball
npm install -g ./openagents-control-0.7.0.tgz

# Test the CLI
oac --version
oac --help

# Uninstall after testing
npm uninstall -g @openagents/control
```

### Step 4: Publish to npm
```bash
# For scoped packages, you need to specify public access
npm publish --access public
```

### Step 5: Verify Publication
```bash
# Check if it's published
npm view @openagents/control

# Try installing it
npm install -g @openagents/control

# Test it works
oac --version
```

## 📝 Post-Publishing Checklist

- [ ] Verify package appears on npmjs.com: https://www.npmjs.com/package/@openagents/control
- [ ] Test installation: `npm install -g @openagents/control`
- [ ] Test CLI works: `oac --version` and `oac --help`
- [ ] Update README.md with npm installation instructions
- [ ] Create a GitHub release with tag `v0.7.0`
- [ ] Announce on social media / community

## 📚 User Installation

Once published, users can install with:

```bash
# Global installation (recommended)
npm install -g @openagents/control

# Then run
oac developer
```

Or use npx without installing:
```bash
npx @openagents/control developer
```

## 🔄 Future Updates

### To publish a new version:

1. **Update version**:
   ```bash
   npm version patch  # 0.7.0 -> 0.7.1
   npm version minor  # 0.7.0 -> 0.8.0
   npm version major  # 0.7.0 -> 1.0.0
   ```

2. **Update VERSION file**:
   ```bash
   node -p "require('./package.json').version" > VERSION
   ```

3. **Update CHANGELOG.md** with changes

4. **Commit changes**:
   ```bash
   git add package.json VERSION CHANGELOG.md
   git commit -m "chore: bump version to vX.X.X"
   git push
   ```

5. **Publish**:
   ```bash
   npm publish --access public
   ```

6. **Create GitHub release**:
   ```bash
   git tag vX.X.X
   git push --tags
   ```

## 🔐 Security Notes

### Protecting Your Scope
- ✅ The `@openagents` scope is automatically created when you publish your first package
- ✅ Only your npm account can publish packages under `@openagents/`
- ✅ Enable 2FA to prevent account hijacking
- ✅ Use strong, unique password for npm account

### Publishing Other Packages
Once you own `@openagents`, you can publish:
- `@openagents/abilities`
- `@openagents/core`
- `@openagents/cli`
- etc.

## 🐛 Troubleshooting

### "You must verify your email"
```bash
npm profile get
# Follow the verification link sent to your email
```

### "You do not have permission to publish"
```bash
# Make sure you're logged in
npm whoami

# Make sure you use --access public for scoped packages
npm publish --access public
```

### "Package name too similar to existing package"
This shouldn't happen with scoped packages, but if it does, choose a different name.

### "Version already exists"
```bash
# Bump the version
npm version patch
npm publish --access public
```

## 📊 Package Stats

After publishing, you can track:
- Downloads: https://npm-stat.com/charts.html?package=@openagents/control
- Bundle size: https://bundlephobia.com/package/@openagents/control
- Package health: https://snyk.io/advisor/npm-package/@openagents/control

## 🎉 Success Criteria

Your package is successfully published when:
- ✅ `npm view @openagents/control` shows package info
- ✅ `npm install -g @openagents/control` installs without errors
- ✅ `oac --version` shows correct version
- ✅ `oac developer` runs the installer
- ✅ Package appears on https://www.npmjs.com/package/@openagents/control

---

**Ready to publish?** Run `npm publish --access public` when you're ready! 🚀
