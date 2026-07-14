# CI Threat Model and Baseline

**Date:** 2026-07-14
**Scope:** GitHub Actions, repository security settings, and required checks
**Status:** Baseline only — no security fix is implemented by this document

## Security Objective

Pull requests must be able to test contributor code without giving that code repository write access, secrets, identity tokens, or a path into later privileged jobs. Trusted automation must use narrowly scoped permissions and must not silently bypass review.

## Threat Actors

- A malicious external contributor opening a fork pull request.
- A compromised contributor, maintainer, bot, action publisher, or dependency.
- A well-intentioned contributor whose workflow or script has unsafe side effects.
- An attacker posting crafted issue or PR comments to trigger automation.
- A compromised upstream action referenced by a mutable tag or branch.

## Protected Assets

- `GITHUB_TOKEN` write permissions and repository contents.
- Pull requests, issues, releases, tags, branches, and rulesets.
- `ANTHROPIC_API_KEY`, `OPENCODE_API_KEY`, and any repository secrets.
- OIDC identity available through `id-token: write`.
- Published npm packages, release artifacts, registry data, and generated documentation.
- Maintainer trust and the integrity of `main`.

## Trust Boundaries

1. **Fork pull-request code is untrusted.** Repository scripts, package manifests, lockfiles, actions, generated files, and artifacts from the fork are attacker-controlled.
2. **Default-branch code is trusted only after review.** A merge can still introduce compromised automation.
3. **Third-party actions are external code.** Mutable tags and branches can change after review.
4. **Artifacts and caches cross job boundaries.** Data from an untrusted job must never become executable input to a privileged job.
5. **Comments and workflow inputs are untrusted strings.** Authorization checks do not make their content safe for shell interpolation.
6. **GitHub settings are part of the security boundary.** Safe workflow files are insufficient if default token permissions and rulesets remain weak.

## Critical Untrusted Execution Path

`.github/workflows/validate-registry.yml` currently creates a direct privileged path:

1. It runs on `pull_request_target` (`lines 21–29`).
2. It grants `contents: write` and `pull-requests: write` (`lines 42–44`).
3. It checks out the pull request head repository and branch (`lines 78–87`).
4. It runs `bun install` using the contributor-controlled lockfile/package graph (`lines 120–124`).
5. It executes contributor-controlled shell and TypeScript files (`lines 126–248`).
6. The same job retains its write-capable token while running this code.

**Impact:** A malicious fork can attempt arbitrary code execution with a repository write token. Fork-specific logic later in the job does not remove the token or undo earlier execution.

**Required remediation direction:** Move untrusted validation to a `pull_request` workflow with `contents: read` and no secrets. If a `pull_request_target` workflow remains, it must be metadata-only and must never check out or execute the contributor head.

## Workflow Inventory

| Workflow | Trigger | Current privilege or secret | Baseline concern |
|---|---|---|---|
| `validate-registry.yml` | `pull_request_target`, manual | Contents and PR write | **Critical:** executes fork code with write token |
| `pr-checks.yml` | Pull request | Implicit defaults | Output names do not match values written; relevant builds are skipped |
| `installer-checks.yml` | Pull request, push, manual | Implicit defaults | Mutable `action-shellcheck@master`; final status ignores compatibility/profile failures |
| `validate-test-suites.yml` | Pull request, push, manual | Implicit defaults; PR comment attempt | No explicit permissions; artifact contents originate from PR code |
| `update-registry.yml` | Push to `main`, manual | Contents write | Direct push to `main`; validation failure only warns; generated change bypasses PR review |
| `sync-docs.yml` | Push to `main`, manual | Contents, PR, and issues write | Broad workflow-level permissions; creates branches/issues and deletes branches on failure |
| `post-merge-pr.yml` | Push to `main`, manual | Contents and PR write | Broad workflow-level permissions; creates version branches and PRs |
| `create-release.yml` | Push to `main`, manual | Contents write | Tag/release authority; actions are tag-pinned rather than SHA-pinned |
| `opencode.yml` | Issue comment | OIDC, contents, PR, issues write; Anthropic key | `sst/opencode/github@latest` is mutable and receives powerful credentials |
| `evals/run-evaluations.yml` | Schedule, push to `main`, manual | OpenCode API key | User-supplied workflow inputs reach a shell command without a strict allowlist |

## Confirmed Configuration Baseline

Read-only GitHub API inspection on 2026-07-14 reported:

- Default workflow token permission: **write**.
- Actions may approve pull-request reviews: **enabled**.
- Allowed actions: **all**.
- Full-SHA pinning requirement: **disabled**.
- Fork workflow approval policy: **first-time contributors only**.
- Private vulnerability reporting: **disabled**.
- CodeQL default setup: **not configured**.
- Dependabot security updates: **disabled**.
- Secret scanning: **enabled**.
- Secret scanning push protection: **enabled**.
- Automatic branch deletion after merge: **disabled**.
- No classic branch protection rule; an active repository ruleset protects `main`.

### Active `main` ruleset

- Pull requests are required.
- Required approving reviews: **0**.
- Code-owner review: **not required**.
- Latest-push approval: **not required**.
- Conversation resolution: **not required**.
- Strict up-to-date status checks: **disabled**.
- Only required check: `validate-and-update`.
- No bypass actors are configured.

The only required check is the workflow containing the critical `pull_request_target` vulnerability.

## PR Check Correctness

`.github/workflows/pr-checks.yml` declares:

```yaml
has-evals: ${{ steps.filter.outputs.evals }}
has-docs: ${{ steps.filter.outputs.docs }}
has-workflows: ${{ steps.filter.outputs.workflows }}
```

The `filter` step actually writes `has-evals`, `has-docs`, and `has-workflows`. Therefore dependent jobs can see empty outputs and skip required validation. The workflow builds and validates eval suites but does not run Vitest.

## Action Pinning Baseline

Current workflows use mutable references including:

- `sst/opencode/github@latest`
- `ludeeus/action-shellcheck@master`
- Major-version tags such as `actions/checkout@v4`, `actions/setup-node@v4`, `actions/github-script@v7`, `actions/upload-artifact@v4`, and `oven-sh/setup-bun@v2`

Current repository settings neither restrict allowed actions nor require full commit SHA pinning.

## Additional High-Risk Findings

### Registry writes after validation failure

`update-registry.yml` validates generated registry state but intentionally does not fail on an invalid registry. It can then commit and push directly to `main` using `[skip ci]`.

### Installer summary can report false success

`installer-checks.yml` displays compatibility and profile results, but its final `FAILED` calculation checks only shellcheck, syntax, non-interactive, and end-to-end jobs.

### Comment-triggered privileged AI action

`opencode.yml` limits triggers to repository owners/members, but gives a mutable third-party action an API key, OIDC, and write access to contents, PRs, and issues. A compromised action version would inherit all of them.

### Missing governance files

The repository currently has no:

- Root `SECURITY.md`.
- `.github/CODEOWNERS`.
- `.github/dependabot.yml`.

## Target Security Invariants

The implementation tasks following this baseline must establish:

1. Untrusted PR code runs only with read permissions and no secrets.
2. Privileged workflows never execute or source untrusted code or artifacts.
3. Workflow and job permissions are explicitly declared and minimized.
4. External actions are pinned to reviewed full commit SHAs.
5. Registry and documentation generators create reviewed PRs instead of pushing unvalidated changes directly.
6. Required checks exercise the behavior affected by a PR and cannot report success after a required job fails.
7. Security-sensitive workflow changes require code-owner review.
8. Vulnerability reporters have a private channel and documented response expectations.
9. Dependency and code-scanning results participate in merge protection where available.

## Reproducible Static Inspection

These commands are read-only:

```bash
# Locate privileged triggers, permissions, secrets, and mutable actions
rg -n 'pull_request_target|workflow_run|issue_comment|permissions:|contents: write|pull-requests: write|id-token: write|secrets\.|uses:.*@(main|master|latest|v[0-9]+)' .github/workflows

# Inspect PR output wiring
rg -n 'has-evals|outputs\.evals|has-docs|outputs\.docs|has-workflows|outputs\.workflows' .github/workflows/pr-checks.yml

# Validate YAML syntax with Ruby's safe parser
ruby -e 'require "yaml"; Dir[".github/workflows/*.{yml,yaml}"].each { |f| YAML.safe_load(File.read(f), aliases: true); puts f }'

# Inspect repository-side security settings
gh api repos/darrenhinde/OpenAgentsControl/actions/permissions/workflow
gh api repos/darrenhinde/OpenAgentsControl/actions/permissions
gh api repos/darrenhinde/OpenAgentsControl/actions/permissions/fork-pr-contributor-approval
gh api repos/darrenhinde/OpenAgentsControl/rulesets
gh api repos/darrenhinde/OpenAgentsControl/private-vulnerability-reporting
gh api repos/darrenhinde/OpenAgentsControl/code-scanning/default-setup
```

## Validation for This Baseline

- Confirm every active workflow is represented in the inventory.
- Confirm cited line ranges against current files.
- Run Markdown internal-link validation.
- Run `git diff --check`.
- Do not alter workflows or GitHub settings in this task.

## References

- [Secure use of `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub Actions permission syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions)
- [Adding a repository security policy](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository)
- [Configuring private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository)
