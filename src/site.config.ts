/**
 * Public origin of the deployed site. Astro uses it for canonical URLs,
 * Open Graph tags, the sitemap, and robots.txt.
 *
 * The hostname comes from the Cloudflare Pages project. Change this together
 * with `PAGES_PROJECT` in `.github/workflows/ci-cd.yml`.
 */
export const SITE_URL = 'https://sourabh.pages.dev';

export interface MunshiConfig {
  /** Origin of the Munshi Worker, without a trailing slash. */
  apiUrl: string;
  /** Public Turnstile key for the widget Terraform creates. */
  siteKey: string;
}

/**
 * Where the chat assistant lives. Both values are public and come from Terraform outputs,
 * which CI passes to the build as PUBLIC_MUNSHI_API_URL and PUBLIC_TURNSTILE_SITE_KEY
 * (see `.env.example` for local development).
 *
 * Returns null when either is missing or malformed. The page then renders without the chat
 * and without loosening its Content Security Policy, so a build can never ship a launcher
 * that has nothing to talk to.
 */
export function resolveMunshiConfig(env: Record<string, string | undefined>): MunshiConfig | null {
  const rawUrl = env['PUBLIC_MUNSHI_API_URL']?.trim();
  const siteKey = env['PUBLIC_TURNSTILE_SITE_KEY']?.trim();
  if (!rawUrl || !siteKey) return null;

  let url: URL;
  try {
    // Terraform reports the workers.dev address with or without a scheme.
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) return null;

  return { apiUrl: url.origin, siteKey };
}
