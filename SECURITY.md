# Security Policy

## Supported Versions

Security fixes are provided for the latest released minor version. Older
versions are not maintained; please upgrade before reporting.

| Version | Supported |
|---------|-----------|
| 0.7.x   | ✅        |
| < 0.7   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or discussions.**

Report vulnerabilities privately through GitHub's built-in private vulnerability
reporting:

1. Go to the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Provide a clear description, affected versions, reproduction steps, and
   potential impact.

This opens a private advisory visible only to the maintainers and to you.

### What to include

- The affected component and version.
- Steps to reproduce, or a proof of concept.
- The impact you believe the issue has.

### What not to include

- **Do not include real secrets, credentials, API keys, or access tokens** in
  your report. If a secret has been exposed, say so and rotate it — do not paste
  its value.

## Response Expectations

This project is maintained on a **best-effort basis**. Reports are reviewed and
addressed as maintainer availability allows; there is no guaranteed response
time. We will engage with the private advisory as we triage and work on a fix.

## Coordinated Disclosure

We follow coordinated disclosure. Please give the maintainers a reasonable
opportunity to investigate and release a fix before disclosing the issue
publicly. We will coordinate the timing and content of any public disclosure
with you through the private advisory.

## Scope

This policy covers the code in this repository. Vulnerabilities in third-party
dependencies should be reported to the respective upstream projects; if a
dependency issue affects this project specifically, you may still report it here
so we can track remediation.
