# Browser testing

The Playwright suite tests the built inspector in Chromium and Firefox. Most scenarios use deterministic payloads and mocked API responses; separate live tests run the packaged CLI against real Stylelint fixtures.

## Run the suite

Install dependencies and browser binaries, then run the tests:

```sh
npm ci
npm run playwright:install
npm run test:e2e
```

Local runs default to Chromium. To include Firefox in PowerShell:

```powershell
$env:PLAYWRIGHT_ALL_BROWSERS = '1'
npm run test:e2e
```

CI always includes both browsers. Local runs use two workers to bound browser memory and socket use; CI uses one. The configured web server builds the frontend and profiling worker before serving the production app on port 4173. Stop an existing server on that port before release validation so tests cannot reuse stale assets. Do not run the Nuxt development server during browser validation because it shares the build output directory.

For a focused run against a current build:

```sh
npx playwright test tests/e2e/configs-files-interactions.spec.ts --workers=1
```

## Behavioral coverage

| Area               | Covered interactions and states                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared application | Initial loading, configuration and network errors, keyboard retry, live update recovery and disconnection, navigation, theme/font preferences, disabled-rule dimming and deprecated-rule shortcuts                                                                         |
| Configs            | Filepath autocomplete and keyboard selection, individual and combined filter clearing, plugin/rule filters, list/grid persistence, matched and merged views, specific-only selection, expand/collapse, summary actions and configuration metadata                          |
| Rules              | Search and plugin filters, state/status combinations, keyboard radio selection, layout persistence, rule details, configured/default options, canonical-name copying and documentation links                                                                               |
| Extends            | Entry selection, metadata/rule search, rule lists, documentation availability, missing metadata, empty results and configuration navigation                                                                                                                                |
| Files              | List/group selection and persistence, group/section expansion, file-to-config navigation, glob/config popovers, unmatched groups and unavailable file payloads                                                                                                             |
| Stats              | Explicit run and rerun, polling, navigation during analysis, failed status/start/run recovery, last-success preservation, stale reports after live updates, rule/plugin pagination, metadata-aware grouping, keyboard expansion, unsupported versions and static snapshots |
| Dev                | Snapshot counts, runtime/config metadata, diagnostics, ignore details and current persisted viewer state                                                                                                                                                                   |
| Packaged runtime   | Real core/plugin timing, unchanged sources/cache, root and nested static exports, builds without stats and failed explicit analysis                                                                                                                                        |

The visual matrix covers all six pages in both themes at 1440×900 and 390×844. Additional 320px and 768px scenarios exercise long metadata, the largest font setting, keyboard focus, reduced motion and open popovers. Tests assert document bounds while allowing intentional scrolling inside code and rule panels.

## Reports and maintenance

Open the HTML report with `npx playwright show-report`. Successful page and stress screenshots are attached to the report, so the existing CI artifact retains them alongside failure screenshots, traces and videos. Local image copies are written under `output/playwright/after/` and `output/playwright/stress/`.

Add tests for observable outcomes, using roles, accessible names and stable test IDs. Assert both the selected control and its resulting content. Avoid arbitrary sleeps, external website dependencies and assertions that only repeat CSS implementation. Use isolated fixtures and ports for live tests, and retain byte-preservation assertions when changing profiling.

Screenshots support review; they do not replace interaction assertions or manual inspection. The suite covers control families and important states rather than every possible combination of configurations, plugins and viewport sizes.
