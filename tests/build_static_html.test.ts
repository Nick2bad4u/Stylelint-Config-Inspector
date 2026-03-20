import { describe, expect, it } from 'vitest'
import { rewriteStaticHtmlWithBase } from '../src/build-static-html'

describe('rewriteStaticHtmlWithBase', () => {
  it('rewrites absolute asset URLs and runtime baseURL for subpath deployments', () => {
    const html = [
      '<link rel="stylesheet" href="/_nuxt/app.css">',
      '<img src="/logo.svg">',
      '<script>window.__NUXT__={config:{app:{baseURL:"/"}}}</script>',
    ].join('')

    const rewritten = rewriteStaticHtmlWithBase(
      html,
      '/eslint-plugin-typefest/stylelint-inspector/',
    )

    expect(rewritten).toContain('href="/eslint-plugin-typefest/stylelint-inspector/_nuxt/app.css"')
    expect(rewritten).toContain('src="/eslint-plugin-typefest/stylelint-inspector/logo.svg"')
    expect(rewritten).toContain('baseURL:"/eslint-plugin-typefest/stylelint-inspector/"')
  })

  it('rewrites importmap #entry path so _nuxt chunks resolve under base path', () => {
    const html = '<script type="importmap">{"imports":{"#entry":"/_nuxt/T86v09Lr.js"}}</script>'

    const rewritten = rewriteStaticHtmlWithBase(
      html,
      '/eslint-plugin-typefest/stylelint-inspector/',
    )

    expect(rewritten).toContain(
      '"#entry":"/eslint-plugin-typefest/stylelint-inspector/_nuxt/T86v09Lr.js"',
    )
  })

  it('does not rewrite when base URL is root', () => {
    const html = '<script type="importmap">{"imports":{"#entry":"/_nuxt/T86v09Lr.js"}}</script>'

    expect(rewriteStaticHtmlWithBase(html, '/')).toBe(html)
  })
})
