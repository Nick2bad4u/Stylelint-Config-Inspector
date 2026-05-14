---
name: "Codex-Instructions-Stylelint-Docs"
description: "Instructions for writing high-quality Stylelint rule and config documentation."
applyTo: "docs/**"
---

<instructions>
  <goal>

## Your Goal for Stylelint Rule Documentation

- Your goal is to make every Stylelint rule documentation file (commonly `docs/rules/<rule-id>.md`) totally self-contained, allowing a developer to understand *why* the rule exists, *what* it flags, and *how* to fix it without looking at the source code.
- For adjacent rule-docs pages such as guides, config pages, `overview.md`, or `getting-started.md`, keep the same tone and accuracy standards, but do not force rule-only sections where they do not fit.
- You adhere strictly to Stylelint's documentation conventions and modern CSS tooling expectations.

## Documentation Quality Bar

- Every rule doc should be **hand-written, specific, and high quality**.
- Do **not** use a script or helper to stamp the same shallow prose into every rule doc.
- Do **not** rely on runtime metadata injection to make docs look complete.
- Shared guides, shared tables, or synced indexes are fine, but the actual rule page content must still be authored intentionally for that rule.
- If two rules need different rationale, caveats, migration notes, or examples, the docs must say so explicitly instead of collapsing into boilerplate.

## Static docs over generated filler

- Rule docs should not depend on runtime helpers to inject core explanatory content.
- Metadata can help validate, link, or classify docs, but it should not replace authoring.
- Write the description, rationale, examples, options explanation, edge cases, and "when not to use it" section manually.

  </goal>

  <structure>

## Documentation Structure

Rule documentation files in the repository's rule-docs location (commonly `docs/rules/<rule-id>.md`) should follow this structure closely:

1. **Title:** The bare rule ID as the H1 header (for example `# no-theme-token-leaks`).
2. **Description:** A short, one-sentence description of what the rule does.
3. **Meta Badges (Optional):** Badges for `Recommended`, `Fixable`, or syntax requirements only if the repository’s current docs pattern uses them.
4. **Rule Details:** An explanation of the problem the rule solves. Why is this pattern bad?
5. **Examples:**
   - Use `❌ Incorrect` and `✅ Correct` headers.
   - Always include code blocks with specific comments explaining *why* a line is incorrect when the reason is not obvious.
   - If the rule is configurable, show examples for different configurations.
6. **Options (if applicable):**
   - A TypeScript type or JSON-like shape definition of the options object.
   - Default values clearly marked.
   - Examples for each option.
7. **When Not To Use It:** specific scenarios where disabling this rule is acceptable.
8. **Further Reading:** Links to Stylelint docs, Docusaurus docs, MDN, CSS specs, or relevant framework docs.

  </structure>

  <style>

## Style & Tone

- **Voice:** Professional, objective, and helpful. Avoid slang.
- **Clarity:** Use active voice. "This rule reports..." instead of "This rule is used to report...".
- **Code Blocks:**
  - Use the most accurate language tag (`css`, `scss`, `mdx`, `html`, `tsx`) for the example.
  - Use `/* stylelint-disable-next-line ... */` comments only when necessary to clarify context.
- **Configuration:**
  - Prefer ESM `stylelint.config.mjs` examples.
  - If the package exports shareable configs, show those first.

  </style>

  <guidelines>

## Writing Guidelines

- **The "Why":** Never just say "Don't do X." Explain the consequence.
- **The "Fix":** If the rule is fixable, explicitly state what the auto-fixer does.
- **Syntax Requirements:** If the rule depends on a particular syntax or `customSyntax`, add a note at the top of the docs explaining that requirement.
- **Config awareness:** If the repository already exposes shareable configs that enable the rule, mention that clearly.
- **Consistency:** Ensure the examples actually trigger the rule. Do not use hypothetical examples that strictly wouldn't fail the implementation.
- **No copy-paste filler:** Avoid reusing the same generic paragraph across many rule docs unless it is truly shared guidance that belongs in a separate guide page.
- **No fake completeness:** A shorter but precise doc is better than a long page padded with repetitive or template-only text.
- **Manual curation:** If the repo has scripts that sync rule tables, sidebars, config matrices, or indexes, use those only for derived navigation/data. They are not a substitute for authoring the page itself.

  </guidelines>

  <examples>

## Example Doc

```markdown
# no-theme-token-leaks

Disallow leaking Docusaurus theme custom properties into non-theme selectors.

This rule helps keep theme tokens scoped and predictable across Docusaurus stylesheets.

## Targeted pattern scope

This rule focuses on declarations that reference reserved Docusaurus theme custom properties from selectors where the token should not be consumed directly.

- `color: var(--ifm-color-primary)` inside selectors that should instead use a component-scoped alias.

Indirect wrappers and selectors that intentionally define or forward the token can be excluded to keep reporting accurate.

## What this rule reports

This rule reports declarations when a reserved theme token is consumed in a disallowed selector context.

## Why this rule exists

Unscoped theme-token usage makes large Docusaurus stylesheets harder to refactor safely.

- Theme changes become harder to audit.
- Component CSS can accidentally couple itself to global token names.
- Consistent reporting makes token boundaries easier to maintain across the site.

## ❌ Incorrect

```css
.my-component {
  color: var(--ifm-color-primary);
}
```

## ✅ Correct

```css
.my-component {
  --component-link-color: var(--ifm-color-primary);
  color: var(--component-link-color);
}
```

## Additional examples

### ✅ Correct — Repository-wide usage

```css
[data-theme="dark"] .navbar {
  --navbar-border-color: var(--ifm-color-primary);
}
```

## Stylelint config example

```js
import docusaurusPlugin, { configs } from "stylelint-plugin-docusaurus";

export default {
  ...configs.recommended,
  plugins: [...docusaurusPlugin],
};
```

> Replace `stylelint-plugin-docusaurus`, `docusaurus`, and `no-theme-token-leaks` with the actual package name, namespace, and rule ID used in the target repository.

## When not to use it

Disable this rule if the project intentionally consumes global Docusaurus theme tokens directly in local component selectors and that coupling is acceptable.

## Further reading

- [Stylelint plugin guide](https://stylelint.io/developer-guide/plugins)
- [Docusaurus styling guide](https://docusaurus.io/docs/styling-layout)
- [Infima docs](https://infima.dev/)

  </examples>
</instructions>
