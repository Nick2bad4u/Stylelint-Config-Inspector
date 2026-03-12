import type { WebSocket } from 'ws'
import type { Payload } from '~~/shared/types'
import type { ReadConfigOptions } from './configs'
import process from 'node:process'
import chokidar from 'chokidar'
import { getPort } from 'get-port-please'
import { normalize, relative } from 'pathe'
import { WebSocketServer } from 'ws'
import { readConfig, resolveConfigPath } from './configs'
import { MARK_CHECK } from './constants'
import { ConfigInspectorError } from './errors'

const readErrorWarning = `Failed to load Stylelint configuration.
Please ensure a valid Stylelint config can be resolved:
https://stylelint.io/user-guide/configure`

export interface CreateWsServerOptions extends ReadConfigOptions {}

export async function createWsServer(options: CreateWsServerOptions) {
  let payload: Payload | undefined
  const port = await getPort({ port: 7811, random: true })
  const wss = new WebSocketServer({
    port,
  })
  const wsClients = new Set<WebSocket>()

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    console.log(MARK_CHECK, 'Websocket client connected')
    ws.on('close', () => wsClients.delete(ws))
  })

  let resolvedConfigPath: Awaited<ReturnType<typeof resolveConfigPath>>
  try {
    resolvedConfigPath = await resolveConfigPath(options)
  }
  catch (e) {
    if (e instanceof ConfigInspectorError) {
      e.prettyPrint()
      process.exit(1)
    }
    else {
      throw e
    }
  }

  const { basePath } = resolvedConfigPath

  function toRelativePath(path: string): string {
    const result = relative(options.cwd, path).replaceAll('\\', '/')
    return result.length ? result : normalize(path).replaceAll('\\', '/')
  }

  function createErrorPayload(error: unknown): Payload {
    const diagnostic = error instanceof Error
      ? error.message
      : String(error)

    return {
      configs: [],
      rules: {},
      diagnostics: [readErrorWarning, diagnostic],
      meta: {
        wsPort: port,
        engine: 'stylelint',
        targetFilePath: options.targetFilePath,
        lastUpdate: Date.now(),
        basePath,
        configPath: resolvedConfigPath.configPath
          ? toRelativePath(resolvedConfigPath.configPath)
          : '',
      },
    }
  }

  const watcher = chokidar.watch([], {
    ignoreInitial: true,
    cwd: basePath,
  })

  watcher.on('change', (path) => {
    payload = undefined
    console.log()
    console.log(MARK_CHECK, 'Config change detected', path)
    wsClients.forEach((ws) => {
      ws.send(JSON.stringify({
        type: 'config-change',
        path,
      }))
    })
  })

  async function getData() {
    try {
      if (!payload) {
        return await readConfig(options)
          .then((res) => {
            const _payload = payload = res.payload
            _payload.meta.wsPort = port
            watcher.add(res.dependencies)
            return payload
          })
      }
      return payload
    }
    catch (e) {
      console.error(readErrorWarning)
      if (e instanceof ConfigInspectorError) {
        e.prettyPrint()
      }
      else {
        console.error(e)
      }
      return createErrorPayload(e)
    }
  }

  return {
    port,
    wss,
    watcher,
    getData,
  }
}
