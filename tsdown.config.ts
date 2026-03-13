import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/cli.ts',
  ],
  deps: {
    onlyBundle: false,
  },
  clean: false,
  inputOptions: {
    experimental: {
      resolveNewUrlToAsset: false,
    },
  },
})
