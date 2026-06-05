// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // The TypeScript import resolver currently crashes on Windows when npm
      // skips or misloads the unrs native optional binding. TypeScript still
      // validates module namespaces via `npm run typecheck`.
      'import/namespace': 'off',
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',
    },
  },
]);
