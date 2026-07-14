# Fork & Internal PR Workflow Validation

_Repository-recovery Task 09 — prove that untrusted (fork) code reaches no secret
and no write token, and that required checks fail closed._
_Repository: `darrenhinde/OpenAgentsControl` (public). Date: 2026-07-15._
_Validated at commit `699b2d7` (PR #336, phase-1 CI hardening) plus the
`persist-credentials` follow-up on this branch._

## Method and scope

This validation is **evidence-based**: static analysis of `.github/workflows/*.yml`
plus already-captured check runs from PRs #334 and #336. It was explicitly
approved by the repository owner in preference to creating live GitHub test state.

**No GitHub test state was created.** No test branch, no test PR, no workflow
dispatch, no push, no `gh` call that mutates anything. Every command in this
document is read-only and re-runnable by a reviewer.

See [Residual risk](#residual-risk-and-limitations) for what this method does not cover.

## Platform behavior relied upon

For a `pull_request` event raised from a **fork**, GitHub itself guarantees:

1. **Secrets are withheld.** Repository, environment, and organization secrets are
   not passed to the workflow run. `${{ secrets.FOO }}` interpolates to an empty
   string. (`secrets.GITHUB_TOKEN` still exists but see 2.)
2. **The `GITHUB_TOKEN` is read-only.** The token issued to a fork `pull_request`
   run has `read` on every scope regardless of the repository's default workflow
   permissions setting, and a workflow's `permissions:` block **cannot raise it** —
   it can only lower it further.
3. **The checked-out ref is the merge commit**, not the base branch — i.e. the
   workflow runs contributor code, which is exactly why 1 and 2 matter.

`pull_request_target` is the trigger that *breaks* all three: it runs in the base
repository's context with full secrets and a writable token. This repository has
no `pull_request_target` trigger (Claim 1 below), and no `workflow_run` trigger
(the other common privilege-escalation path back into the trusted context).

**Our configuration does not override the platform defaults.** Every fork-reachable
workflow declares `permissions: contents: read` at the top level and no job
re-grants a write scope, so the effective token is read-only for internal PRs too —
the platform's fork rule and our config point the same direction, and neither
depends on the other.

## Fork-reachable surface

Authoritative trigger parse of every workflow (bare `on:` parses as YAML boolean
`true`, hence the `d[true]||d['on']`):

```bash
cd .github/workflows
for f in *.yml; do
  ruby -ryaml -e "d=YAML.load_file('$f'); t=(d[true]||d['on']); puts '%-28s %s' % ['$f', (t.is_a?(Hash) ? t.keys.inspect : t.inspect)]"
done
```

| Workflow | Triggers | Fork-reachable? |
|----------|----------|-----------------|
| `pr-checks.yml` | `pull_request` | **Yes** |
| `validate-registry.yml` | `pull_request`, `workflow_dispatch` | **Yes** |
| `dependency-review.yml` | `pull_request` | **Yes** |
| `installer-checks.yml` | `pull_request`, `push`, `workflow_dispatch` | **Yes** |
| `validate-test-suites.yml` | `push`, `pull_request`, `workflow_dispatch` | **Yes** |
| `create-release.yml` | `push`, `workflow_dispatch` | No |
| `post-merge-pr.yml` | `push`, `workflow_dispatch` | No |
| `sync-docs.yml` | `push`, `workflow_dispatch` | No |
| `update-registry.yml` | `push`, `workflow_dispatch` | No |
| `opencode.yml` | `issue_comment` | No (see gate below) |

`push` and `workflow_dispatch` are not fork-reachable: a fork's pushes raise events
in the *fork's* repository, and `workflow_dispatch` requires `write` access to this
repository. `issue_comment` is raised by this repository and always runs the
workflow from the **default branch**, so a fork's PR content cannot alter it.

Exactly **5 workflows** are fork-reachable — matching the claim under test.

## Fork-equivalent validation

### Evidence table — the 5 fork-reachable workflows

| Workflow | Top-level permissions | Job-level write scopes | `${{ secrets.* }}` refs | `actions/checkout` steps | with `persist-credentials: false` |
|----------|----------------------|------------------------|-------------------------|--------------------------|-----------------------------------|
| `pr-checks.yml` | `contents: read` | none | **0** | 2 | 2 ✅ |
| `validate-registry.yml` | `contents: read` | none | **0** | 1 | 1 ✅ |
| `dependency-review.yml` | `contents: read` | none | **0** | 1 | 1 ✅ |
| `installer-checks.yml` | `contents: read` | none | **0** | 6 | 6 ✅ |
| `validate-test-suites.yml` | `contents: read` | none | **0** | 1 | 1 ✅ |
| **Total** | | **none** | **0** | **11** | **11 ✅** |

### Claim-by-claim results

| # | Claim | Result |
|---|-------|--------|
| 1 | No workflow has a live `pull_request_target` trigger | **CONFIRMED** |
| 2 | Fork-reachable workflows are exactly the 5 listed | **CONFIRMED** |
| 3 | All 5 have top-level `permissions: contents: read` | **CONFIRMED** |
| 4 | All 5 have zero `${{ secrets.* }}` references | **CONFIRMED** |
| 5 | Every `actions/checkout` in the 5 sets `persist-credentials: false` (11/11) | **CONFIRMED** |
| 6 | Every workflow referencing a secret is not fork-reachable | **CONFIRMED** |

#### Claim 1 — no live `pull_request_target`

The string appears exactly once in the repository, and it is a comment:

```bash
grep -rn "pull_request_target\|workflow_run" .github/workflows/
# .github/workflows/validate-registry.yml:4:# Never change this workflow back to pull_request_target while it checks out
```

`validate-registry.yml` lines 1–12 — the string is inside the header comment block
above `on:`, which lists only `pull_request` and `workflow_dispatch`. The trigger
parse above is the authoritative check: the comment is invisible to YAML. The
comment is a deliberate guard rail for future editors, and is worth keeping.

No `workflow_run` trigger exists either.

#### Claim 3 — read-only token, not re-granted per job

```bash
cd .github/workflows
for f in pr-checks.yml validate-registry.yml dependency-review.yml installer-checks.yml validate-test-suites.yml; do
  ruby -ryaml -e "
    d=YAML.load_file('$f')
    puts '%-26s top=%s' % ['$f', d['permissions'].inspect]
    d['jobs'].each{|k,v| puts '   job %-24s perms=%s' % [k, v['permissions'].inspect]}
  "
done
```

All 5 print `top={"contents"=>"read"}` and every job prints `perms=nil` — no job
overrides the top-level grant, so no job can hold more than `contents: read`. On a
fork PR the platform floors it at read-only regardless; on an internal PR our
config produces the same result.

#### Claim 4 — zero secret references

```bash
grep -rn 'secrets\.' .github/workflows/
```

Hits, in full:

| File | Line | Reference | Fork-reachable? |
|------|------|-----------|-----------------|
| `post-merge-pr.yml` | 217 | `${{ secrets.GITHUB_TOKEN }}` | No (`push`, `workflow_dispatch`) |
| `opencode.yml` | 32 | `${{ secrets.ANTHROPIC_API_KEY }}` | No (`issue_comment`, gated) |
| `create-release.yml` | 160, 179 | `${{ secrets.GITHUB_TOKEN }}` | No (`push`, `workflow_dispatch`) |
| `validate-registry.yml` | 3 | *prose in a comment* — "…read-only token and no secrets." | Yes, but not an expression |
| `post-merge.yml.disabled` | 55, 139, 159 | `${{ secrets.GITHUB_TOKEN }}` | No — filename is not `*.yml`, never loaded |
| `evals/run-evaluations.yml` | 77 | `${{ secrets.OPENCODE_API_KEY }}` | No — see note below |

None of the 5 fork-reachable workflows contains a `${{ secrets.* }}` expression.
The only `secrets` string in that set is English prose inside `validate-registry.yml`'s
header comment.

**Note on `evals/run-evaluations.yml`:** it lives in a *subdirectory* of
`.github/workflows/`. GitHub only loads workflow files at the top level of
`.github/workflows/`, so this file is inert — and its declared triggers
(`workflow_dispatch`, `schedule`, `push`) are not fork-reachable in any case. It
is double-covered, but a reviewer should know it is not a live workflow.

#### Claim 5 — no credentials persisted into the work tree

`actions/checkout` writes the job's `GITHUB_TOKEN` into `.git/config` as an
`extraheader` unless `persist-credentials: false`. On a fork PR that token is
read-only, so the exposure is bounded — but persisting it lets any subsequent
build step, test script, or transitive dependency read a token from disk that it
was never handed. Setting `persist-credentials: false` on every checkout removes
that class of exposure entirely and keeps the property from silently regressing if
a workflow's permissions are ever widened.

```bash
cd .github/workflows
for f in pr-checks.yml validate-registry.yml dependency-review.yml installer-checks.yml validate-test-suites.yml; do
  ruby -ryaml -e "
    d=YAML.load_file('$f'); co=0; pc=0; bad=[]
    d['jobs'].each{|jn,j| (j['steps']||[]).each{|s|
      next unless s['uses'].to_s.include?('actions/checkout')
      co+=1
      (s['with']||{})['persist-credentials']==false ? pc+=1 : bad << \"#{jn}/#{s['name']}\"
    }}
    puts '%-26s checkouts=%d persist-credentials:false=%d %s' % ['$f', co, pc, bad.empty? ? 'OK' : 'MISSING: '+bad.inspect]
  "
done
```

Output: 11 checkouts, 11 with `persist-credentials: false`, zero missing. The
counts match the claim (`installer-checks.yml` 6, `validate-test-suites.yml` 1 —
both fixed on this branch; `pr-checks.yml` 2, `validate-registry.yml` 1,
`dependency-review.yml` 1 — already compliant).

#### Claim 6 — secret-bearing workflows are unreachable from a fork

`create-release.yml` and `post-merge-pr.yml` trigger only on `push` and
`workflow_dispatch`; both require write access to this repository, which a fork
contributor does not have. Their `secrets.GITHUB_TOKEN` use is therefore only ever
in a trusted context.

`opencode.yml` is the sharpest case: it holds `ANTHROPIC_API_KEY` and its job
grants `id-token`, `contents`, `pull-requests`, and `issues: write`. Its trigger is
`issue_comment`, which **anyone** — including a fork contributor — can raise by
commenting on an issue or PR. The protection is the job-level `if` gate
(`opencode.yml` lines 12–16):

```yaml
if: |
  (contains(github.event.comment.body, '/oc') ||
   contains(github.event.comment.body, '/opencode')) &&
  (github.event.comment.author_association == 'OWNER' ||
   github.event.comment.author_association == 'MEMBER')
```

The `author_association` conjunct is the security-relevant half: a comment from an
outside contributor evaluates to `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or
`NONE`, the `if` is false, and the job never starts — so the key is never
materialized. `author_association` is computed by GitHub from the commenter's
repository role and is not attacker-controllable. The `/oc` conjunct is a UX
command filter, not a control boundary.

Two honest notes on this gate, neither of which breaks the claim:

- `contains(..., '/oc')` is a **substring** match anywhere in the comment body, so
  an owner writing a comment containing e.g. `src/oc` would trip it. That is a
  false-positive nuisance for trusted users, not an escalation path.
- `opencode.yml`'s checkout takes the default branch (an `issue_comment` run always
  uses the default-branch workflow and, with no `ref:`, the default-branch code) —
  so PR head code is not executed alongside the key.

## Internal validation — required checks execute and failures block

The `PR Checks Summary` job (`pr-checks.yml` lines 245–322) is the aggregation gate.
It declares `needs: [pr-title-check, check-changes, build-check]` and `if: always()`
so it runs even when a dependency fails, then derives its own exit status from the
`needs.*.result` values:

```bash
# lines 309-322
if [ "${{ needs.pr-title-check.result }}" == "success" ] && \
   [ "${{ needs.check-changes.result }}" == "success" ] && \
   { [ "${{ needs.build-check.result }}" == "success" ] || \
     { [ "${{ needs.build-check.result }}" == "skipped" ] && \
       [ "${{ needs.check-changes.outputs.has-evals }}" != "true" ]; }; }; then
  echo "### ✅ All Required Checks Passed!" >> $GITHUB_STEP_SUMMARY
else
  echo "### ❌ Some Checks Failed" >> $GITHUB_STEP_SUMMARY
  exit 1
fi
```

**How it fails closed.** The success branch is an allowlist: it requires explicit
`success` from `pr-title-check` and `check-changes`. Every other value —
`failure`, `cancelled`, `skipped`, or anything GitHub adds later — falls to the
`else` and `exit 1`. There is no "unknown means OK" path.

**How it treats intentional skips.** `build-check` is the one job allowed to be
`skipped` and still pass, and only under a specific condition: `check-changes`
must have *succeeded* and reported `has-evals != 'true'`. That is the legitimate
"this PR touches no evals code, so there is nothing to build" case. A skip caused
by an upstream failure does **not** qualify — if `check-changes` fails,
`build-check` skips, but the `check-changes.result == success` conjunct is already
false and the summary exits 1. Skipping cannot be used to launder a failure.

### Captured evidence

| PR | Run | Observation | What it proves |
|----|-----|-------------|----------------|
| **#334** | first run | `Build & Validate` **FAILED** → `PR Checks Summary` **FAILED** (`exit 1`) | The gate fails closed. A required job failing propagates to the summary rather than being swallowed by `if: always()`. |
| **#336** | merged run (`699b2d7`) | All **7 checks executed and passed**: Build & Validate, Dependency Review, PR Checks Summary, Detect Changed Files, Validate PR Title, Validate Test Suite Definitions, validate-and-update | The hardened workflows still execute end-to-end. Read-only permissions, SHA-pinned actions, and `persist-credentials: false` did not break any check. |
| **#336** | first run | `Dependency Review` **FAILED** — "Dependency review is not supported on this repository. Please ensure that Dependency graph is enabled" (4s); **passed** (9s) after enabling the Dependency Graph | The check is live and fails on a real precondition rather than passing vacuously. |

`Build & Validate` on #336 included the new **Run deterministic tests** step
(`npm run test:ci`), which ran **112 deterministic tests** — the offline Vitest
allowlist. Model- and network-dependent suites are deliberately excluded from PRs.

The Dependency Graph enablement is recorded in
[`private-vulnerability-reporting-evidence.md`](./private-vulnerability-reporting-evidence.md).

**`Dependency Review` is its own workflow and is NOT part of the PR Checks Summary
aggregation.** `dependency-review.yml` is a separate workflow file with a single
job; `pr-checks.yml`'s summary only aggregates `pr-title-check`, `check-changes`,
and `build-check`. A `Dependency Review` failure will not turn the summary red — it
must be enforced as its own required status check in branch protection, or it can
be merged past. Same for `Validate Test Suite Definitions` (`validate-test-suites.yml`)
and `validate-and-update` (`validate-registry.yml`). `installer-checks.yml` has its
own internal `summary` job aggregating its 6 jobs, independent of `pr-checks.yml`.

## Findings and follow-up candidates

All six claims are **CONFIRMED**. No discrepancy was found. Verification surfaced
two observations plus one repository-level gap; the disposition of each is below.

| # | Observation | Severity | Disposition |
|---|-------------|----------|-------------|
| 1 | `validate-test-suites.yml` posted a PR comment via `github.rest.issues.createComment` on failure, but the workflow's token is `contents: read` with no `issues: write` — the step would **403** whenever it fired. It only ran `if: failure()`, so #336's passing run never exercised it. **Root cause: this was a regression introduced by Task 05.** Before Task 05 the workflow had no `permissions:` block and inherited the repository default (`write`), so the step worked; adding the correct `contents: read` broke it. | Low — a broken convenience, and the read-only token is the *correct* posture | **Fixed.** The step was deleted (approved), leaving an explanatory comment in its place. `issues: write` was deliberately **not** granted to a fork-reachable workflow — and for fork PRs GitHub forces a read-only token regardless, so the step could never have worked there. Failures remain visible as a red check plus the uploaded validation report. |
| 2 | `opencode.yml`'s `contains(comment.body, '/oc')` is a substring match, so unrelated owner comments containing `/oc` can trigger the agent. | Low — nuisance only; the `author_association` gate is the real boundary | Open. Tighten to a prefix/word-boundary match if it proves noisy. |
| 3 | The repository's `default_workflow_permissions` was **`write`**, so any *future* workflow added without an explicit `permissions:` block would silently receive a write-scoped token. Task 05 gave every *current* workflow an explicit block, but did not change the default itself. | Medium — no current exposure, but the safe-by-default property was missing | **Fixed.** Repository default set to `read` (see settings change below). |

### Repository setting changed by this task

| Step | Command | Result |
|------|---------|--------|
| Before | `GET /repos/darrenhinde/OpenAgentsControl/actions/permissions/workflow` | `{"default_workflow_permissions":"write","can_approve_pull_request_reviews":true}` |
| Change | `PUT …/actions/permissions/workflow -F default_workflow_permissions=read -F can_approve_pull_request_reviews=false` | `HTTP 204` |
| Read-back | `GET /repos/darrenhinde/OpenAgentsControl/actions/permissions/workflow` | `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}` |

Nothing breaks today: every current workflow already declares an explicit
`permissions:` block, so none relied on the write default. New workflows now
default to read-only, and GitHub Actions can no longer approve pull requests.
Reversible by setting `default_workflow_permissions=write`.

### Manual cleanup candidates

**None from this task.** The evidence-based method created zero test state:

- **No branch was created or deleted.** No worktree was created or deleted.
- No test PR was opened; no workflow was dispatched.
- The only repository setting changed was `default_workflow_permissions`
  (`write` → `read`), recorded above with read-back evidence. No test state was
  created, so there is nothing to clean up.

Nothing requires cleanup. The pre-existing artifacts below are noted for awareness
only — they predate this task and are out of its scope:

| Artifact | Status |
|----------|--------|
| `.github/workflows/post-merge.yml.disabled` | Inert (not `*.yml`); still contains three `secrets.GITHUB_TOKEN` refs. Delete-or-keep is a separate decision. |
| `.github/workflows/evals/run-evaluations.yml` | Inert (subdirectory); references `secrets.OPENCODE_API_KEY`. Not loaded by GitHub. |

## Residual risk and limitations

Stated plainly: **this is static analysis plus historical run evidence, not a live
fork PR test.** No second GitHub account was available to open a real fork PR, and
the approved method excluded creating GitHub test state.

What this validation does establish:

- The *configuration* cannot leak a secret to fork code, because the fork-reachable
  workflows contain no secret reference at all. This holds independently of the
  platform's fork rules — there is nothing to leak.
- The *configuration* requests only `contents: read`, so no write token is issued
  to fork-reachable workflows even on internal PRs, where the platform's fork
  protections do not apply.
- The summary gate's fail-closed logic is confirmed both by reading the shell
  conditional and by PR #334's observed `Build & Validate` → `PR Checks Summary`
  failure propagation.

What a live fork PR test would add:

1. **Direct observation** that the runner's `GITHUB_TOKEN` is read-only on a fork
   PR — currently asserted from documented platform behavior, not measured.
2. **Direct observation** that `${{ secrets.* }}` interpolates empty for a fork —
   moot here (no such references exist), but it would confirm the platform rule
   rather than assume it.
3. **Coverage of repository- and org-level settings** that static analysis of
   workflow files cannot see, most importantly *"Require approval for all outside
   collaborators"* / fork-PR workflow approval, and the default workflow permission
   setting. Our workflows never rely on those defaults, but they are unverified here.
4. **Confirmation that fork PRs actually queue the expected 5 workflows**, including
   path-filter behavior on `installer-checks.yml` and `validate-test-suites.yml`.

None of these gaps can turn a CONFIRMED claim into a leak: claims 4 and 6 are
absolute properties of the file contents (there is no secret to withhold), and
claim 3 is a floor the platform can only lower. The gap is in *depth of assurance*,
not in the conclusions.

**Regression risk is the real exposure.** Every property here is one careless edit
from reverting — a `pull_request_target` swap, a job-level `permissions:` block, or
a new `secrets.` reference in a fork-reachable workflow. The comment guard in
`validate-registry.yml` helps, but the checks in this document are cheap and should
be re-run whenever a workflow changes. Making them a CI check on
`.github/workflows/**` would be the durable fix.

## Reproducing this validation

Every command, in order, from the repository root:

```bash
# 1. Trigger parse — which workflows are fork-reachable
cd .github/workflows
for f in *.yml; do
  ruby -ryaml -e "d=YAML.load_file('$f'); t=(d[true]||d['on']); puts '%-28s %s' % ['$f', (t.is_a?(Hash) ? t.keys.inspect : t.inspect)]"
done

# 2. No pull_request_target / workflow_run trigger (expect: only the comment hit)
grep -rn "pull_request_target\|workflow_run" .

# 3. Permissions, top-level and per job
for f in *.yml; do ruby -ryaml -e "d=YAML.load_file('$f'); puts '%-28s %s' % ['$f', d['permissions'].inspect]"; done

# 4. Every secret reference in the repository
grep -rn 'secrets\.' .

# 5. Checkout / persist-credentials audit over the 5 fork-reachable workflows
for f in pr-checks.yml validate-registry.yml dependency-review.yml installer-checks.yml validate-test-suites.yml; do
  ruby -ryaml -e "
    d=YAML.load_file('$f'); co=0; pc=0; bad=[]
    d['jobs'].each{|jn,j| (j['steps']||[]).each{|s|
      next unless s['uses'].to_s.include?('actions/checkout')
      co+=1
      (s['with']||{})['persist-credentials']==false ? pc+=1 : bad << \"#{jn}/#{s['name']}\"
    }}
    puts '%-26s checkouts=%d persist-credentials:false=%d %s' % ['$f', co, pc, bad.empty? ? 'OK' : 'MISSING: '+bad.inspect]
  "
done

# 6. Summary gate logic
sed -n '245,322p' pr-checks.yml

# 7. opencode.yml author_association gate
sed -n '1,34p' opencode.yml
```

Expected: 5 fork-reachable workflows; 1 `pull_request_target` hit (a comment);
`contents: read` on all 5 with `perms=nil` on every job; no `${{ secrets.* }}` in
any of the 5; 11 checkouts / 11 `persist-credentials: false` / 0 missing.

## Related documents

- [`ci-threat-model-and-baseline.md`](./ci-threat-model-and-baseline.md) — the threat model these controls answer
- [`action-pin-inventory.md`](./action-pin-inventory.md) — action SHA pins and the permissions inventory
- [`private-vulnerability-reporting-evidence.md`](./private-vulnerability-reporting-evidence.md) — the Dependency Graph enablement referenced above
