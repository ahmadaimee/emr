// @ts-check
import tseslint from 'typescript-eslint';

/**
 * The rules here are security controls, not style preferences.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/migrations/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message: 'sql.raw builds SQL from strings. Use the sql`` template with bound parameters.',
        },
        {
          selector: "CallExpression[callee.name='eval']",
          message: 'eval is never acceptable in this codebase.',
        },
      ],
    },
  },
  {
    // Only the db package may talk to drizzle or read the connection string.
    files: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts'],
    ignores: ['packages/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'drizzle-orm', message: 'Import query helpers from @grove/db, not drizzle-orm.' },
            { name: 'drizzle-orm/pg-core', message: 'Schema lives in @grove/db.' },
            { name: 'postgres', message: 'Database access goes through @grove/db withTenant.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration through the config module, never process.env directly.' },
      ],
    },
  },
  {
    // Redis-class caches must never see PHI; enforce by keeping the package out entirely.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-modules': ['error', 'ioredis', 'redis', 'bullmq'],
    },
  },
);
