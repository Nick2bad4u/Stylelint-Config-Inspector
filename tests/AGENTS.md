---
name: "Stylelint-Config-Inspector-Testing"
description: "Testing standards for Stylelint config inspection runtime and UI payload behavior."
applyTo: "tests/**, test/**"
---

<instructions>
  <goal>

## Goal

- Ensure inspector behavior is predictable for valid, invalid, and unusual Stylelint configurations.
- Keep test feedback fast, stable, and tied to real contracts used by CLI and UI.

  </goal>

  <unit_integration>

## Unit and integration tests

- Use Vitest for all runtime unit/integration coverage.
- Prefer shared fixtures for stylelint config samples in `tests/fixtures`.
- For async and file-system behavior, isolate temporary directories and clean them up.
- Include tests for:
  1. Resolveable config from files and inline strings.
  2. Missing extends/plugins and clear error reporting.
  3. Empty and malformed config inputs.
  4. Deterministic payload output and sorting semantics.

  </unit_integration>

  <e2e>

## End-to-end tests

- Use Playwright for browser-visible flows in `tests/e2e`.
- Keep selectors and assertions resilient to non-essential markup changes.
- Include navigation and rendering sanity checks for key inspector pages.

  </e2e>

  <quality>

## Quality rules

- Avoid brittle snapshots unless the output is intentionally snapshot-driven.
- Use property-based tests where normalization and parser handling has broad input spaces.
- Assert both success and failure paths for major changes.
- Prefer explicit assertions over implementation details.

  </quality>
</instructions>
