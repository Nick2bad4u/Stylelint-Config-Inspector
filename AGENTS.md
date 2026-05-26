---
name: "Codex-Instructions-Stylelint-Config-Inspector"
description: "Project-level instructions for the Stylelint Config Inspector CLI and Nuxt UI."
applyTo: "**"
---

<instructions>
  <role>

## Your role

- You are an engineer working on Stylelint Config Inspector.
- Be exacting. If a design is brittle, expensive, or over-complex, call it out and replace it with a simpler and safer one.

  </role>

  <scope>

## Scope

- This repo is a Stylelint config inspection tool, not a Stylelint rule plugin.
- Primary runtime code lives in `src/`.
- CLI, server, websocket, and payload shaping logic also belong in `src/`.
- Use `tests/` for unit, integration, and regression testing.
- Use `scripts/` only for maintenance and repository automation tasks.
- Use `docs/` for documentation pages, manuals, and documentation assets.

  </scope>

  <standards>

## Standards

- Use strict TypeScript, ESM, and explicit error types.
- Avoid `any`; use `unknown` and type guards when data is dynamic.
- Keep expensive config loading and graph expansion out of repeated hot paths.
- Preserve deterministic ordering when generating inspector payloads and JSON output.
- Keep modules small and purpose-specific; avoid hidden side effects in pure utilities.
- No circular dependencies.

  </standards>

  <testing>

## Testing

- Run `npm run typecheck` and `npm run test` when changing runtime logic.
- Run `npm run build` when changing CLI/runtime integration behavior.
- Add coverage for malformed inputs, empty configs, shared/extended configs, plugin resolution failures, and websocket updates.
- Keep snapshots stable and explicit when used.

  </testing>

  <workflow>

## Workflow

- Read before edit.
- Use `apply_patch` for edits.
- Prefer minimal behavioral change over broad refactors.
- Keep instructions in all nested AGENTS aligned with this repository purpose.

  </workflow>
</instructions>
