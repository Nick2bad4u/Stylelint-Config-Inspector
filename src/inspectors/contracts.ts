import type { FlatConfigItem, Payload } from '../../shared/types'

export interface ResolveConfigPathOptions {
  /**
   * Current working directory
   */
  cwd: string
  /**
   * Override config file path.
   */
  userConfigPath?: string
  /**
   * Override base path. When not provided, will use directory of discovered config file.
   */
  userBasePath?: string
}

export interface ReadConfigOptions extends ResolveConfigPathOptions {
  /**
   * Glob file paths matched by the configs.
   */
  globMatchedFiles?: boolean
  /**
   * Change current working directory to basePath
   * @default true
   */
  chdir?: boolean
  /**
   * Target file path used to resolve the effective config.
   *
   * @default "stylelint-inspector-target.css"
   */
  targetFilePath?: string
  /**
   * Optional custom syntax passed to stylelint.resolveConfig.
   */
  customSyntax?: string
}

export interface ResolvedConfigPath {
  basePath: string
  configPath?: string
}

export interface InspectorReadResult {
  configs: FlatConfigItem[]
  payload: Payload
  dependencies: string[]
}

export interface InspectorAdapter {
  readonly engine: 'stylelint'
  resolveConfigPath: (options: ResolveConfigPathOptions) => Promise<ResolvedConfigPath>
  readConfig: (options: ReadConfigOptions) => Promise<InspectorReadResult>
}
