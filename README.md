# Stylelint Config Inspector

[![npm license.](https://flat.badgen.net/npm/license/stylelint-config-inspector?color=purple)](https://github.com/Nick2bad4u/stylelint-config-inspector/blob/main/LICENSE) [![npm total downloads.](https://flat.badgen.net/npm/dt/stylelint-config-inspector?color=pink)](https://www.npmjs.com/package/stylelint-config-inspector) [![latest GitHub release.](https://flat.badgen.net/github/release/Nick2bad4u/stylelint-config-inspector?color=cyan)](https://github.com/Nick2bad4u/stylelint-config-inspector/releases) [![GitHub stars.](https://flat.badgen.net/github/stars/Nick2bad4u/stylelint-config-inspector?color=yellow)](https://github.com/Nick2bad4u/stylelint-config-inspector/stargazers) [![GitHub forks.](https://flat.badgen.net/github/forks/Nick2bad4u/stylelint-config-inspector?color=green)](https://github.com/Nick2bad4u/stylelint-config-inspector/forks) [![GitHub open issues.](https://flat.badgen.net/github/open-issues/Nick2bad4u/stylelint-config-inspector?color=red)](https://github.com/Nick2bad4u/stylelint-config-inspector/issues) [![codecov.](https://flat.badgen.net/codecov/github/Nick2bad4u/stylelint-config-inspector?color=blue)](https://codecov.io/gh/Nick2bad4u/stylelint-config-inspector)

A visual tool for inspecting and understanding your Stylelint configuration.

## Screenshot

<p align="center">
  <img src="https://raw.githubusercontent.com/Nick2bad4u/Stylelint-Config-Inspector/refs/heads/main/docs/assets/stylelint-inspector-screenshot.svg" alt="Stylelint Config Inspector">
</p>

## Usage

From a project that contains a Stylelint config (`stylelint.config.*` or `.stylelintrc*`), run:

```bash
npx stylelint-config-inspector@latest
```

Then open http://localhost:8888/ (If it does not open automatically) to explore your config.

### Resolve for a target file

Use a target file so Stylelint resolves context-sensitive options (`overrides`, `customSyntax`, etc.):

```bash
npx stylelint-config-inspector --file src/styles/app.css
```

If you do not provide `--file` or `--target`, the inspector resolves your config against a synthetic file named `stylelint-inspector-target.css` relative to the resolved base path.

`--file` and `--target` are equivalent.

### Static build

To generate a static inspector snapshot:

```bash
npx stylelint-config-inspector build
```

This emits a single-page app in `.stylelint-config-inspector`.

### Monorepo / package subdirectory inspection

When inspecting a package inside a monorepo, set the base path for file glob matching and target resolution:

```bash
npx stylelint-config-inspector --config stylelint.config.mjs --basePath packages/web --file src/app.css
```

Environment aliases are also supported:

- `STYLELINT_BASE_PATH` (or legacy `ESLINT_BASE_PATH`)
- `STYLELINT_TARGET` (or legacy `ESLINT_TARGET`)

Run `npx stylelint-config-inspector --help` for all options.

## License

[Apache-2.0](./LICENSE)

## Contributors ✨

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors.](https://img.shields.io/badge/all_contributors-39-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/9romise"><img src="https://avatars.githubusercontent.com/9romise?v=4?s=80" width="80px;" alt="9romise"/><br /><sub><b>9romise</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=9romise" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Nick2bad4u"><img src="https://avatars.githubusercontent.com/u/20943337?v=4?s=80" width="80px;" alt="Nick2bad4u"/><br /><sub><b>Nick2bad4u</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/issues?q=author%3ANick2bad4u" title="Bug reports">🐛</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=Nick2bad4u" title="Code">💻</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=Nick2bad4u" title="Documentation">📖</a> <a href="#ideas-Nick2bad4u" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-Nick2bad4u" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-Nick2bad4u" title="Maintenance">🚧</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/pulls?q=is%3Apr+reviewed-by%3ANick2bad4u" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=Nick2bad4u" title="Tests">⚠️</a> <a href="#tool-Nick2bad4u" title="Tools">🔧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Pixel998"><img src="https://avatars.githubusercontent.com/Pixel998?v=4?s=80" width="80px;" alt="Pixel998"/><br /><sub><b>Pixel998</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=Pixel998" title="Code">💻</a> <a href="#infra-Pixel998" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://snyk.io/"><img src="https://avatars.githubusercontent.com/u/19733683?v=4?s=80" width="80px;" alt="Snyk bot"/><br /><sub><b>Snyk bot</b></sub></a><br /><a href="#security-snyk-bot" title="Security">🛡️</a> <a href="#infra-snyk-bot" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-snyk-bot" title="Maintenance">🚧</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/pulls?q=is%3Apr+reviewed-by%3Asnyk-bot" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/StarHeartHunt"><img src="https://avatars.githubusercontent.com/StarHeartHunt?v=4?s=80" width="80px;" alt="StarHeartHunt"/><br /><sub><b>StarHeartHunt</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=StarHeartHunt" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.stepsecurity.io/"><img src="https://avatars.githubusercontent.com/u/89328645?v=4?s=80" width="80px;" alt="StepSecurity Bot"/><br /><sub><b>StepSecurity Bot</b></sub></a><br /><a href="#security-step-security-bot" title="Security">🛡️</a> <a href="#infra-step-security-bot" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-step-security-bot" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/aladdin-add"><img src="https://avatars.githubusercontent.com/aladdin-add?v=4?s=80" width="80px;" alt="aladdin-add"/><br /><sub><b>aladdin-add</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=aladdin-add" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/amareshsm"><img src="https://avatars.githubusercontent.com/amareshsm?v=4?s=80" width="80px;" alt="amareshsm"/><br /><sub><b>amareshsm</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=amareshsm" title="Code">💻</a> <a href="#infra-amareshsm" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/antfu"><img src="https://avatars.githubusercontent.com/antfu?v=4?s=80" width="80px;" alt="antfu"/><br /><sub><b>antfu</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=antfu" title="Code">💻</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=antfu" title="Documentation">📖</a> <a href="#infra-antfu" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/benmccann"><img src="https://avatars.githubusercontent.com/benmccann?v=4?s=80" width="80px;" alt="benmccann"/><br /><sub><b>benmccann</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=benmccann" title="Code">💻</a> <a href="#infra-benmccann" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/brettz9"><img src="https://avatars.githubusercontent.com/brettz9?v=4?s=80" width="80px;" alt="brettz9"/><br /><sub><b>brettz9</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=brettz9" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/clemyan"><img src="https://avatars.githubusercontent.com/clemyan?v=4?s=80" width="80px;" alt="clemyan"/><br /><sub><b>clemyan</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=clemyan" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/coliff"><img src="https://avatars.githubusercontent.com/coliff?v=4?s=80" width="80px;" alt="coliff"/><br /><sub><b>coliff</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=coliff" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apps/dependabot"><img src="https://avatars.githubusercontent.com/in/29110?v=4?s=80" width="80px;" alt="dependabot[bot]"/><br /><sub><b>dependabot[bot]</b></sub></a><br /><a href="#infra-dependabot[bot]" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#security-dependabot[bot]" title="Security">🛡️</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/eslintbot"><img src="https://avatars.githubusercontent.com/eslintbot?v=4?s=80" width="80px;" alt="eslintbot"/><br /><sub><b>eslintbot</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=eslintbot" title="Code">💻</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=eslintbot" title="Documentation">📖</a> <a href="#infra-eslintbot" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-eslintbot" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/github-actions%5Bbot%5D"><img src="https://avatars.githubusercontent.com/github-actions%5Bbot%5D?v=4?s=80" width="80px;" alt="github-actions[bot]"/><br /><sub><b>github-actions[bot]</b></sub></a><br /><a href="#infra-github-actions[bot]" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-github-actions[bot]" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hyoban"><img src="https://avatars.githubusercontent.com/hyoban?v=4?s=80" width="80px;" alt="hyoban"/><br /><sub><b>hyoban</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=hyoban" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kabirsky"><img src="https://avatars.githubusercontent.com/kabirsky?v=4?s=80" width="80px;" alt="kabirsky"/><br /><sub><b>kabirsky</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=kabirsky" title="Code">💻</a> <a href="#infra-kabirsky" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kecrily"><img src="https://avatars.githubusercontent.com/kecrily?v=4?s=80" width="80px;" alt="kecrily"/><br /><sub><b>kecrily</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=kecrily" title="Code">💻</a> <a href="#infra-kecrily" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kron-sh"><img src="https://avatars.githubusercontent.com/kron-sh?v=4?s=80" width="80px;" alt="kron-sh"/><br /><sub><b>kron-sh</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=kron-sh" title="Code">💻</a> <a href="#infra-kron-sh" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lumirlumir"><img src="https://avatars.githubusercontent.com/lumirlumir?v=4?s=80" width="80px;" alt="lumirlumir"/><br /><sub><b>lumirlumir</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=lumirlumir" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lvjiaxuan"><img src="https://avatars.githubusercontent.com/lvjiaxuan?v=4?s=80" width="80px;" alt="lvjiaxuan"/><br /><sub><b>lvjiaxuan</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=lvjiaxuan" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mdjermanovic"><img src="https://avatars.githubusercontent.com/mdjermanovic?v=4?s=80" width="80px;" alt="mdjermanovic"/><br /><sub><b>mdjermanovic</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=mdjermanovic" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/michkot"><img src="https://avatars.githubusercontent.com/michkot?v=4?s=80" width="80px;" alt="michkot"/><br /><sub><b>michkot</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=michkot" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mmkal"><img src="https://avatars.githubusercontent.com/mmkal?v=4?s=80" width="80px;" alt="mmkal"/><br /><sub><b>mmkal</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=mmkal" title="Code">💻</a> <a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=mmkal" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ntnyq"><img src="https://avatars.githubusercontent.com/ntnyq?v=4?s=80" width="80px;" alt="ntnyq"/><br /><sub><b>ntnyq</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=ntnyq" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nzakas"><img src="https://avatars.githubusercontent.com/nzakas?v=4?s=80" width="80px;" alt="nzakas"/><br /><sub><b>nzakas</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=nzakas" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/rakleed"><img src="https://avatars.githubusercontent.com/rakleed?v=4?s=80" width="80px;" alt="rakleed"/><br /><sub><b>rakleed</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=rakleed" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/renovate%5Bbot%5D"><img src="https://avatars.githubusercontent.com/renovate%5Bbot%5D?v=4?s=80" width="80px;" alt="renovate[bot]"/><br /><sub><b>renovate[bot]</b></sub></a><br /><a href="#infra-renovate[bot]" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-renovate[bot]" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/rotu"><img src="https://avatars.githubusercontent.com/rotu?v=4?s=80" width="80px;" alt="rotu"/><br /><sub><b>rotu</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=rotu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/scottohara"><img src="https://avatars.githubusercontent.com/scottohara?v=4?s=80" width="80px;" alt="scottohara"/><br /><sub><b>scottohara</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=scottohara" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/typed-sigterm"><img src="https://avatars.githubusercontent.com/typed-sigterm?v=4?s=80" width="80px;" alt="typed-sigterm"/><br /><sub><b>typed-sigterm</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=typed-sigterm" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vinayakkulkarni"><img src="https://avatars.githubusercontent.com/vinayakkulkarni?v=4?s=80" width="80px;" alt="vinayakkulkarni"/><br /><sub><b>vinayakkulkarni</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=vinayakkulkarni" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/voxpelli"><img src="https://avatars.githubusercontent.com/voxpelli?v=4?s=80" width="80px;" alt="voxpelli"/><br /><sub><b>voxpelli</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=voxpelli" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/webdiscus"><img src="https://avatars.githubusercontent.com/webdiscus?v=4?s=80" width="80px;" alt="webdiscus"/><br /><sub><b>webdiscus</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=webdiscus" title="Code">💻</a> <a href="#infra-webdiscus" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/will-stone"><img src="https://avatars.githubusercontent.com/will-stone?v=4?s=80" width="80px;" alt="will-stone"/><br /><sub><b>will-stone</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=will-stone" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ycs77"><img src="https://avatars.githubusercontent.com/ycs77?v=4?s=80" width="80px;" alt="ycs77"/><br /><sub><b>ycs77</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=ycs77" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yidingww"><img src="https://avatars.githubusercontent.com/yidingww?v=4?s=80" width="80px;" alt="yidingww"/><br /><sub><b>yidingww</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=yidingww" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yuyinws"><img src="https://avatars.githubusercontent.com/yuyinws?v=4?s=80" width="80px;" alt="yuyinws"/><br /><sub><b>yuyinws</b></sub></a><br /><a href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector/commits?author=yuyinws" title="Code">💻</a> <a href="#infra-yuyinws" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
