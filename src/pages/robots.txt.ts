import type { APIRoute } from 'astro';

// Served at /robots.txt. `site` is the origin from astro.config.ts, so the
// Sitemap line is an absolute URL a crawler can fetch.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
