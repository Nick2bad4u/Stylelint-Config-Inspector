# Contributing to Stylelint Config Inspector

Thanks for your interest in contributing.

This repository contains the Stylelint Config Inspector CLI, server, and web UI
for exploring resolved Stylelint configuration state.

Maintainers: release procedures are documented in [RELEASING.md](./RELEASING.md).

## Prerequisites

- Node.js LTS
- npm `>=11`
- Git

## Local setup

1. Fork and clone the repository.

2. Install dependencies from the repository root:

   ```bash
  npm ci
   ```

3. Run the main quality gate:

   ```bash
  npm run check
   ```

## Recommended development workflow

1. Create a branch from `main`.
2. Make focused changes.
3. Add or update tests in `tests/` when behavior changes.
4. Update relevant documentation in root docs when needed.
5. Run validation commands before opening a pull request.

## Debugging and logging policy

To keep runtime plugin behavior predictable, this repository enforces strict
rules for logging and debugger usage in source code.

- `src/**`, `app/**`, `server/**`, and `shared/**`: do **not** commit `console.*` or `debugger`
  statements.
- `scripts/**`: `console.log`/`console.warn`/`console.error` are allowed for
  CLI progress and diagnostics.
- `tests/**`: avoid noisy logging by default; only keep it when a test is
  explicitly validating logging behavior.

When adding script output, prefer this severity split:

- `console.log`: normal progress
- `console.warn`: recoverable issue or fallback behavior
- `console.error`: failure path (typically followed by a non-zero exit code)

## Project layout

```text
.
├── app/                  # Nuxt app UI
├── server/               # Nitro server endpoints
├── shared/               # Shared payload and type definitions
├── src/                  # CLI and Stylelint inspector implementation
├── tests/                # Vitest coverage and fixtures
├── scripts/              # Repository scripts
├── .github/              # Workflows and automation configs
└── package.json          # Scripts, dependencies, metadata
```

## Validation commands

Use these commands locally before submitting a pull request:

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --run`
- `npm run build`
- `npm run check`

## Testing guidance

Prefer focused Vitest coverage that exercises real Stylelint config discovery,
config normalization, payload generation, and CLI-facing behavior.

When adding regression coverage, favor small temporary fixture projects in
`tests/` over broad snapshots.

Focused run examples:

```bash
npx vitest --run tests/stylelint_adapter.test.ts
npx vitest --run tests/ws_error_payload.test.ts
```

## Commit guidance

Gitmoji + Conventional type commits are recommended because release notes and
changelog tooling are commit-message aware.

Format:

- `:gitmoji: type(scope?): subject`

Examples:

- `:sparkles: feat(cli): add target path normalization`
- `:bug: fix(inspector): honor file-specific Stylelint overrides`
- `:memo: docs: clarify target resolution behavior`

## Pull request expectations

- Keep pull requests scoped and reviewable.
- Include tests for behavior changes.
- Keep docs in sync with implementation changes.
- Do not include generated lockfile churn unrelated to the change.

## Security

Do not open public issues for potential vulnerabilities.
Use the process described in [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree your contributions are licensed under the
[Apache-2.0](./LICENSE).
