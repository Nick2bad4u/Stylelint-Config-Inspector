import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'

const readConfigMock = vi.fn()
const resolveConfigPathMock = vi.fn()

vi.mock('../src/configs', () => ({
  readConfig: readConfigMock,
  resolveConfigPath: resolveConfigPathMock,
}))

const tempDirs: string[] = []

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true })),
  )
})

describe('ws error payload contract', () => {
  it('returns a valid payload shape when readConfig throws', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'stylelint-config-inspector-ws-'))
    tempDirs.push(cwd)

    resolveConfigPathMock.mockResolvedValue({
      basePath: cwd,
      configPath: join(cwd, 'stylelint.config.mjs'),
    })
    readConfigMock.mockRejectedValue(new Error('broken config'))

    const { createWsServer } = await import('../src/ws')
    const server = await createWsServer({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    try {
      const data = await server.getData()

      expect(data.configs).toEqual([])
      expect(data.rules).toEqual({})
      expect(data.meta.engine).toBe('stylelint')
      expect(data.meta.basePath).toBe(cwd)
      expect(data.meta.configPath).toBe('stylelint.config.mjs')
      expect(data.meta.targetFilePath).toBe('src/styles.css')
      expect(data.diagnostics?.[0]).toContain(
        'Failed to load Stylelint configuration',
      )
      expect(
        data.diagnostics?.some((note: string) =>
          note.includes('broken config'),
        ),
      ).toBe(true)
    }
    finally {
      await server.watcher.close()
      await new Promise<void>((resolve, reject) => {
        server.wss.close((error) => {
          if (error)
            reject(error)
          else resolve()
        })
      })
    }
  })
})
