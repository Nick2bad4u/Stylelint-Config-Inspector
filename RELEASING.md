# Releasing `stylelint-config-inspector`

This document is maintainer-focused and complements the end-user README.

## Release workflow

Releases are handled by `.github/workflows/release.yml`.

- Trigger: push a tag matching `v*` or manually via `workflow_dispatch`
- Publish target: npm (`stylelint-config-inspector`)
- GitHub Release: generated from `git-cliff` release notes output

## Prerequisites

- You have permission to run the `Release` workflow.
- Repository secrets are configured:
  - `NPM_TOKEN`
- `main` is green in CI.

## Manual release (recommended)

1. Open **Actions → Release → Run workflow**.
2. Select the target branch (normally `main`).
3. Choose one:
   - `release_type`: `patch` | `minor` | `major`
   - or set explicit `version` as `x.y.z`.
4. Run the workflow.

The workflow will:

1. validate release input,
2. bump package version,
3. run `npm run release:check`,
4. create/push commit and tag,
5. publish to npm,
6. create/update GitHub release notes.

## Tag-triggered release

If you push a tag directly (for example `v1.5.1`), the workflow validates that tag version matches `package.json` before publishing.

## Quality gate used by release

`npm run release:check` runs:

```bash
npm run check
```

And `check` runs:

```bash
npm run lint && npm run typecheck && npm run test -- --run && npm run build
```

## Quick troubleshooting

- **Version already published**: bump patch/minor/major or choose a new explicit version.
- **Tag/version mismatch**: align `package.json` and tag version (`vX.Y.Z`).
- **Release check failed**: run `npm run release:check` locally and fix errors before retrying.
