# Master checklist: Stylelint Config Inspector from `eslint/config-inspector` fork

## 0. Project setup and repo prep
- [ ] Fork `eslint/config-inspector`
- [ ] Clone the fork locally
- [ ] Install dependencies successfully
- [ ] Run the app locally and confirm the original project works before modifications
- [ ] Create a working branch for the migration
- [ ] Document the current baseline behavior with screenshots/notes
- [ ] Record current scripts, commands, and build outputs
- [ ] Confirm test suite status before changes
- [ ] Identify package manager and lockfile expectations
- [ ] Confirm Node version/toolchain requirements

**Why:** you want a stable baseline before changing anything.

---

## 1. Repository analysis and architecture inventory
- [ ] Identify top-level app structure
- [ ] Identify frontend app entrypoints
- [ ] Identify backend/server entrypoints
- [ ] Identify CLI entrypoints
- [ ] Identify shared types/models/utilities
- [ ] Trace the full flow from startup to rendered config data
- [ ] Identify how config data is fetched and serialized
- [ ] Identify how static build/export mode works
- [ ] Identify test folders and testing strategy
- [ ] Identify all places where ESLint concepts are hardcoded into architecture
- [ ] Identify all places where only labels/text are ESLint-specific
- [ ] List all direct dependencies on ESLint packages
- [ ] List all indirect utilities that assume ESLint config semantics
- [ ] Identify any assumptions around ESLint flat config specifically
- [ ] Document which parts look reusable vs rewrite candidates

**Deliverable:**
- [ ] Architecture summary doc
- [ ] File-by-file migration map
- [ ] Risk list

---

## 2. Product definition and migration scope
- [ ] Define MVP scope
- [ ] Define non-goals for MVP
- [ ] Decide whether to keep app UX mostly identical at first
- [ ] Decide whether to support only file-based inspection initially
- [ ] Decide whether provenance tracing is out of scope for MVP
- [ ] Decide whether static export is required for MVP or later
- [ ] Decide whether monorepo support is MVP or post-MVP
- [ ] Define which Stylelint config features must be displayed in MVP
- [ ] Define success criteria for “first working release”

**Recommended MVP success criteria:**
- [ ] User can point the tool at a file
- [ ] Tool resolves Stylelint config for that file
- [ ] Tool displays rules
- [ ] Tool displays plugins
- [ ] Tool displays extends
- [ ] Tool displays custom syntax when available
- [ ] Tool handles “no config found” gracefully

---

## 3. Dependency and terminology audit
- [ ] Search for all `eslint` imports/usages
- [ ] Search for all `@eslint/*` imports/usages
- [ ] Search for “flat config” references
- [ ] Search for UI strings mentioning ESLint
- [ ] Search for docs/README mentions of ESLint
- [ ] Search for filenames or directories branded around ESLint
- [ ] Search for tests that assume ESLint-specific output
- [ ] Search for route names and API names using ESLint terminology
- [ ] Search for config schemas/types named after ESLint models
- [ ] Search for serialization formats tied to ESLint structures

**Deliverable:**
- [ ] Replace/keep/remove audit table

---

## 4. Introduce a tool-agnostic inspection model
- [ ] Design a normalized inspector domain model
- [ ] Define shared TypeScript interfaces for normalized inspection results
- [ ] Define project-level metadata shape
- [ ] Define file target input shape
- [ ] Define resolved config result shape
- [ ] Define normalized rule entry shape
- [ ] Define normalized plugin entry shape
- [ ] Define normalized extends/source entry shape
- [ ] Define optional overrides/applicability shape
- [ ] Define diagnostics/warnings/errors shape
- [ ] Define “not found / unsupported / partial” result states
- [ ] Define API response types around the normalized model
- [ ] Add adapter interface for backend implementations
- [ ] Add placeholder ESLint adapter wrapper if needed during migration
- [ ] Ensure UI can consume normalized model instead of raw ESLint objects

**Important:**
- [ ] Avoid leaking ESLint flat config concepts into new shared interfaces
- [ ] Keep types minimal for MVP
- [ ] Mark advanced provenance fields optional

---

## 5. Stylelint backend research and integration design
- [ ] Add Stylelint integration plan
- [ ] Confirm Node API usage for `resolveConfig(filePath)`
- [ ] Confirm expected behavior when no config exists
- [ ] Confirm how `extends` is represented in resolved config
- [ ] Confirm how plugins are represented
- [ ] Confirm how `customSyntax` is represented
- [ ] Confirm whether overrides can be inspected directly or only via resolved result behavior
- [ ] Confirm whether provenance is directly available or must be inferred
- [ ] Decide what backend input parameters are needed:
  - [ ] target file path
  - [ ] cwd
  - [ ] explicit config path
  - [ ] configBasedir
  - [ ] customSyntax override
- [ ] Decide how to normalize absent or partial fields

---

## 6. Add Stylelint as a dependency
- [ ] Add `stylelint` dependency
- [ ] Install dependencies successfully
- [ ] Resolve any package conflicts
- [ ] Ensure local dev still starts after dependency changes
- [ ] Ensure CI/build still installs successfully
- [ ] Record version choice and rationale

---

## 7. Implement Stylelint inspection adapter
- [ ] Create a Stylelint adapter module
- [ ] Accept a target file path as adapter input
- [ ] Call `stylelint.resolveConfig(filePath)` correctly
- [ ] Handle undefined/no-config result safely
- [ ] Normalize resolved config into shared result model
- [ ] Extract and normalize rules
- [ ] Extract and normalize plugins
- [ ] Extract and normalize extends
- [ ] Extract and normalize custom syntax
- [ ] Extract additional useful metadata if present
- [ ] Return structured warnings/errors
- [ ] Distinguish fatal errors from “no config found”
- [ ] Add TODOs for unsupported provenance features
- [ ] Keep implementation isolated from UI code

---

## 8. Refactor server/API layer
- [ ] Identify server endpoints currently returning ESLint-specific data
- [ ] Update endpoints to use normalized result types
- [ ] Replace direct ESLint calls with adapter calls
- [ ] Preserve endpoint contracts where possible
- [ ] Update request validation for file-path-based Stylelint inspection
- [ ] Add response handling for “no config found”
- [ ] Add response handling for backend errors
- [ ] Add logging/debug output where useful
- [ ] Ensure server does not crash on unsupported inputs
- [ ] Keep API changes documented

---

## 9. Update shared serialization/static snapshot flow
- [ ] Identify snapshot/export serialization format
- [ ] Replace ESLint-specific serialized payloads
- [ ] Ensure normalized Stylelint inspection results can be serialized
- [ ] Confirm export mode still builds
- [ ] Confirm exported/static UI can consume normalized data
- [ ] Defer unsupported static features with clear notes if necessary

---

## 10. Frontend data model migration
- [ ] Replace frontend assumptions about ESLint-specific payloads
- [ ] Update client-side types to use normalized shared interfaces
- [ ] Update data-fetching hooks/services
- [ ] Update loading/error states
- [ ] Update empty-state handling
- [ ] Update not-found-state handling
- [ ] Ensure partial data still renders safely
- [ ] Remove or isolate raw ESLint object assumptions

---

## 11. UI text and branding-neutral migration
- [ ] Find all visible “ESLint” labels in the UI
- [ ] Replace with generic labels where appropriate
- [ ] Replace with “Stylelint” where product-specific wording is needed
- [ ] Remove “flat config” language unless still relevant
- [ ] Update headings/subheadings/tooltips/help text
- [ ] Update page titles
- [ ] Update browser metadata
- [ ] Update empty-state text
- [ ] Update error-state text
- [ ] Update onboarding/instructions text

---

## 12. Rules view migration
- [ ] Identify current rules table/list component
- [ ] Update rules rendering to use normalized rule entries
- [ ] Display rule names
- [ ] Display rule values/settings
- [ ] Support disabled/null/empty values correctly
- [ ] Support search/filter for rules if already present
- [ ] Ensure sorting still works if applicable
- [ ] Confirm large rule sets render acceptably
- [ ] Remove ESLint-only columns or badges
- [ ] Add Stylelint-aware presentation where useful

---

## 13. Plugins/extends/custom syntax view
- [ ] Add plugin list rendering from normalized data
- [ ] Add extends list rendering
- [ ] Add custom syntax display
- [ ] Add fallback states when fields are missing
- [ ] Confirm UI does not assume ESLint plugin structure
- [ ] Confirm complex arrays/objects are rendered readably

---

## 14. File target / inspection input UX
- [ ] Decide how user selects or enters a file path
- [ ] Update input component to reflect Stylelint usage
- [ ] Add validation for file target entry
- [ ] Add helpful placeholder examples (`.css`, `.scss`, etc.)
- [ ] Support rerunning inspection for a different file
- [ ] Confirm the inspected target is shown clearly in the UI
- [ ] Handle invalid path or unreadable file gracefully

---

## 15. Remove or disable unsupported ESLint-only features
- [ ] Identify UI sections that depend on ESLint flat config layering
- [ ] Identify sections that depend on rule provenance not available in MVP
- [ ] Identify sections that depend on ESLint-specific metadata
- [ ] Hide unsupported sections behind conditional rendering
- [ ] Remove unsupported navigation items if necessary
- [ ] Add explicit “not yet supported” messaging where useful
- [ ] Document all temporarily removed functionality

---

## 16. CLI migration
- [ ] Identify current CLI commands/options
- [ ] Decide which commands remain valid for Stylelint version
- [ ] Replace ESLint-specific help text
- [ ] Replace ESLint-specific examples
- [ ] Update command descriptions
- [ ] Ensure CLI launches the Stylelint-backed inspector
- [ ] Add/adjust file-target-related CLI options if needed
- [ ] Ensure output messages reference Stylelint correctly
- [ ] Keep backward-compatibility aliases only if useful and intentional

---

## 17. Config/path resolution edge cases
- [ ] Test CSS file targets
- [ ] Test SCSS file targets
- [ ] Test projects using `extends`
- [ ] Test projects with plugins
- [ ] Test projects with `customSyntax`
- [ ] Test explicit config path option if supported
- [ ] Test missing config behavior
- [ ] Test invalid config behavior
- [ ] Test nested workspace/subdirectory behavior
- [ ] Test monorepo-ish directory layouts
- [ ] Test Windows-style path handling if possible
- [ ] Test relative vs absolute paths

---

## 18. Error handling and diagnostics
- [ ] Define user-friendly error categories
- [ ] Handle “config not found”
- [ ] Handle “invalid config”
- [ ] Handle dependency/plugin resolution failure
- [ ] Handle unsupported syntax/custom syntax errors
- [ ] Handle path resolution errors
- [ ] Handle malformed adapter output
- [ ] Surface actionable error messages in UI
- [ ] Surface actionable error messages in CLI
- [ ] Log raw error details for debugging without making UI noisy

---

## 19. Testing
### Unit tests
- [ ] Normalization of rules
- [ ] Normalization of plugins
- [ ] Normalization of extends
- [ ] Normalization of custom syntax
- [ ] Not-found result mapping
- [ ] Error result mapping

### Integration tests
- [ ] Server/API returns expected normalized payload
- [ ] Adapter works against a fixture project with Stylelint config
- [ ] Adapter handles fixture project with no config
- [ ] Adapter handles fixture project with invalid config

### UI tests
- [ ] Rules render from normalized payload
- [ ] Plugin/extends/custom syntax sections render
- [ ] Error state renders
- [ ] No-config state renders
- [ ] Loading state renders

### Regression tests
- [ ] Existing generic shell behavior still works
- [ ] Static build still works if retained
- [ ] CLI startup still works

---

## 20. Fixture projects for testing
- [ ] Add minimal CSS fixture project
- [ ] Add SCSS fixture project
- [ ] Add fixture with `extends`
- [ ] Add fixture with plugins
- [ ] Add fixture with custom syntax
- [ ] Add fixture with no config
- [ ] Add fixture with broken config
- [ ] Keep fixtures small and deterministic

---

## 21. Documentation updates
- [ ] Update README title
- [ ] Update project description
- [ ] Update installation instructions
- [ ] Update usage instructions
- [ ] Update CLI examples
- [ ] Update screenshots/gifs
- [ ] Document supported file types
- [ ] Document MVP limitations
- [ ] Document unsupported features
- [ ] Document development workflow
- [ ] Document testing workflow
- [ ] Document architecture/adapters if helpful
- [ ] Document migration rationale from fork

---

## 22. Package/app renaming
- [ ] Choose final package name
- [ ] Update package metadata
- [ ] Update bin name if applicable
- [ ] Update app title
- [ ] Update browser title/meta
- [ ] Update repository description if desired
- [ ] Update references in code comments
- [ ] Update references in generated artifacts
- [ ] Search again for leftover `eslint` branding
- [ ] Search again for leftover `config-inspector` naming that should change

---

## 23. Build, release, and distribution
- [ ] Ensure local dev mode works
- [ ] Ensure production build works
- [ ] Ensure static/export build works if supported
- [ ] Ensure CLI package builds correctly
- [ ] Ensure artifacts have correct naming
- [ ] Ensure no broken imports remain
- [ ] Ensure lockfile is updated
- [ ] Draft release notes
- [ ] Tag MVP release plan
- [ ] Decide publish/private/internal strategy

---

## 24. Post-MVP enhancements
- [ ] Rule provenance tracing
- [ ] Explain “why this rule has this value”
- [ ] Override visualization
- [ ] Compare two file targets
- [ ] Better monorepo root selection
- [ ] Watch mode/live reload
- [ ] Richer config source graph
- [ ] Search improvements
- [ ] Performance tuning for large configs
- [ ] Better plugin metadata display
- [ ] Export/share snapshots
- [ ] More syntax/ecosystem support (Vue, CSS-in-JS, etc.)

---

## Minimal MVP checklist
If you want the shortest version, this is the **must-have MVP** subset:

- [ ] Fork repo and confirm baseline works
- [ ] Map architecture and locate ESLint-specific inspection logic
- [ ] Add normalized adapter types/interfaces
- [ ] Add `stylelint` dependency
- [ ] Implement Stylelint adapter using `resolveConfig(filePath)`
- [ ] Normalize rules/plugins/extends/custom syntax
- [ ] Replace backend/server ESLint calls with adapter calls
- [ ] Update frontend to render normalized data
- [ ] Replace ESLint-specific UI labels
- [ ] Handle “no config found” safely
- [ ] Add tests for config found / not found / invalid config
- [ ] Update README and package branding
- [ ] Produce first working MVP build

---

## Suggested issue breakdown
A good project board could be:

## Epic 1 — Discovery
- [ ] Audit architecture
- [ ] Audit ESLint coupling
- [ ] Define MVP scope

## Epic 2 — Core abstraction
- [ ] Create normalized types
- [ ] Create adapter boundary
- [ ] Refactor API contracts

## Epic 3 — Stylelint backend
- [ ] Add dependency
- [ ] Implement config resolution
- [ ] Normalize result payload
- [ ] Add backend tests

## Epic 4 — UI migration
- [ ] Update data flow
- [ ] Update rules page
- [ ] Add plugins/extends/custom syntax support
- [ ] Remove unsupported ESLint-only sections

## Epic 5 — Product polish
- [ ] Rename branding
- [ ] Update CLI/help text
- [ ] Update docs
- [ ] Validate builds

## Epic 6 — Future parity
- [ ] Provenance
- [ ] Monorepo UX
- [ ] Export polish
- [ ] Comparison tooling

---

## Strong definition of done
You can say the project is “done” for MVP when:

- [ ] A user can launch the app/CLI from the fork
- [ ] A user can inspect a CSS/SCSS file target
- [ ] The effective Stylelint config is shown clearly
- [ ] Rules/plugins/extends/custom syntax are visible when present
- [ ] No-config and invalid-config cases are handled well
- [ ] The UI no longer feels mislabeled as ESLint
- [ ] Tests cover the main inspection path
- [ ] README explains how to use it
- [ ] Build output works cleanly

If you want, I can next turn this into either:
1. a **GitHub issues backlog**, or
2. a **dependency-ordered execution checklist** with “do this first, then this” sequencing.
