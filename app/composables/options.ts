/**
 * Indicates if any user-supplied option values match the default value for that
 * option
 */
let hasRedundantOptions: boolean

/**
 * Wraps an option value in a 3-part array, while still preserving the original
 * data type and value.
 *
 * The '--' markers provide something that a regex replace can easily later
 * match on. (See transformDiff() in ./strings.ts)
 */
function redundantOption(option: unknown): unknown[] {
  hasRedundantOptions = true
  return [
    '--',
    option,
    '--',
  ]
}

function deepCompareOption(option: unknown, defaultOption: unknown): unknown {
  if (defaultOption === undefined)
    return option
  if (typeof option !== typeof defaultOption)
    return option

  if (option === defaultOption)
    return redundantOption(option)

  if (
    typeof option === 'object'
    && option !== null
    && defaultOption !== null
  ) {
    if (
      Array.isArray(option)
      && Array.isArray(defaultOption)
      && option.length === defaultOption.length
    ) {
      if (option.length === 0)
        return redundantOption(option)
      return (option as unknown[]).map((value: unknown, index: number) =>
        deepCompareOption(value, (defaultOption as unknown[])[index]),
      )
    }
    else if (!Array.isArray(option) && !Array.isArray(defaultOption)) {
      const optionRecord = option as Record<string, unknown>
      const defaultRecord = defaultOption as Record<string, unknown>
      const optionKeys = Object.keys(optionRecord)

      return optionKeys.reduce(
        (comparedKeys: Record<string, unknown>, key) => {
          comparedKeys[key] = deepCompareOption(
            optionRecord[key],
            defaultRecord[key],
          )
          return comparedKeys
        },
        {},
      )
    }
  }

  return option
}

export function deepCompareOptions(
  options: unknown[],
  defaultOptions: unknown[],
): { options: unknown[], hasRedundantOptions: boolean } {
  hasRedundantOptions = false
  const comparedOptions = options.map((value, index) =>
    deepCompareOption(
      value,
      index < defaultOptions.length ? defaultOptions[index] : undefined,
    ),
  )

  return {
    options: comparedOptions,
    hasRedundantOptions,
  }
}
