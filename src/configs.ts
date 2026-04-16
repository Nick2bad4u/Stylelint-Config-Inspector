import type {
  InspectorReadResult,
  ReadConfigOptions,
  ResolveConfigPathOptions,
  ResolvedConfigPath,
} from './inspectors/contracts'
import { createStylelintInspectorAdapter } from './inspectors/stylelint'

const adapter = createStylelintInspectorAdapter()

export type { ReadConfigOptions, ResolveConfigPathOptions }

/**
 * Alias for inspector config read results.
 */
export type InspectorConfig = InspectorReadResult

/**
 * Search and resolve the Stylelint config location metadata.
 */
export function resolveConfigPath(
  options: ResolveConfigPathOptions,
): Promise<ResolvedConfigPath> {
  return adapter.resolveConfigPath(options)
}

/**
 * Read and normalize the Stylelint config into inspector payload.
 */
export function readConfig(
  options: ReadConfigOptions,
): Promise<InspectorReadResult> {
  return adapter.readConfig(options)
}
