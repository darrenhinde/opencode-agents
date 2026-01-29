<div align="center">

![OpenAgents Control Hero](docs/images/hero-image.png)

# OpenAgents Control (AOC)

[![GitHub stars](https://img.shields.io/github/stars/darrenhinde/OpenAgentsControl?style=flat-square&logo=github&labelColor=black&color=ffcb47)](https://github.com/darrenhinde/OpenAgentsControl/stargazers)
[![X Follow](https://img.shields.io/twitter/follow/DarrenBuildsAI?style=flat-square&logo=x&labelColor=black&color=1DA1F2)](https://x.com/DarrenBuildsAI)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=flat-square&labelColor=black)](https://opensource.org/licenses/MIT)
[![Last Commit](https://img.shields.io/github/last-commit/darrenhinde/OpenAgentsControl?style=flat-square&labelColor=black&color=8957e5)](https://github.com/darrenhinde/OpenAgentsControl/commits/main)

[🚀 Quick Start](#-get-started-in-5-minutes) • [📖 Docs](docs/) • [🎥 Demo](https://youtu.be/EOIzFMdmox8) • [💬 Community](https://nextsystems.ai)

</div>

---

## AI agents use 10,000 tokens to generate code you'll spend 2 hours refactoring

**The paradox:** The more code they generate, the more time you waste.

**Why?** They don't know YOUR codebase. They write generic code. You rewrite it to match your patterns.

**OpenAgents Control flips this:** Agents learn your patterns first. They propose plans. You approve. They execute.

**Result:** Code that ships to production without refactoring. From 3 iterations to 1. From 15 minutes to 2.

---

## What Is AOC? (Read This First!)

**AOC is a scaffold system, not a plugin.** Think of it as a fully exposed, configurable AI agent framework where YOU control everything.

### The Key Difference

| Oh My OpenCode | OpenAgents Control |
|----------------|-------------------|
| Plugin approach | Scaffold approach |
| Hidden configuration | Fully exposed |
| "Just works" out of box | Requires setup & customization |
| Autonomous loops | Approval-based workflow |
| Best for: Quick automation | Best for: Production code with your standards |

### What This Means for You

✅ **You get full control** - Edit agent behavior, add your patterns, customize everything  
✅ **Agents follow YOUR rules** - Your coding standards, your architecture, your way  
✅ **Transparent system** - See exactly how agents think and make decisions  

⚠️ **You need to configure it** - Add your patterns, customize agents for your needs  
⚠️ **Not plug-and-play** - Requires understanding and adjustment  

**If you want "just works" autonomous AI:** Try [Oh My OpenCode](https://github.com/darrenhinde/OpenAgentsControl/discussions/116) instead.

**If you want full control over AI behavior:** You're in the right place. Keep reading.

---

## 🎯 The Secret Weapon: Context System

**This is what makes AOC different.** Context files = your project's DNA. They tell agents how YOU write code.

### How It Works

```
Your Request → Agent loads YOUR patterns → Code matches YOUR style automatically
```

**Example:** `~/.opencode/context/project/project-context.md`
```markdown
## React Patterns
- Use functional components (not classes)
- Use Tailwind CSS (not CSS modules)
- Use shadcn/ui components

## API Patterns
- Use tRPC (not REST)
- Use Drizzle ORM (not Prisma)
```

**Without context:** Agent creates generic code → Doesn't match your project ❌  
**With context:** Agent loads your patterns → Code matches your style ✅

**Get started:** Edit `~/.opencode/context/project/project-context.md` and add your patterns.

[Complete Context System Guide →](CONTEXT_SYSTEM_GUIDE.md)

---

## 🎛️ Configure Models Per Agent (Common Question!)

**By default, all agents use your OpenCode default model.** Want different agents to use different models? Here's how:

### Quick Setup

**1. Find your model ID:** Visit [models.dev](https://models.dev/?search=open)

**2. Edit the agent file:**
```bash
nano ~/.opencode/agent/core/opencoder.md
```

**3. Change the frontmatter:**
```yaml
---
description: "Development specialist"
model: anthropic/claude-sonnet-4-20250514  # ← Change this
temperature: 0.1
---
```

**Format:** `provider/model-id`

### Examples

**Use Sonnet for main coding:**
```yaml
model: anthropic/claude-sonnet-4-20250514
```

**Use Opus for complex features:**
```yaml
model: anthropic/claude-opus-4-20250514
```

**Use GPT for testing:**
```yaml
model: openai/gpt-5.2
```

**Use Gemini Flash for speed:**
```yaml
model: google/gemini-2.0-flash
```

### Common Configurations

**OpenCoder (main development):**
```yaml
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
```

**TestEngineer (testing):**
```yaml
model: openai/gpt-5.2
temperature: 0.2
```

**CodeReviewer (review):**
```yaml
model: anthropic/claude-opus-4-20250514
temperature: 0.1
```

**DocWriter (documentation):**
```yaml
model: google/gemini-2.0-flash
temperature: 0.3
```

**That's it!** Agents will use the configured model automatically.

[See all available models →](https://models.dev/?search=open)

---

## 🚀 Get Started in 5 Minutes

**One command. That's it.**

```bash
# Quick install (developer profile)
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

**Then start building:**
```bash
opencode --agent OpenAgent
> "Create a user authentication system"
```

**What happens:**
1. Agent analyzes your request
2. Proposes a plan (you approve)
3. Executes step-by-step with validation
4. Delegates to specialists when needed
5. Ships production-ready code

**That's the entire workflow.** No complex setup required to start.

---

## ✅ First-Time User Checklist

After installation, follow these steps:

1. ✅ **Try it out** - Run `opencode --agent OpenAgent` and build something simple
2. ✅ **Add your patterns** - Edit `~/.opencode/context/project/project-context.md` with your coding standards
3. ✅ **Customize agents** (optional) - Edit `~/.opencode/agent/core/opencoder.md` to add project-specific rules
4. ✅ **Configure models** (optional) - Change `model:` in agent frontmatter to use different models per agent
5. ✅ **Build a real feature** - Use `opencode --agent OpenCoder` for production code

**Most users only need steps 1-2 to be productive.**

---

## 📦 Installation

### Prerequisites
- **OpenCode CLI** - [Install here](https://opencode.ai/docs)
- **Bash 3.2+** (macOS default works)
- **Git** (for cloning)

### Install AOC

**Recommended: One-line install**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

**Alternative: Interactive installer**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh
bash install.sh
```

**Manual install**
```bash
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl
mkdir -p ~/.opencode
cp -r .opencode/agent ~/.opencode/
cp -r .opencode/command ~/.opencode/
cp -r .opencode/context ~/.opencode/
```

### Start Using It
```bash
opencode --agent OpenAgent
> "Create a user authentication system"
```

---

## ⚙️ How It Works

```
User Request
    ↓
┌───────────────────────────────────────┐
│  Main Agents (User-Facing)           │
├───────────────────────────────────────┤
│  openagent     │ General tasks        │
│  opencoder     │ Complex coding       │
│  system-builder│ AI system generation │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Specialized Subagents                │
├───────────────────────────────────────┤
│  Core:         task-manager, docs     │
│  Code:         coder, tester, reviewer│
│  Utils:        image-specialist       │
│  Meta:         domain-analyzer, etc.  │
└───────────────────────────────────────┘
```

**The workflow:**
1. **You describe** what you want to build
2. **Agent plans** the implementation steps
3. **You approve** the plan
4. **Agent implements** incrementally with validation
5. **Quality checks** run automatically (tests, types, linting)
6. **Subagents handle** specialized tasks (testing, review, docs)

**Context-aware:** Agents automatically load patterns from `.opencode/context/` to follow your coding standards.

---

## 🎨 Customizing Agents (Beyond Model Configuration)

Agents are markdown files. Edit them to change behavior, add project rules, or customize communication style.

### Quick Customization

**Edit an agent:**
```bash
nano ~/.opencode/agent/core/opencoder.md
```

**Add project-specific rules:**
```markdown
## Project Rules
- Always use TypeScript strict mode
- Prefer functional components in React
- Use Tailwind for styling (no CSS modules)

## Tech Stack
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL with Drizzle ORM
- Auth: Better Auth
- Styling: Tailwind + shadcn/ui

## Communication Style
- Be concise and direct
- Focus on practical solutions
- Always explain trade-offs
```

**Per-project agents:** Create `.opencode/agent/` in your project to override global agents.

```bash
# Create project-specific agent
mkdir -p .opencode/agent/core
cp ~/.opencode/agent/core/opencoder.md .opencode/agent/core/opencoder.md
nano .opencode/agent/core/opencoder.md
```

Project agents override global agents automatically.

---

## What's Included

### 🤖 Main Agents (3 core agents)
- **OpenCoder** - Development specialist for production code
- **OpenAgent** - Universal coordinator for general tasks
- **SystemBuilder** - Generate complete custom AI systems

### 🔧 Specialized Subagents (Auto-delegated)
- **task-manager** - Breaks complex features into atomic subtasks
- **coder-agent** - Focused code implementations
- **tester** - Test authoring and TDD
- **reviewer** - Code review and security analysis
- **build-agent** - Type checking and build validation
- **documentation** - Documentation generation
- Plus category specialists: frontend, devops, copywriter, technical-writer, data-analyst

### ⚡ Commands
- `/commit` - Smart git commits
- `/test` - Testing workflows
- `/optimize` - Code optimization
- `/context` - Context management
- And 7+ more productivity commands

### 📚 Context System
Your coding standards automatically loaded by agents:
- Code quality and security patterns
- UI/design system standards
- Task management workflows
- External library integration guides
- Your project-specific patterns

---

## Example Workflows

### Build a Full-Stack Feature
```bash
opencode --agent OpenCoder
> "Create a user dashboard with authentication and profile settings"

# OpenCoder will:
# 1. Load your context (auth patterns, code standards)
# 2. Propose detailed implementation plan
# 3. Wait for your approval
# 4. Execute incrementally with validation
# 5. Delegate to specialists (tester, reviewer)
# 6. Ship production-ready code
```

### Configure Different Models
```bash
# Edit OpenCoder to use Sonnet
nano ~/.opencode/agent/core/opencoder.md
# Change: model: anthropic/claude-sonnet-4-20250514

# Edit TestEngineer to use GPT
nano ~/.opencode/agent/subagents/code/tester.md
# Change: model: openai/gpt-5.2

# Edit DocWriter to use Gemini Flash
nano ~/.opencode/agent/subagents/core/documentation.md
# Change: model: google/gemini-2.0-flash
```

### Add Your Patterns
```bash
# Edit your project context
nano ~/.opencode/context/project/project-context.md

# Add your patterns:
## API Endpoint Pattern
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  // Your standard pattern
}
```

# Agents will automatically use these patterns!
```

---

## Recommended for New Users

**Start with `OpenAgent`** - lightweight and versatile, perfect for learning the system.

```bash
opencode --agent OpenAgent
> "Create a user authentication system"            # Building features
> "How do I implement authentication in Next.js?"  # Questions
> "Create a README for this project"               # Documentation
```

**Ready for production?** Upgrade to `OpenCoder`:

```bash
opencode --agent OpenCoder
> "Create a user authentication system"                 # Full-stack features
> "Refactor this codebase to use dependency injection"  # Multi-file refactoring
> "Add real-time notifications with WebSockets"         # Complex implementations
```

**Learn more:** 
- [OpenAgent Guide](docs/agents/openagent.md)
- [OpenCoder Guide](docs/agents/opencoder.md)

---

## FAQ

### Setup & Configuration

**Q: How do I configure models per agent?**  
A: Edit the agent file (`~/.opencode/agent/core/opencoder.md`) and change the `model:` line in frontmatter. Format: `provider/model-id`. Find models at [models.dev](https://models.dev/?search=open).

**Q: Is this like Oh My OpenCode?**  
A: No. AOC is a scaffold system (fully exposed, requires configuration). Oh My OpenCode is a plugin (hidden config, "just works"). See [detailed comparison](https://github.com/darrenhinde/OpenAgentsControl/discussions/116).

**Q: Do I need to configure everything?**  
A: No. It works out of the box with your OpenCode default model. Configure only if you want different models per agent or custom behavior.

**Q: Where do I add my coding patterns?**  
A: Edit `~/.opencode/context/project/project-context.md` - agents automatically load this file.

**Q: Can I customize agent behavior?**  
A: Yes! Agents are markdown files. Edit them to add project rules, change communication style, or adjust workflows.

### Comparison

**Q: How does OpenAgentsControl compare to Oh My OpenCode?**  
A: **[Read the detailed comparison →](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)**

| Feature | AOC | Oh My OpenCode |
|---------|-----|----------------|
| **Approach** | Scaffold (exposed) | Plugin (hidden) |
| **Agent Behavior** | Editable markdown files | Baked into code |
| **Execution** | Approval gates | Autonomous loops |
| **Configuration** | Required | Optional |
| **Best For** | Control & repeatability | Autonomy & speed |

Choose based on your workflow: control & customization (AOC) vs. autonomy & simplicity (Oh My OpenCode).

### Technical

**Q: What languages are supported?**  
A: All languages (TypeScript, Python, Go, Rust, etc.). Agents adapt based on your project files.

**Q: Does this work on Windows?**  
A: Yes! Use Git Bash (recommended) or WSL.

**Q: What bash version do I need?**  
A: Bash 3.2+ (macOS default works).

---

## Contributing

We welcome contributions! See [Contributing Guide](docs/contributing/CONTRIBUTING.md) for details.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Made with ❤️ by developers, for developers. Star the repo if this helped you ship better code!**

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/darrenhinde/OpenAgentsControl?style=social)](https://github.com/darrenhinde/OpenAgentsControl/stargazers)
[![YouTube](https://img.shields.io/badge/YouTube-Darren_Builds_AI-red?style=flat-square&logo=youtube)](https://youtube.com/@DarrenBuildsAI)
[![Community](https://img.shields.io/badge/Community-NextSystems.ai-blue?style=flat-square)](https://nextsystems.ai)
[![X/Twitter](https://img.shields.io/badge/Follow-@DarrenBuildsAI-1DA1F2?style=flat-square&logo=x)](https://x.com/DarrenBuildsAI)

</div>
