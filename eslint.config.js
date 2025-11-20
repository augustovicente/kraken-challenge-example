const eslintPluginPrettier = require('eslint-plugin-prettier/recommended');
const importPlugin = require('eslint-plugin-import');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.js',
      '!eslint.config.js',
      'test/fixtures/**',
    ],
  },
  // Lint src files with type checking.
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended, eslintPluginPrettier],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'prettier/prettier': 'error',
      // Import ordering rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'capitalized-comments': [
        'error',
        'always',
        {
          ignoreConsecutiveComments: true,
        },
      ],
      'spaced-comment': [
        'error',
        'always',
        {
          markers: ['/'],
          exceptions: ['-', '+'],
        },
      ],
      'line-comment-position': ['error', { position: 'above' }],
      'multiline-comment-style': ['error', 'separate-lines'],
    },
  },
);
