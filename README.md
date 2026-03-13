<img src="./public/favicon.svg" width="100" height="100" alt="Stylelint Config Inspector"><br>

# Stylelint Config Inspector

A visual tool for inspecting and understanding your Stylelint configuration.

## Usage

From a project that contains a Stylelint config (`stylelint.config.*` or `.stylelintrc*`), run:

```bash
npx @stylelint/config-inspector@latest
```

Then open http://localhost:7777/.

### Resolve for a target file

Use a target file so Stylelint resolves context-sensitive options (`overrides`, `customSyntax`, etc.):

```bash
npx @stylelint/config-inspector --file src/styles/app.css
```

`--target` is also supported as a backward-compatible alias.

### Static build

To generate a static inspector snapshot:

```bash
npx @stylelint/config-inspector build
```

This emits a single-page app in `.stylelint-config-inspector`.

### Monorepo / package subdirectory inspection

When inspecting a package inside a monorepo, set the base path for file glob matching and target resolution:

```bash
npx @stylelint/config-inspector --config stylelint.config.mjs --basePath packages/web --file src/app.css
```

Environment aliases are also supported:

- `STYLELINT_BASE_PATH` (or legacy `ESLINT_BASE_PATH`)
- `STYLELINT_TARGET` (or legacy `ESLINT_TARGET`)

Run `npx @stylelint/config-inspector --help` for all options.

## Development

- `npm install`
- `npm run dev` to run Nuxt dev server
- `npm test` to run tests
- `npm run typecheck` for type checks
- `npm run build` for production build

## License

[Apache-2.0](./LICENSE)
