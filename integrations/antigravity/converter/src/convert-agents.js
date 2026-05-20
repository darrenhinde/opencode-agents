#!/usr/bin/env node

/**
 * convert-agents.js
 * Converts OpenAgents Control to Gemini Antigravity CLI format
 *
 * Usage: node convert-agents.js
 */

const fs = require('fs');
const path = require('path');

// Configuration - Use absolute paths from the script location
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(path.join(SCRIPT_DIR, '../../../../'));
const SOURCE_DIR = path.join(REPO_ROOT, '.opencode/agent');
const OUTPUT_DIR = path.join(SCRIPT_DIR, '../generated');

const ANTIGRAVITY_AGENTS_DIR = path.join(OUTPUT_DIR, 'agents');
const ANTIGRAVITY_SKILLS_DIR = path.join(OUTPUT_DIR, 'skills');

console.log('🚀 OpenAgents Control → Gemini Antigravity CLI Converter');
console.log(`   Source: ${SOURCE_DIR}`);
console.log(`   Output: ${OUTPUT_DIR}\n`);

/**
 * Parses YAML frontmatter from markdown
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, content };
  
  const yaml = match[1];
  const body = match[2];
  
  const frontmatter = {};
  yaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/"/g, ''));
      }
      
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, body };
}

/**
 * Converts OpenCode frontmatter to Antigravity format
 */
function convertFrontmatter(ocFrontmatter) {
  const antigravity = {};
  
  // Map OpenCode fields to Antigravity fields
  antigravity.name = ocFrontmatter.id || ocFrontmatter.name;
  antigravity.description = ocFrontmatter.description;
  
  // Map tools from OpenCode permissions to Antigravity tools
  if (ocFrontmatter.tools) {
    antigravity.tools = ocFrontmatter.tools;
  } else if (ocFrontmatter.permissions || ocFrontmatter.permission) {
    const perm = ocFrontmatter.permissions || ocFrontmatter.permission;
    const tools = [];
    if (perm.read) tools.push('read_file');
    if (perm.grep) tools.push('grep_search');
    if (perm.glob) tools.push('list_dir');
    if (perm.edit) tools.push('edit_file');
    if (perm.write) tools.push('write_file');
    if (perm.bash) tools.push('run_command');
    
    // Default fallback if no permissions explicitly matched but has some permission key
    if (tools.length === 0) {
      tools.push('read_file', 'grep_search', 'list_dir');
    }
    
    antigravity.tools = tools.join(', ');
  } else {
    // Default safe tool permissions
    antigravity.tools = 'read_file, grep_search, list_dir';
  }
  
  // Map model to user-specified models
  antigravity.model = mapModel(ocFrontmatter.model);
  
  // Map permissionMode (default to 'default' if not specified)
  antigravity.permissionMode = ocFrontmatter.mode === 'subagent' ? 'plan' : 'default';
  
  return antigravity;
}

/**
 * Maps OpenCode model names to Gemini model aliases for Antigravity
 */
function mapModel(model) {
  const modelMap = {
    'opencode/grok-code': 'gemini-3.1-pro',
    'opencode/grok': 'gemini-3.1-pro',
    'gpt-4': 'gemini-3.1-pro',
    'gpt-4o': 'gemini-3.1-pro',
    'sonnet': 'gemini-3.1-pro',
    'haiku': 'gemini-3.5-flash',
  };
  return modelMap[model] || 'gemini-3.1-pro';
}

/**
 * Generates Antigravity markdown from converted data
 */
function generateAntigravityMarkdown(antigravityFrontmatter, body) {
  const fm = Object.entries(antigravityFrontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
      }
      let strVal = String(value);
      if (strVal.startsWith('"') && strVal.endsWith('"')) {
        strVal = strVal.slice(1, -1);
      }
      return `${key}: "${strVal}"`;
    })
    .join('\n');
  
  return `---\n${fm}\n---\n\n${body}`;
}

/**
 * Recursively finds all .md files in a directory
 */
function findMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Processes a single agent file
 */
function processAgent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);
  
  if (!frontmatter) {
    console.log(`⚠️  Skipping ${filePath} (no frontmatter)`);
    return;
  }
  
  const antigravityFrontmatter = convertFrontmatter(frontmatter);
  const antigravityMarkdown = generateAntigravityMarkdown(antigravityFrontmatter, body);
  
  // Determine output path (FLATTENED to level 1 for discovery)
  const filename = path.basename(filePath);
  const outputPath = path.join(ANTIGRAVITY_AGENTS_DIR, filename);
  
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  fs.writeFileSync(outputPath, antigravityMarkdown);
  console.log(`✅ Converted agent: ${filename}`);
}

/**
 * Processes and copies a skill folder
 */
function processSkill(skillMdPath) {
  const skillDir = path.dirname(skillMdPath);
  const skillFolderName = path.basename(skillDir);
  
  const outputSkillDir = path.join(ANTIGRAVITY_SKILLS_DIR, skillFolderName);
  fs.mkdirSync(outputSkillDir, { recursive: true });
  
  // Copy all files in the skill directory
  const files = fs.readdirSync(skillDir);
  files.forEach(file => {
    const srcPath = path.join(skillDir, file);
    const destPath = path.join(outputSkillDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  });
  
  console.log(`✅ Processed skill: ${skillFolderName}`);
}

/**
 * Main conversion function
 */
function convert() {
  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  
  fs.mkdirSync(ANTIGRAVITY_AGENTS_DIR, { recursive: true });
  fs.mkdirSync(ANTIGRAVITY_SKILLS_DIR, { recursive: true });
  
  // Create plugin.json at the plugin root
  const pluginJson = {
    name: "openagents-control-bridge"
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'plugin.json'),
    JSON.stringify(pluginJson, null, 2)
  );
  console.log('📦 Created plugin.json manifest');

  console.log('📦 Converting agents...\n');
  
  // Process category agents
  const agentFiles = findMarkdownFiles(SOURCE_DIR);
  agentFiles.forEach(processAgent);
  
  // Create default context-scout subagent
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

  fs.writeFileSync(
    path.join(ANTIGRAVITY_AGENTS_DIR, 'context-scout.md'),
    contextScoutContent
  );
  console.log('✅ Created context-scout subagent');
  
  console.log('\n📦 Processing skills...\n');
  
  // Find all skill files in .opencode/skills/ and .opencode/skill/
  const skillsDir1 = path.join(REPO_ROOT, '.opencode/skills');
  const skillsDir2 = path.join(REPO_ROOT, '.opencode/skill');
  
  const skillFiles = [];
  
  function findSkillMdFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSkillMdFiles(fullPath);
      } else if (entry.name === 'SKILL.md') {
        skillFiles.push(fullPath);
      }
    }
  }
  
  findSkillMdFiles(skillsDir1);
  findSkillMdFiles(skillsDir2);
  
  skillFiles.forEach(processSkill);
  
  // Create default openagents-control-standards skill
  const skillContent = `---
name: openagents-control-standards
description: Automatically triggers before any task to ensure OpenAgents Control standards and context are loaded. Use when the user asks to create, modify, or analyze anything in this repository.
---

# OpenAgents Control Standards Loader

Before proceeding with the user's request:

1. Call the \`context-scout\` subagent with the user's request to find relevant OpenAgents Control context files.
2. Read the returned "Critical" and "High" priority files using \`read_file\`.
3. Apply the OpenAgents Control standards found to your work.
`;

  const stdSkillDir = path.join(ANTIGRAVITY_SKILLS_DIR, 'openagents-control-standards');
  fs.mkdirSync(stdSkillDir, { recursive: true });
  fs.writeFileSync(
    path.join(stdSkillDir, 'SKILL.md'),
    skillContent
  );
  console.log('✅ Created openagents-control-standards skill');
  
  console.log('\n✨ Conversion complete!');
  console.log(`   Output: ${OUTPUT_DIR}`);
}

// Run conversion
convert();
