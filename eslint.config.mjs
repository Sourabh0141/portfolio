import { defineConfig, globalIgnores } from 'eslint/config';
import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

/**
 * ESLint Flat Configuration
 * Defines code quality, type-checking, and strict accessibility rules across the portfolio.
 */
export default defineConfig([
  // Ignore build outputs, auto-generated caches, packages, and static assets.
  globalIgnores(['dist/', '.astro/', 'node_modules/', 'public/']),

  // Core TypeScript recommended rules for type safety and best practices.
  tseslint.configs.recommended,

  // Astro-specific rules for component frontmatter and template syntax.
  eslintPluginAstro.configs.recommended,

  // Strict WCAG web accessibility (a11y) rules for screen readers and ARIA compliance.
  eslintPluginAstro.configs['jsx-a11y-strict'],

  {
    rules: {
      // Force 'import type' for type-only imports to ensure zero bundle overhead and prevent circular dependencies.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);
