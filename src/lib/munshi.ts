import { resolveMunshiConfig } from '../site.config';

/**
 * Chat settings for this build, or null when the build has none. Read by name, not by passing
 * `import.meta.env` whole: Vite replaces each named variable with its value at build time.
 */
export const munshiConfig = resolveMunshiConfig({
  PUBLIC_MUNSHI_API_URL: import.meta.env.PUBLIC_MUNSHI_API_URL,
  PUBLIC_TURNSTILE_SITE_KEY: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
});
