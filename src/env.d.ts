/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Origin of the Munshi Worker. Public: it is visible in the page's network requests. */
  readonly PUBLIC_MUNSHI_API_URL?: string;
  /** Turnstile site key for the chat. Public by design. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
