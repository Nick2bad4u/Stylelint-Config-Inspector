import type { CreateWsServerOptions } from './ws'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp, eventHandler, serveStatic, setResponseHeader } from 'h3'
import { toNodeHandler } from 'h3/node'
import { lookup } from 'mrmime'
import { extname, join } from 'pathe'
import { distDir } from './dirs'
import { createWsServer } from './ws'

const LEADING_SLASHES_RE = /^\/+/

export async function createHostServer(options: CreateWsServerOptions) {
  const app = createApp()

  const ws = await createWsServer(options)

  const fileMap = new Map<string, Promise<Uint8Array | undefined>>()
  const readCachedFile = (id: string) => {
    if (!fileMap.has(id))
      fileMap.set(id, readFile(id).catch(() => undefined))
    return fileMap.get(id)
  }

  const resolveDistFilePath = (id: string): { relative: string, absolute: string } | undefined => {
    const cleanId = id
      .split('?')[0]
      ?.split('#')[0]
      ?.replace(LEADING_SLASHES_RE, '')

    if (!cleanId)
      return

    return {
      relative: cleanId,
      absolute: join(distDir, cleanId),
    }
  }

  const shouldServeIndexFallback = (path: string): boolean => {
    if (path === '/')
      return true

    if (path.startsWith('/_nuxt/') || path.startsWith('/api/'))
      return false

    return extname(path) === ''
  }

  app.use('/api/payload.json', eventHandler(() => ws.getData()))

  app.use(eventHandler(async (event) => {
    const indexHtml = await readCachedFile(join(distDir, 'index.html'))

    if (event.path === '/' && indexHtml) {
      setResponseHeader(event, 'Content-Type', 'text/html; charset=UTF-8')
      return indexHtml
    }

    const result = await serveStatic(event, {
      fallthrough: true,
      getContents: (id) => {
        if (!id)
          return undefined

        const resolved = resolveDistFilePath(id)
        if (!resolved)
          return undefined

        return readCachedFile(resolved.absolute)
      },
      getMeta: async (id) => {
        if (!id)
          return

        const resolved = resolveDistFilePath(id)
        if (!resolved)
          return

        const stats = await stat(resolved.absolute).catch(() => {})
        if (!stats || !stats.isFile())
          return

        return {
          type: lookup(resolved.relative),
          size: stats.size,
          mtime: stats.mtimeMs,
        }
      },
    })

    if (!result && shouldServeIndexFallback(event.path)) {
      if (indexHtml)
        setResponseHeader(event, 'Content-Type', 'text/html; charset=UTF-8')
      return indexHtml
    }

    return result
  }))

  return createServer(toNodeHandler(app))
}
