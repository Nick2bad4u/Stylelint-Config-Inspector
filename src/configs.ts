import type {
  InspectorReadResult,
  ReadConfigOptions,
  ResolveConfigPathOptions,
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
export async function resolveConfigPath(options: ResolveConfigPathOptions) {
  return await adapter.resolveConfigPath(options)
}

/**
 * Read and normalize the Stylelint config into inspector payload.
 */
export async function readConfig(
  options: ReadConfigOptions,
): Promise<InspectorReadResult> {
  return await adapter.readConfig(options)
}
