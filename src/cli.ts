import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import process from 'node:process'
import c from 'ansis'

import cac from 'cac'
import { getPort } from 'get-port-please'
import open from 'open'
import { relative, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { readConfig } from './configs'
import { MARK_CHECK, MARK_INFO } from './constants'
import { distDir } from './dirs'
import { ConfigInspectorError } from './errors'
import { createHostServer } from './server'

const RE_CONSECUTIVE_SLASHES = /\/+/g
const RE_ABSOLUTE_ASSET_ATTR = /\s(href|src)="\//g

const cli = cac('stylelint-config-inspector')

cli
  .command(
    'build',
    'Build inspector with current config file for static hosting',
  )
  .option('--config <configFile>', 'Config file path')
  .option('--files', 'Include matched file paths in payload', {
    default: true,
  })
  .option('--file <filePath>', 'Alias of --target')
  .option(
    '--target <filePath>',
    'Target file path used to resolve effective config',
    { default: 'stylelint-inspector-target.css' },
  )
  .option(
    '--basePath <basePath>',
    'Base directory for globs to resolve. Default to directory of config file if not provided',
  )
  // Build specific options
  .option('--base <baseURL>', 'Base URL for deployment', { default: '/' })
  .option('--outDir <dir>', 'Output directory', {
    default: '.stylelint-config-inspector',
  })
  // Action
  .action(async (options) => {
    console.log(MARK_INFO, 'Building static Stylelint config inspector...')

    if (process.env.STYLELINT_CONFIG || process.env.ESLINT_CONFIG) {
      options.config
        ||= process.env.STYLELINT_CONFIG || process.env.ESLINT_CONFIG
    }
    if (process.env.STYLELINT_BASE_PATH || process.env.ESLINT_BASE_PATH) {
      options.basePath
        ||= process.env.STYLELINT_BASE_PATH || process.env.ESLINT_BASE_PATH
    }
    if (process.env.STYLELINT_TARGET || process.env.ESLINT_TARGET) {
      options.target
        ||= process.env.STYLELINT_TARGET || process.env.ESLINT_TARGET
    }

    options.target ||= options.file

    const cwd = process.cwd()
    const outDir = resolve(cwd, options.outDir)

    let configs
    try {
      configs = await readConfig({
        cwd,
        userConfigPath: options.config,
        userBasePath: options.basePath,
        globMatchedFiles: options.files,
        targetFilePath: options.target,
      })
    }
    catch (error) {
      if (error instanceof ConfigInspectorError) {
        error.prettyPrint()
        process.exit(1)
      }
      throw error
    }

    let baseURL = options.base
    if (!baseURL.endsWith('/'))
      baseURL += '/'
    if (!baseURL.startsWith('/'))
      baseURL = `/${baseURL}`
    baseURL = baseURL.replace(RE_CONSECUTIVE_SLASHES, '/')

    if (existsSync(outDir))
      await fs.rm(outDir, { recursive: true })
    await fs.mkdir(outDir, { recursive: true })
    await fs.cp(distDir, outDir, { recursive: true })
    const htmlFiles = await glob('**/*.html', {
      cwd: distDir,
      onlyFiles: true,
      expandDirectories: false,
    })
    // Rewrite HTML files with base URL
    if (baseURL !== '/') {
      for (const file of htmlFiles) {
        if (!file)
          continue
        const content = await fs.readFile(resolve(distDir, file), 'utf-8')
        const newContent = content
          .replaceAll(RE_ABSOLUTE_ASSET_ATTR, ` $1="${baseURL}`)
          .replaceAll('baseURL:"/"', `baseURL:"${baseURL}"`)
        await fs.writeFile(resolve(outDir, file), newContent, 'utf-8')
      }
    }
    await fs.mkdir(resolve(outDir, 'api'), { recursive: true })

    configs.payload.meta.configPath = ''
    configs.payload.meta.basePath = ''
    await fs.writeFile(
      resolve(outDir, 'api/payload.json'),
      JSON.stringify(configs.payload, null, 2),
      'utf-8',
    )

    console.log(MARK_CHECK, `Built to ${relative(cwd, outDir)}`)
    console.log(
      MARK_INFO,
      `You can use static server like \`npx serve ${relative(cwd, outDir)}\` to serve the inspector`,
    )
  })

cli
  .command('', 'Start dev inspector')
  .option('--config <configFile>', 'Config file path')
  .option('--files', 'Include matched file paths in payload', {
    default: true,
  })
  .option('--file <filePath>', 'Alias of --target')
  .option(
    '--target <filePath>',
    'Target file path used to resolve effective config',
    { default: 'stylelint-inspector-target.css' },
  )
  .option(
    '--basePath <basePath>',
    'Base directory for globs to resolve. Default to directory of config file if not provided',
  )
  // Dev specific options
  .option('--host <host>', 'Host', {
    default: process.env.HOST || '127.0.0.1',
  })
  .option('--port <port>', 'Port', { default: process.env.PORT || 8888 })
  .option('--open', 'Open browser', { default: true })
  // Action
  .action(async (options) => {
    const host = options.host
    const port = await getPort({
      port: options.port,
      portRange: [8888, 10000],
      host,
    })

    if (process.env.STYLELINT_CONFIG || process.env.ESLINT_CONFIG) {
      options.config
        ||= process.env.STYLELINT_CONFIG || process.env.ESLINT_CONFIG
    }
    if (process.env.STYLELINT_BASE_PATH || process.env.ESLINT_BASE_PATH) {
      options.basePath
        ||= process.env.STYLELINT_BASE_PATH || process.env.ESLINT_BASE_PATH
    }
    if (process.env.STYLELINT_TARGET || process.env.ESLINT_TARGET) {
      options.target
        ||= process.env.STYLELINT_TARGET || process.env.ESLINT_TARGET
    }

    options.target ||= options.file

    console.log(
      MARK_INFO,
      `Starting Stylelint config inspector at`,
      c.green`http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`,
      '\n',
    )

    const cwd = process.cwd()
    const server = await createHostServer({
      cwd,
      userConfigPath: options.config,
      userBasePath: options.basePath,
      globMatchedFiles: options.files,
      targetFilePath: options.target,
    })

    server.listen(port, host, async () => {
      if (options.open) {
        await open(
          `http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`,
        )
      }
    })
  })

cli.help()
cli.parse()
