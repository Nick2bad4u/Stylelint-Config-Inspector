---
name: "Stylelint-Config-Inspector-Scripts-Guide"
description: "Guidelines for repository automation and maintenance scripts."
applyTo: "scripts/**"
---

# Scripts (`scripts/`) Guidelines

## Role

- Keep script behavior deterministic and reviewable.
- Scripts must not mutate files without clear intent and explicit output reporting.

## Authoring rules

- Prefer `.mjs` entrypoints for Node automation unless PowerShell is required for host setup.
- Resolve repository paths from the project root.
- Prefer `node:` built-ins and small composable helpers.
- Exit with non-zero status on failures and print machine-parsable diagnostics.

## Reliability

- Make scripts idempotent.
- Separate `--check` from `--write` behavior when possible.
- Keep temporary files in `temp/`.
- Prefer explicit allowlists over recursive filesystem assumptions.

## Safety

- Never hard-code absolute machine-specific paths.
- Avoid changing unrelated files.
- Document platform assumptions in script comments and usage output.

## Testing expectations

- If a script can be run in CI, include a corresponding guard or dry-run mode.
- Validate arguments and fail fast on unsupported usage.
