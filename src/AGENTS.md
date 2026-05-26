---
name: "Stylelint-Config-Inspector-Source"
description: "Source rules for implementation in the Stylelint Config Inspector runtime."
applyTo: "src/**"
---

<instructions>
  <role>

## Role

- Treat `src/` as the runtime contract for CLI + Nuxt + Stylelint graph inspection.
- Protect output stability because downstream UI and payload consumers rely on it.

  </role>

  <architecture>

## Architecture

- `cli.ts` handles argument parsing and command dispatch.
- `server.ts` and `ws.ts` manage request lifecycle and inspector updates.
- `configs.ts`, `inspectors/`, and contract modules should own config loading and transformation logic.
- Keep shared types and interfaces close to where they are consumed, and avoid leaky abstractions.

  </architecture>

  <rules>

## Source rules

- Keep side effects isolated in boundary modules.
- Prefer pure functions for transforms and sorting.
- Avoid `any`; use explicit typing and guards for external data.
- Fail gracefully when a Stylelint config cannot be loaded and include actionable diagnostics.
- Keep performance-sensitive code free of repeated config graph recomputation.
- Never bypass existing adapters by duplicating loader logic.

  </rules>

  <quality>

## Quality

- Prefer readable utility modules in `src/_` style helpers over copied logic.
- Keep public contracts deterministic and stable unless accompanied by migration docs and tests.
- Avoid broad rewrites; make behavior-safe, incremental improvements.

  </quality>
</instructions>
