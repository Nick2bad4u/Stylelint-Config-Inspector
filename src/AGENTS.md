---
name: "Codex-Instructions-Stylelint-Plugin-Source"
description: "Authoring rules and source modules in the Stylelint plugin template under src/."
applyTo: "src/**"
---

<instructions>
  <goal>

## Your Goal in `src/`

- Treat `src/` as the canonical source of truth for the plugin runtime, rule implementations, shared PostCSS analysis helpers, and shareable-config wiring.
- Prefer changing source modules and shared helpers here instead of patching generated outputs, docs copies, or benchmark-only code.
- New rules should follow the repository's Stylelint rule template exactly so metadata, docs, configs, tests, and package exports stay consistent.

  </goal>

  <layout>

## Source Layout

- `src/plugin.ts`
  - Public plugin entrypoint.
  - Owns exported plugin metadata, shareable config wiring, and public runtime shape.
  - If rule or config metadata changes, verify whether `plugin.ts` derived output or exported types need to change too.
- `src/rules/*.ts`
  - One rule per file.
  - File name should match the unqualified rule name.
  - Default export should usually be the Stylelint plugin object for that rule.
- `src/_internal/**`
  - Shared rule helpers, analysis utilities, safe-fix coordination, metadata derivation, and internal-only types.
  - Prefer moving reusable logic here instead of duplicating PostCSS traversal or selector/value parsing logic across rules.
  - Do not treat `_internal` as a stable public API unless the repo explicitly exports it.

  </layout>

  <rule_template>

## Canonical Rule Template

- Prefer the shared rule creator used by the repository template (for example `createStylelintRule(...)` from `src/_internal/create-stylelint-rule.ts`).
- Rule files should usually have this shape:
  1. imports
  2. small file-local constants/default options
  3. static `ruleName`, `messages`, and authored docs metadata constants
  4. `createStylelintRule({...})` call
  5. default export
- Keep the runtime rule function focused on lint behavior only.
- Pull reusable selector parsing, declaration/value inspection, safe autofix helpers, and PostCSS utilities into `_internal` helpers instead of open-coding them repeatedly.

### Runtime vs static data

- The runtime inputs for a rule should be limited to:
  - Stylelint primary option / secondary options / context
  - source text / PostCSS AST
  - selector/value/media parsing when required
  - user-provided rule options
- **Do not dynamically compute, fetch, or inject authored docs metadata at runtime.**
- **Do not build docs metadata from README files, markdown files, process env, or external JSON at lint time.**
- Infrastructure helpers may normalize URLs or config membership centrally, but authored rule metadata must still be written as static literals in the rule definition.
- The only authored values that should vary per lint invocation are rule options and data derived from the file being linted.

  </rule_template>

  <metadata>

## Required Rule Metadata

Every rule should define a complete static metadata contract.

### Core Stylelint metadata

- `ruleName`
  - Must be namespaced and must match the rule file name and the rule registry entry.
- `messages`
  - Use stable keys and actionable wording.
  - Prefer `stylelint.utils.ruleMessages(ruleName, ...)` or a repository helper that wraps it.
- `meta.fixable`
  - Use only when the rule provides a safe autofix.
- `meta.deprecated`
  - Must be explicit.
  - If `true`, keep deprecation metadata and migration guidance accurate.
- `meta.url`
  - Must point at the authored docs page for the rule.
- `primaryOptionArray`
  - Set only when the rule intentionally accepts an array as its primary option.

### Extended docs metadata used by this template

Write these as static literals in the template's docs metadata surface whenever the template expects them:

- `description`
- `recommended`
- `url`
- config-membership metadata used by the repo (for example whether a rule belongs in `recommended`)

If the repository template maintains a stable rule catalog, also make sure the rule is registered in that catalog so canonical rule IDs / numbers stay stable.

### `deprecated` guidance

- Use `deprecated: true` only when the rule is intentionally retired.
- Deprecated rules should still have correct docs, tests, and replacement guidance until removal.
- Do not silently repurpose a deprecated rule into a different behavior.

### Syntax-aware rules

- If a rule depends on non-standard syntax or custom syntax assumptions, document that clearly in static docs metadata and in the rule docs page.
- If the rule can run safely across multiple syntaxes, keep the implementation conservative and avoid hidden parser assumptions.

  </metadata>

  <implementation>

## Rule Implementation Expectations

- Use the narrowest viable PostCSS traversal.
- Fail fast on obviously irrelevant nodes.
- Avoid repeated selector/value reparsing when a cached/shared helper can do the same work.
- Keep report descriptors deterministic.
- Prefer safe autofixes over clever ones.
- If a fix might change semantics, formatting meaningfully, or custom-syntax behavior, report only.
- Preserve comments, formatting boundaries, and author intent whenever possible.

### Performance

- Rule code runs frequently; avoid whole-root rescans inside declaration/rule walkers.
- Cache repeated computations per file when useful.
- Keep selector/value parsing disciplined: parse only when necessary and batch through shared helpers when possible.

### Reuse

- If two rules need the same PostCSS-analysis primitive, build or extend an internal helper in `src/_internal/`.
- Do not copy/paste selector parsing, value parsing, or safe-fix logic between rule files.

  </implementation>

  <workflow>

## New Rule Workflow in This Template

When adding a rule, usually all of the following are required:

1. Add the rule module in `src/rules/<rule-id>.ts`.
2. Register it in the runtime rule registry.
3. Add or update stable rule-catalog data if the repo uses one.
4. Ensure the docs metadata lines up with the canonical docs URL and config membership rules.
5. Add the rule docs page.
6. Add tests and syntax fixtures when relevant.
7. Update any generated README/config tables via the repo's sync scripts.
8. Verify public plugin wiring, package exports, and type surface if the change affects them.

Do not add a rule file without finishing the surrounding registry/docs/tests/sync work.

  </workflow>

  <donts>

## What Not To Do in `src/`

- Do not hand-edit `dist/` instead of `src/`.
- Do not runtime-inject docs metadata from helpers, markdown, or config files.
- Do not hide missing static metadata by computing it inside the runtime rule function.
- Do not bypass the shared rule helper unless there is a strong architectural reason.
- Do not add public exports from `_internal` casually.
- Do not duplicate rule registry entries, config membership, or docs URLs in multiple competing places when the template already derives them from one canonical source.

  </donts>
</instructions>
