---
name: "Stylelint-Config-Inspector-Docs"
description: "Guidelines for documentation and documentation assets."
applyTo: "docs/**"
---

<instructions>
  <goal>

## Goal

- Keep docs aligned with the CLI and inspector runtime behavior.
- Preserve clarity for users configuring and reading stylelint config output.

  </goal>

  <scope>

## Scope

- `docs/assets/**` should only contain repo-owned documentation assets.
- Any new docs or guides should reflect current command flags, output schema, and known caveats.
- Do not keep stale references to plugin-rule workflows or other copied project assumptions.

  </scope>

  <content>

## Content rules

- Prefer concrete usage examples over generic prose.
- Keep code examples copy/paste-safe and up to date.
- If behavior changes, update docs in the same change set.
- Match terminology used by the CLI (`inspect`, config path resolution, and payload output).

  </content>

</instructions>
