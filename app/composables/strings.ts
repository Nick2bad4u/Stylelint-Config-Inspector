const MUTED_ARRAY_MARKER_RE = /\[\s*'--',\s*(\S.+),\s*'--'\s*\],?/g
const JSON_KEY_RE = /"(\w+)":/g
const DOUBLE_QUOTE_RE = /"/g

export function nth(n: number) {
  const nString = `${n}`
  if (nString.endsWith('1') && n !== 11)
    return `${nString}st`
  if (nString.endsWith('2') && n !== 12)
    return `${nString}nd`
  if (nString.endsWith('3') && n !== 13)
    return `${nString}rd`
  return `${n}th`
}

export function stringifyOptions(object: any) {
  /**
   * Replaces all occurrences of the pattern:
   * `['--', value, '--']`
   *
   * with:
   * `value, // [!code muted]
   *
   * Lines with the [!code muted] comment will be processed by Shiki's diff
   * notation transformer and have the `.line.muted` classes applied
   */
  return stringifyUnquoted(object)
    .replace(MUTED_ARRAY_MARKER_RE, '$1, // [!code muted]')
}

export function stringifyUnquoted(obj: any) {
  return JSON.stringify(obj, null, 2)
    .replace(JSON_KEY_RE, '$1:')
    .replace(DOUBLE_QUOTE_RE, '\'')
}
