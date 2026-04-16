import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

const moduleDir = dirname(fileURLToPath(import.meta.url))

const distDirCandidates = [
  join(moduleDir, '../dist/public'),
  join(moduleDir, './public'),
] as const

export const dataDir: string = fileURLToPath(
  new URL('../.stylelint-config-inspector', import.meta.url),
)
export const distDir: string
  = distDirCandidates.find(path => existsSync(path)) ?? distDirCandidates[0]
