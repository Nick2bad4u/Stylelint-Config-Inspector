import type { RuleEntry } from './types'

export function getRuleLevel(level: RuleEntry | undefined) {
  const first = Array.isArray(level) ? level[0] : level

  if (first === undefined)
    return 'off'

  // Stylelint: `null` disables a rule
  if (first === null)
    return 'off'

  if (Array.isArray(level)) {
    const second = level[1]
    if (
      second
      && typeof second === 'object'
      && !Array.isArray(second)
      && 'severity' in second
      && second.severity === 'warning'
    ) {
      return 'warn'
    }
  }

  switch (first) {
    case 0:
    case 'off':
    case false:
      return 'off'
    case 1:
    case 'warn':
    case 'warning':
      return 'warn'
    case 2:
    case 'error':
      return 'error'
    default:
      // Stylelint and similar config systems treat non-null primary values as enabled.
      return 'error'
  }
}

export function getRuleOptions(level: RuleEntry | undefined): unknown[] | undefined {
  if (Array.isArray(level))
    return level.slice(1)
}
