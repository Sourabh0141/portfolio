import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import { resolveMunshiConfig, SITE_URL } from './src/site.config';

// Munshi, the chat assistant, is optional at build time. Its two public settings come from the
// environment (CI); without them the page is built with no chat at all.
const munshi = resolveMunshiConfig(
  loadEnv(process.env['NODE_ENV'] ?? 'production', process.cwd(), 'PUBLIC_'),
);

/** Cloudflare Turnstile: its script, and the iframe that script creates. */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Astro Project Configuration
 * Configures static site generation, Cloudflare Pages compatibility,
 * self-hosted typography, and enterprise-grade Content Security Policy (CSP).
 */
export default defineConfig({
  // Canonical root URL used for absolute links, sitemaps, and Open Graph metadata.
  site: SITE_URL,

  // Build as a fully static site (pre-rendered HTML/CSS/JS) for Cloudflare Pages CDN.
  output: 'static',

  // Normalize URLs without a trailing slash to match Cloudflare Pages routing and prevent duplicate SEO indexation.
  trailingSlash: 'never',

  // Disable Markdown syntax highlighting: content is stored in YAML, and Shiki inline styles conflict with strict CSP.
  markdown: { syntaxHighlight: false },

  // Automatically generate sitemap-index.xml during the build for search engine crawlers.
  integrations: [sitemap()],

  // Disable the floating developer toolbar in development mode for an unobstructed view.
  devToolbar: { enabled: false },

  // Self-hosted variable fonts via Fontsource to eliminate external network requests and prevent layout shifts.
  fonts: [
    {
      name: 'Space Grotesk',
      cssVariable: '--font-display',
      provider: fontProviders.fontsource(),
      weights: ['500 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      name: 'Inter',
      cssVariable: '--font-body',
      provider: fontProviders.fontsource(),
      weights: ['400 600'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      provider: fontProviders.fontsource(),
      weights: ['400 500'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],

  // Content Security Policy (CSP): restricts resource loading to protect against XSS and code injection.
  security: {
    csp: {
      // Automatically calculate cryptographic SHA-256 hashes for authorized inline scripts (e.g. anti-FOUC theme script).
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        // The chat talks to exactly one other origin: the Munshi Worker.
        munshi ? (`connect-src 'self' ${munshi.apiUrl}` as const) : "connect-src 'self'",
        // Turnstile runs its check in an iframe. Without the chat, no frame is allowed at all.
        ...(munshi ? ([`frame-src ${TURNSTILE_ORIGIN}`] as const) : []),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      // Astro adds a hash for each of the page's own scripts. Turnstile's script is the one
      // external script, loaded only when a visitor sends their first message.
      ...(munshi ? { scriptDirective: { resources: ["'self'", TURNSTILE_ORIGIN] } } : {}),
    },
  },
});
