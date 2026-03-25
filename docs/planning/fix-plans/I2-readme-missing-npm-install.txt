ISSUE: README missing npm install instructions
SEVERITY: Important
FILE(S): README.md

CURRENT STATE:
README.md Quick Start section (lines 116-139) shows only curl-based install:

  ## 🚀 Quick Start

  **Prerequisites:** [OpenCode CLI](https://opencode.ai/docs) (free, open-source) • Bash 3.2+ • Git

  ### Step 1: Install

  **One command:**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
  ```

  <sub>The installer will set up OpenCode CLI if you don't have it yet.</sub>

  **Or interactive:**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh
  bash install.sh
  ```

  ### Keep Updated

  ```bash
  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/update.sh | bash
  ```

There is zero mention of:
  - npm install -g @nextsystems/oac
  - npx @nextsystems/oac init
  - Bun as a prerequisite for the npm install path
  - The CLI commands available after install

ROOT CAUSE:
The README was written before the npm CLI package existed. The curl/bash install
path was the original distribution mechanism. The npm package is new and the
README was not updated to reflect it.

FIX:
Add a new "Install via npm" section BEFORE the existing curl section in Quick Start.
This should be the PRIMARY install method since it is the standard for CLI tools.

Insert the following markdown block immediately after the `## 🚀 Quick Start`
heading and before the `**Prerequisites:**` line:

---BEGIN INSERT---

## 🚀 Quick Start

### Install via npm (recommended)

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.0 • Node.js ≥ 18

> ⚠️ **Bun is required.** The OAC CLI runs on the [Bun](https://bun.sh) runtime.
> Install Bun first: `curl -fsSL https://bun.sh/install | bash`

**Global install (use `oac` anywhere):**
```bash
npm install -g @nextsystems/oac
```

**Then set up a project:**
```bash
cd your-project
oac init
```

**No-install (try without committing):**
```bash
npx @nextsystems/oac init
```

**Keep updated:**
```bash
npm update -g @nextsystems/oac
# or check your current version:
oac doctor
```

---

### Install via curl (alternative)

**Prerequisites:** [OpenCode CLI](https://opencode.ai/docs) (free, open-source) • Bash 3.2+ • Git

---END INSERT---

The existing curl section content follows unchanged after this point.

FULL DIFF CONTEXT — where to insert in README.md:

BEFORE (line 116 onwards):
  ## 🚀 Quick Start

  **Prerequisites:** [OpenCode CLI](https://opencode.ai/docs) (free, open-source) • Bash 3.2+ • Git

  ### Step 1: Install

  **One command:**

  ```bash
  curl -fsSL https://...

AFTER:
  ## 🚀 Quick Start

  ### Install via npm (recommended)

  **Prerequisites:** [Bun](https://bun.sh) ≥ 1.0 • Node.js ≥ 18

  > ⚠️ **Bun is required.** The OAC CLI runs on the [Bun](https://bun.sh) runtime.
  > Install Bun first: `curl -fsSL https://bun.sh/install | bash`

  **Global install (use `oac` anywhere):**
  ```bash
  npm install -g @nextsystems/oac
  ```

  **Then set up a project:**
  ```bash
  cd your-project
  oac init
  ```

  **No-install (try without committing):**
  ```bash
  npx @nextsystems/oac init
  ```

  **Keep updated:**
  ```bash
  npm update -g @nextsystems/oac
  # or check your current version:
  oac doctor
  ```

  ---

  ### Install via curl (alternative)

  **Prerequisites:** [OpenCode CLI](https://opencode.ai/docs) (free, open-source) • Bash 3.2+ • Git

  ### Step 1: Install

  **One command:**

  ```bash
  curl -fsSL https://...

VALIDATION:
1. Render the README (GitHub preview or `npx markdown-preview README.md`)
2. Confirm the npm install section appears before the curl section
3. Confirm the Bun prerequisite warning is visible
4. Confirm all code blocks are syntactically correct (no unclosed backticks)
5. Click the bun.sh link and verify it resolves

DEPENDENCIES: C1, C2, C6 (npm package must be publishable before advertising npm install)
