import { defineConfig, globalIgnores } from 'eslint/config';
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'node_modules/**',
    'video/out/**',
    'video/data/**',
    'next-env.d.ts',
  ]),
  coreWebVitals,
  nextTypescript,
  {
    // eslint-plugin-react's automatic React version detection uses an API that
    // was removed in ESLint 10; pinning the version skips that code path.
    settings: { react: { version: '19.2' } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Node-side scripts intentionally log to stdout and read process.env.
    files: ['scripts/**/*.ts', 'video/**/*.ts', 'video/**/*.tsx'],
    rules: {
      'no-console': 'off',
    },
  },
]);
