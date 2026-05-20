#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Dynamically resolve the project root relative to the script location (scripts/setup-gemini-bridge.js)
const projectRoot = path.join(__dirname, '..');
const opencodeDir = path.join(projectRoot, '.opencode');

if (!fs.existsSync(opencodeDir)) {
  console.error('❌ Error: This does not appear to be an OpenCode project (no .opencode directory found).');
  process.exit(1);
}

const agentsDir = path.join(projectRoot, '.agents');
const agentsSkillsDir = path.join(agentsDir, 'skills');
const agentsAgentsDir = path.join(agentsDir, 'agents');
const pluginDir = path.join(agentsDir, 'plugins', 'openagents-control-bridge');

console.log('🔗 Setting up OpenAgents Control (OAC) to Antigravity Bridge...');

// Helper: Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper: Remove directory/file/symlink recursively
function cleanTarget(targetPath) {
  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(targetPath);
    } else if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  } else {
    // If it is a broken symlink, fs.existsSync returns false but we still need to delete it
    try {
      const stat = fs.lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(targetPath);
      }
    } catch (e) {
      // Ignore errors for non-existent targets
    }
  }
}

// Clean and recreate main directories
cleanTarget(agentsSkillsDir);
cleanTarget(agentsAgentsDir);
cleanTarget(path.join(agentsDir, 'plugins'));

ensureDir(agentsSkillsDir);
ensureDir(agentsAgentsDir);
ensureDir(pluginDir);

// ============================================================================
// 1. Bridge Skills (.opencode/skills/ and .opencode/skill/ -> .agents/skills/)
// ============================================================================
console.log('\n🔮 Bridging OAC Skills...');
const opencodeSkillsDirs = [
  path.join(opencodeDir, 'skills'),
  path.join(opencodeDir, 'skill')
];

opencodeSkillsDirs.forEach(srcSkillsDir => {
  if (!fs.existsSync(srcSkillsDir)) return;
  
  const skills = fs.readdirSync(srcSkillsDir);
  skills.forEach(skillName => {
    const srcPath = path.join(srcSkillsDir, skillName);
    const stat = fs.statSync(srcPath);
    if (!stat.isDirectory()) return;
    
    const destPath = path.join(agentsSkillsDir, skillName);
    
    // Clean old bridge entry if it exists
    cleanTarget(destPath);
    
    // Create relative symlink for clean git-sharing
    const relPath = path.relative(path.dirname(destPath), srcPath);
    fs.symlinkSync(relPath, destPath, 'dir');
    console.log(`  ✓ Skill: ${skillName} ──► .agents/skills/${skillName}`);
  });
});

// ============================================================================
// 2. Bridge Commands (.opencode/command/ -> .agents/skills/)
// ============================================================================
console.log('\n⚡ Bridging OAC Commands (as Antigravity Skills)...');
const srcCommandsDir = path.join(opencodeDir, 'command');

if (fs.existsSync(srcCommandsDir)) {
  function scanCommands(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const resPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanCommands(resPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const commandName = path.basename(entry.name, '.md');
        const destSkillDir = path.join(agentsSkillsDir, commandName);
        const destSkillFile = path.join(destSkillDir, 'SKILL.md');
        
        cleanTarget(destSkillDir);
        ensureDir(destSkillDir);
        
        // Read the command file to check/inject YAML name parameter
        let content = fs.readFileSync(resPath, 'utf8');
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
        const match = content.match(frontmatterRegex);
        
        if (match) {
          const yamlBlock = match[1];
          if (!yamlBlock.includes('name:')) {
            const updatedYaml = `name: ${commandName}\n${yamlBlock}`;
            content = content.replace(frontmatterRegex, `---\n${updatedYaml}\n---`);
            fs.writeFileSync(resPath, content, 'utf8');
            console.log(`  ✓ Added 'name: ${commandName}' frontmatter to original command ${entry.name}`);
          }
        } else {
          content = `---\nname: ${commandName}\ndescription: OAC command converted to Antigravity skill\n---\n\n${content}`;
          fs.writeFileSync(resPath, content, 'utf8');
          console.log(`  ✓ Added default frontmatter to original command ${entry.name}`);
        }
        
        // Create symlink from command markdown file to SKILL.md
        const relPath = path.relative(path.dirname(destSkillFile), resPath);
        fs.symlinkSync(relPath, destSkillFile, 'file');
        console.log(`  ✓ Command: ${commandName} ──► .agents/skills/${commandName}/SKILL.md`);
      }
    }
  }
  
  scanCommands(srcCommandsDir);
}

// ============================================================================
// 3. Bridge Agents (.opencode/agent/ -> .agents/agents/)
// ============================================================================
console.log('\n🤖 Bridging OAC Custom Agents...');
const srcAgentsDir = path.join(opencodeDir, 'agent');

if (fs.existsSync(srcAgentsDir)) {
  function scanAgents(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const resPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanAgents(resPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const agentName = path.basename(entry.name, '.md');
        const destAgentFile = path.join(agentsAgentsDir, entry.name);
        
        // Read file and parse/update frontmatter in-place
        let content = fs.readFileSync(resPath, 'utf8');
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
        const match = content.match(frontmatterRegex);
        
        if (match) {
          const yamlBlock = match[1];
          let updatedYaml = yamlBlock;
          
          if (!yamlBlock.includes('name:')) {
            updatedYaml = `name: ${agentName}\n${updatedYaml}`;
          }
          if (!yamlBlock.includes('model:')) {
            updatedYaml = `${updatedYaml}\nmodel: gemini-3.1-pro`;
          }
          if (!yamlBlock.includes('tools:')) {
            const tools = ['read_file', 'grep_search', 'list_dir'];
            const hasBash = yamlBlock.includes('bash:') && !yamlBlock.includes('bash:\n    "*": "deny"') && !yamlBlock.includes('bash:\r\n    "*": "deny"');
            const hasEdit = yamlBlock.includes('edit:') && !yamlBlock.includes('edit:\n    "*": "deny"') && !yamlBlock.includes('edit:\r\n    "*": "deny"');
            const hasWrite = yamlBlock.includes('write:') && !yamlBlock.includes('write:\n    "*": "deny"') && !yamlBlock.includes('write:\r\n    "*": "deny"');
            
            if (hasBash) tools.push('run_command');
            if (hasEdit) tools.push('replace_file_content');
            if (hasWrite) tools.push('write_to_file');
            
            updatedYaml = `${updatedYaml}\ntools: ${tools.join(', ')}`;
          }
          
          if (updatedYaml !== yamlBlock) {
            content = content.replace(frontmatterRegex, `---\n${updatedYaml}\n---`);
            fs.writeFileSync(resPath, content, 'utf8');
            console.log(`  ✓ Updated frontmatter in original agent ${entry.name}`);
          }
        }
        
        // Clean old bridge entry
        cleanTarget(destAgentFile);
        
        // Create symlink
        const relPath = path.relative(path.dirname(destAgentFile), resPath);
        fs.symlinkSync(relPath, destAgentFile, 'file');
        console.log(`  ✓ Agent: ${entry.name} ──► .agents/agents/${entry.name}`);
      }
    }
  }
  
  scanAgents(srcAgentsDir);
}

// ============================================================================
// 4. Inject Custom Antigravity Skills & Agents
// ============================================================================
console.log('\n🌟 Creating Antigravity-specific Helpers...');

// 4a. context-scout subagent
const contextScoutPath = path.join(agentsAgentsDir, 'context-scout.md');
const contextScoutContent = `---
name: context-scout
description: Discovers and recommends OpenAgents Control context files using list_dir, read_file, and grep_search tools. Use when you need to find OpenAgents Control standards, guides, or domain knowledge in the .opencode/context directory.
tools: read_file, grep_search, list_dir
model: gemini-3.5-flash
permissionMode: plan
---

# ContextScout

You discover and recommend relevant OpenAgents Control context files from \`.opencode/context/\` based on the user's request.

## Your Process

1. Use \`list_dir\` or custom glob tools to find files in \`.opencode/context/\`.
2. Use \`read_file\` or \`grep_search\` to verify relevance.
3. Return file paths with brief descriptions.
`;
fs.writeFileSync(contextScoutPath, contextScoutContent, 'utf8');
console.log(`  ✓ Created context-scout subagent ──► .agents/agents/context-scout.md`);

// 4b. openagents-control-standards skill
const stdSkillDir = path.join(agentsSkillsDir, 'openagents-control-standards');
ensureDir(stdSkillDir);
const stdSkillPath = path.join(stdSkillDir, 'SKILL.md');
const stdSkillContent = `---
name: openagents-control-standards
description: Automatically triggers before any task to ensure OpenAgents Control standards and context are loaded. Use when the user asks to create, modify, or analyze anything in this repository.
---

# OpenAgents Control Standards Loader

Before proceeding with the user's request:

1. Call the \`context-scout\` subagent with the user's request to find relevant OpenAgents Control context files.
2. Read the returned "Critical" and "High" priority files using \`read_file\`.
3. Apply the OpenAgents Control standards found to your work.
`;
fs.writeFileSync(stdSkillPath, stdSkillContent, 'utf8');
console.log(`  ✓ Created openagents-control-standards skill ──► .agents/skills/openagents-control-standards/SKILL.md`);

// ============================================================================
// 5. Structure the Plugin using Relative Symlinks
// ============================================================================
console.log('\n🔌 Configuring the Workspace Plugin...');

// plugin.json
const pluginJsonPath = path.join(pluginDir, 'plugin.json');
fs.writeFileSync(
  pluginJsonPath,
  JSON.stringify({ name: 'openagents-control-bridge' }, null, 2),
  'utf8'
);
console.log(`  ✓ Created plugin.json manifest`);

// Symlink skills
const pluginSkillsLink = path.join(pluginDir, 'skills');
cleanTarget(pluginSkillsLink);
fs.symlinkSync(path.relative(path.dirname(pluginSkillsLink), agentsSkillsDir), pluginSkillsLink, 'dir');
console.log(`  ✓ Symlinked plugin skills ──► .agents/plugins/openagents-control-bridge/skills`);

// Symlink agents
const pluginAgentsLink = path.join(pluginDir, 'agents');
cleanTarget(pluginAgentsLink);
fs.symlinkSync(path.relative(path.dirname(pluginAgentsLink), agentsAgentsDir), pluginAgentsLink, 'dir');
console.log(`  ✓ Symlinked plugin agents ──► .agents/plugins/openagents-control-bridge/agents`);

console.log('\n🎉 OAC-to-Antigravity Bridge created successfully!');
console.log('✓ All changes are reference-based (via relative symlinks).');
console.log('✓ The original .opencode/ folder structure remains pristine.');
console.log('✓ Ready for both OpenCode and Google Antigravity!');
