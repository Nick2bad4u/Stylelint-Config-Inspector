---
name: "Codex-Instructions-Stylelint-Testing"
description: "Instructions for writing robust, type-safe tests for Stylelint rules using Vitest, Stylelint's runtime API, and Fast-Check."
applyTo: "test/**, tests/**"
---

<instructions>
  <goal>

## Your Goal for Stylelint Rule Testing

- You understand that testing Stylelint rules requires covering not just the "happy path" but also:
  - **Syntax Edge Cases:** Nested structures, weird formatting, comments, and custom properties.
  - **Custom Syntax Behavior:** How rules behave across CSS, SCSS, CSS-in-JS, MDX, or other supported syntaxes.
  - **Fixer Safety:** Ensuring autofixers produce valid syntax and don't change stylesheet behavior destructively.
- You strictly use **Vitest** as the test runner.

## Folder scope

- Apply the same testing standards to repositories that use either `test/` or `tests/`.
- Prefer the repository's existing convention instead of introducing a second competing test root without a good reason.

  </goal>

  <setup>

## Test Infrastructure & Setup

- **Runner:** Vitest (compatible with standard Jest-like APIs).
- **Rule execution:** Prefer `stylelint.lint(...)` directly unless the repository already standardizes on a dedicated Stylelint rule harness.
- **Repository Helpers:**
  - If the repository provides shared helpers for linting code snippets, use them instead of duplicating `stylelint.lint(...)` setup in every file.
  - If the repository provides a helper to resolve rules through the public plugin entrypoint, prefer that over importing individual rule modules directly in rule test files.
  - The current template should prefer helpers under `test/_internal/` for plugin loading, config creation, and result extraction.
- **Syntax setup:**
  - Do **not** hand-roll custom syntax configuration in each test file.
  - Centralize `customSyntax`, parser-related options, and reusable config wiring in shared helpers.
- **Fixtures:**
  - Use a shared fixture location (commonly `test/fixtures/` or `tests/fixtures/`) for CSS, SCSS, MDX, or custom-syntax samples.
  - If the repository exposes helpers such as `readFixture()` and `fixturePath()`, use them; otherwise create equivalent helpers rather than repeating file-resolution logic inline.
  - Keep fixture naming consistent: `<rule-id>.valid.css`, `<rule-id>.invalid.css`, plus syntax-specific variants when needed.
  - Prefer real parsing and real Stylelint execution for accuracy.

  </setup>

  <coding>

## Writing Tests

### 1. Structure
- Every rule test file should follow a shared, repository-approved pattern. For example, if the repo exposes shared test helpers, structure tests like this:
  ```ts
  import { describe, expect, it } from 'vitest';

  import { configs } from '../src/plugin';
  import { lintWithConfig } from './_internal/stylelint-test-helpers';

  describe('my-rule', () => {
    it('reports invalid code', async () => {
      const result = await lintWithConfig({
        code: '.bad-selector {}',
        config: {
          ...configs.recommended,
          rules: {
            ...configs.recommended.rules,
            'docusaurus/my-rule': true,
          },
        },
      });

      expect(result.parseErrors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });
  ```

### 2. Valid Cases
- Include code that *should not* trigger the rule.
- **False Positive Prevention:** purposefully include code that looks *similar* to the target pattern but is technically correct/safe.
- **Syntax Awareness:** Test across supported syntaxes so the rule doesn't crash or report incorrectly when the syntax changes.

### 3. Invalid Cases
- Include code that *must* trigger the rule.
- **Errors:** Verify the exact message text or message helper output.
- **Path-aware tests:** Include a realistic `codeFilename` or file extension through the repository helper you use so syntax resolution mirrors real file resolution.
- **Output (Autofix):**
  - If the rule has a fixer, you MUST provide an `output` string.
  - The `output` must still be valid syntax for the tested file.
  - If the fix is partial (multiple passes), verify the final state explicitly.
- **Options:** If the rule has options, add test cases explicitly setting them.

### 4. Property-Based Testing (`fast-check`)
- Use `fast-check` to generate random selectors, declarations, values, or CSS snippets when the rule logic is complex.
- **Example Strategy:**
  - Generate random strings to test regex-based rules.
  - Generate nested CSS snippets to test traversal logic.
  - Use `fc.string()` / `fc.unicodeString()` to ensure the rule handles weird unicode or whitespace without crashing.

  </coding>

  <guidelines>

## Best Practices

- **Strict Typing:** Type helper inputs/outputs precisely so config fragments and warning assertions stay accurate.
- **Multiline Code:** Use template literals (backticks) for code readability.
  - Avoid excessive indentation in the template literal; use `.trim()` or a utility helper if needed to normalize whitespace.
- **Comments:** Put a comment above complex test cases explaining *what* specific edge case is being tested.
- **Plugin Wiring:** Keep tests coupled to public plugin wiring by using the repository's shared plugin/config helpers when available instead of bypassing the package entrypoint everywhere.
- **Performance:**
  - If a test hangs, check for infinite loops in the rule's traversal or fixer.
- **Snapshot Testing:**
  - AVOID using Jest/Vitest snapshots for fixed output. Explicitly write the expected string in the test object. This makes the test self-documenting and easier to review.

  </guidelines>

  <examples>

## Example: Stylelint Rule Test

```ts
import { describe, expect, it } from 'vitest';

import plugin, { configs } from '../src/plugin';
import { lintWithConfig } from './_internal/stylelint-test-helpers';

describe('docusaurus/my-rule', () => {
  it('reports invalid CSS', async () => {
    const result = await lintWithConfig({
      code: '.DocSearch-Button { color: red; }',
      config: {
        ...configs.recommended,
        plugins: [...plugin],
        rules: {
          ...configs.recommended.rules,
          'docusaurus/my-rule': true,
        },
      },
    });

    expect(result.parseErrors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });
});
```

## Example: Property-Based Test (Fast-Check)

```ts
import * as fc from 'fast-check';

test('selector helper handles arbitrary inputs', () => {
  fc.assert(
    fc.property(fc.string(), (selectorText) => {
      const result = normalizeSelectorText(selectorText);
      return typeof result === 'string';
    }),
  );
});
```

  </examples>
</instructions>
