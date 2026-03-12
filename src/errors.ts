import c from 'ansis'
import { MARK_ERROR } from './constants'

export class ConfigInspectorError extends Error {
  prettyPrint() {
    console.error(MARK_ERROR, this.message)
  }
}

export class ConfigPathError extends ConfigInspectorError {
  override name = 'ConfigPathError' as const

  constructor(
    public basePath: string,
    public configFilenames: string[],
  ) {
    super('Cannot find Stylelint config file')
  }

  override prettyPrint() {
    console.error(MARK_ERROR, this.message, c.dim(`

Looked in ${c.underline(this.basePath)} and parent folders for:

 * ${this.configFilenames.join('\n * ')}`,
    ))
  }
}

export class ConfigPathLegacyError extends ConfigInspectorError {
  override name = 'ConfigPathLegacyError' as const

  constructor(
    public basePath: string,
    public configFilename: string,
  ) {
    super('Found legacy Stylelint config file')
  }

  override prettyPrint() {
    console.error(MARK_ERROR, this.message, c.dim(`

Encountered legacy Stylelint config ${c.underline(this.configFilename)} in ${c.underline(this.basePath)}

Prefer modern Stylelint config filenames:
https://stylelint.io/user-guide/configure`,
    ))
  }
}
