#!/usr/bin/env node

import { access } from 'node:fs/promises'
import process from 'node:process'

const cliEntrypoint = new URL('./dist/cli.mjs', import.meta.url)

async function main() {
  try {
    await access(cliEntrypoint)
    await import(cliEntrypoint.href)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error('Stylelint Config Inspector build output is missing (dist/cli.mjs).')
      console.error('Run `npm run build` in this repository, then rerun the command.')
      process.exit(1)
    }
    throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
