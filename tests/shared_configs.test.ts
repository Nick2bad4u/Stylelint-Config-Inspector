import { describe, expect, it } from 'vitest'
import {
  buildConfigArray,
  getMatchedGlobs,
  isGeneralConfig,
  isIgnoreOnlyConfig,
  matchFile,
} from '../shared/configs'

describe('config shape helpers', () => {
  it('treats ignore-only config with metadata as ignore-only and general', () => {
    const config = {
      index: 0,
      name: 'stylelint/root',
      ignores: ['dist/**'],
    }

    expect(isIgnoreOnlyConfig(config)).toBe(true)
    expect(isGeneralConfig(config)).toBe(true)
  })

  it('treats configs with files constraints as non-general', () => {
    const config = {
      index: 1,
      files: ['**/*.css'],
      rules: {
        'color-no-invalid-hex': true,
      },
    }

    expect(isIgnoreOnlyConfig(config)).toBe(false)
    expect(isGeneralConfig(config)).toBe(false)
  })

  it('matches both positive and negated globs in declaration order', () => {
    expect(
      getMatchedGlobs('src/styles/app.css', ['**/*.css', '!src/**']),
    ).toEqual(['**/*.css', '!src/**'])
  })
})

describe('matchFile', () => {
  describe('global ignored', () => {
    const testGlobalIgnores = (ignores: string[]) => {
      const configs = [
        { index: 0, files: ['tests/folder/foo.test.ts'] },
        { index: 1, ignores },
      ]
      return matchFile('tests/folder/foo.test.ts', configs, process.cwd())
    }
    it('should match no configs', () => {
      const result = testGlobalIgnores(['tests/**'])
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: ['tests/**'],
        configs: [],
      })
    })

    it('should match when final matched glob is not an unignore', () => {
      const result = testGlobalIgnores([
        'tests/**',
        '!tests/folder/**',
        'tests/**/*.test.ts',
      ])
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: [
          'tests/**',
          '!tests/folder/**',
          'tests/**/*.test.ts',
        ],
        configs: [],
      })
    })

    it('should match when irrelevant unignores included', () => {
      const result = testGlobalIgnores([
        'tests/**',
        '!tests/other/**',
        '!tests/*.test.ts',
      ])
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: ['tests/**'],
        configs: [],
      })
    })

    it('should match when file is unignored but directory is ignored', () => {
      const result = testGlobalIgnores([
        'tests/**',
        '!tests/**/*.test.ts',
        'tests/other/**',
      ])
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: ['tests/**', '!tests/**/*.test.ts'],
        configs: [],
      })
    })

    it('should not match when file is unignored and directory is ignored but sub directory is unignored', () => {
      const result = testGlobalIgnores([
        'tests/**/*',
        '!tests/**/*/',
        '!tests/**/*.test.ts',
        'tests/other/**',
      ])
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: [
          'tests/folder/foo.test.ts',
          'tests/**/*',
          '!tests/**/*.test.ts',
        ],
        configs: [0],
      })
    })
  })

  describe('config matching', () => {
    it('matches general configs without explicit files globs', () => {
      const result = matchFile(
        'src/styles/app.css',
        [
          {
            index: 0,
            rules: {
              'color-no-invalid-hex': true,
            },
          },
        ],
        process.cwd(),
      )

      expect(result).toEqual({
        filepath: 'src/styles/app.css',
        globs: [],
        configs: [0],
      })
    })

    it('should match a basic config', () => {
      const result = matchFile(
        'tests/folder/foo.test.ts',
        [{ index: 0, files: ['**'], ignores: [] }],
        process.cwd(),
      )
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: ['**'],
        configs: [0],
      })
    })

    it('should be ignored when final matched glob is not an unignore', () => {
      const result = matchFile(
        'tests/folder/foo.test.ts',
        [
          {
            index: 0,
            files: ['**'],
            ignores: [
              'tests/**',
              '!tests/folder/**',
              'tests/**/*.test.ts',
            ],
          },
        ],
        process.cwd(),
      )
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: [
          'tests/**',
          '!tests/folder/**',
          'tests/**/*.test.ts',
        ],
        configs: [],
      })
    })

    it('should match when last matching glob is an unignore', () => {
      const result = matchFile(
        'tests/folder/foo.test.ts',
        [
          {
            index: 0,
            files: ['**'],
            ignores: [
              'tests/**',
              '!tests/folder/**',
              'tests/other/**',
            ],
          },
        ],
        process.cwd(),
      )
      expect(result).toEqual({
        filepath: 'tests/folder/foo.test.ts',
        globs: [
          '**',
          'tests/**',
          '!tests/folder/**',
        ],
        configs: [0],
      })
    })

    it('should match multiple configs / a complex case', () => {
      const result = matchFile(
        'tests/folder/foo.test.ts',
        [
          { index: 0, files: ['**'], ignores: [] },
          {
            index: 1,
            files: ['**/*.miss.ts'],
            ignores: ['tests/**'],
          },
          { index: 2, files: ['**/*.miss.ts'], ignores: [] },
          {
            index: 3,
            files: ['**'],
            ignores: ['tests/**', '!**/*.ts'],
          },
          { index: 4, files: ['**'], ignores: ['tests/**.miss'] },
          {
            index: 5,
            files: ['**'],
            ignores: [
              'tests/**',
              '!tests/folder/*.foo',
              '!tests/folder/*.bar',
            ],
          },
          {
            index: 6,
            files: ['**'],
            ignores: [
              'tests/**',
              '!tests/*.test.ts',
              'tests/folder/*',
            ],
          },
          {
            index: 7,
            files: ['**'],
            ignores: [
              'tests/**',
              '!tests/*.test.ts',
              'tests/folder/*',
              '!tests/folder/*.ts',
              'tests/other/**',
            ],
          },
        ],
        process.cwd(),
      )
      expect(result.configs).toEqual([
        0,
        3,
        4,
        7,
      ])
    })
  })
})

describe('buildConfigArray', () => {
  it('accumulates matched config indexes into an ordered index array', () => {
    const configArray = buildConfigArray(
      [
        {
          index: 0,
          files: ['**/*.css'],
          rules: {
            'stylelint/color-hex-length': 'short',
          },
        },
        {
          index: 1,
          files: ['src/**/*.css'],
          rules: {
            'stylelint/alpha-value-notation': 'percentage',
          },
        },
      ],
      process.cwd(),
    )

    const merged = configArray.getConfig('src/app.css')
    const mergedIndexes = (merged?.index ?? []).filter(
      (index): index is number => typeof index === 'number',
    )

    expect(mergedIndexes).toEqual([0, 1])
  })

  it('returns undefined when no config entry matches a file path', () => {
    const configArray = buildConfigArray(
      [
        {
          index: 0,
          files: ['src/**/*.css'],
          rules: {
            'stylelint/color-hex-length': 'short',
          },
        },
        {
          index: 1,
          files: ['src/**/*.scss'],
          rules: {
            'stylelint/alpha-value-notation': 'percentage',
          },
        },
      ],
      process.cwd(),
    )

    const outsideSrc = configArray.getConfig('test/fixture.css')

    expect(outsideSrc).toBeUndefined()
  })
})
