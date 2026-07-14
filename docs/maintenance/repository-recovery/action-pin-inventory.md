# GitHub Actions Pin & Permissions Inventory

_Repository-recovery Task 05 — least privilege + immutable action pinning._
_Resolved: 2026-07-15._

## Third-party / external action pins

Every `uses:` reference is pinned to a full 40-character commit SHA, with the
human-readable version retained as a trailing comment. SHAs were resolved via
`gh api repos/<owner>/<repo>/commits/<ref>` on the date above.

| Action | Previous ref | Pinned SHA | Note |
|--------|--------------|------------|------|
| `actions/checkout` | `@v4` (19 uses) | `34e114876b0b11c390a56381ad16ebd13914f8d5` | GitHub-owned |
| `actions/github-script` | `@v7` (6 uses) | `f28e40c7f34bde8b3046d885e986cb6290c5673b` | GitHub-owned |
| `actions/setup-node` | `@v4` (3 uses) | `49933ea5288caeca8642d1e84afbd3f7d6820020` | GitHub-owned |
| `actions/upload-artifact` | `@v4` (1 use) | `ea165f8d65b6e75b540449e92b4886f43607fa02` | GitHub-owned |
| `oven-sh/setup-bun` | `@v2` (1 use) | `0c5077e51419868618aeaa5fe8019c62421857d6` | Matches the SHA already pinned by the other usage |
| `ludeeus/action-shellcheck` | `@master` (1 use) | `00b27aa7cb85167568cb48a3838b75f4265f2bca` | **Was a mutable branch ref** — highest risk before pinning |
| `sst/opencode/github` | `@latest` (1 use) | `77fc88c8ade8e5a620ebbe1197f3a572d29ae91a` | **Was a mutable ref** — freezes the OpenCode agent version; update deliberately |

### Update guidance

To bump a pinned action later: re-resolve the desired tag to its SHA
(`gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`), replace the SHA, and
update the trailing version comment in the same edit. Never revert a pin back to
a floating tag or branch.

## Workflow permissions (least privilege)

Every workflow now declares an explicit top-level `permissions:` block. Default
is `contents: read`; write scopes remain only where a job demonstrably needs them.

| Workflow | Top-level | Job-level writes | Justification |
|----------|-----------|------------------|---------------|
| `pr-checks.yml` | `contents: read` | — | read-only validation |
| `validate-registry.yml` | `contents: read` | — | read-only validation |
| `installer-checks.yml` | `contents: read` **(added)** | — | shellcheck / installer tests, read-only |
| `validate-test-suites.yml` | `contents: read` **(added)** | — | suite validation, read-only |
| `opencode.yml` | `contents: read` **(added)** | `id-token`, `contents`, `pull-requests`, `issues: write` (job) | `/oc` agent, gated to OWNER/MEMBER; job needs write to act on PRs/issues |
| `create-release.yml` | `contents: write` | — | creates tags/releases |
| `post-merge-pr.yml` | `contents: write`, `pull-requests: write` | — | opens follow-up PRs |
| `sync-docs.yml` | `contents: write`, `pull-requests: write`, `issues: write` | — | commits doc branch, opens PR, creates a sync issue (`issues.create`) |
| `update-registry.yml` | `contents: write` | — | commits registry updates |

`issues: write` in `sync-docs.yml` is retained because the workflow calls
`github.rest.issues.create` to open a sync-tracking issue.

## Verification

- All 9 workflow files parse as valid YAML.
- No `uses:` reference remains on a floating tag or branch — all are 40-char SHAs.
- Every workflow has an explicit top-level `permissions:` block.
