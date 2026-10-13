/**
 * Checks a deployed Worker from the outside, without spending anything: it never reaches the
 * model and never solves a Turnstile challenge.
 *
 *   node worker/scripts/smoke.mjs <worker url> <site origin>
 *
 * Run by CI straight after a deploy. A failure stops the site from being published against a
 * Worker that is down or misconfigured.
 */
const [workerUrl, siteOrigin] = process.argv.slice(2);
if (!workerUrl || !siteOrigin) {
  console.error('Usage: node smoke.mjs <worker url> <site origin>');
  process.exit(2);
}

const base = workerUrl.replace(/\/+$/, '');
const ATTEMPTS = 6;
const RETRY_DELAY_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

const checks = [
  {
    name: 'health answers and the chat is enabled',
    async run() {
      const response = await fetch(`${base}/v1/health`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.json();
      if (response.status !== 200 || body.status !== 'ok') return `status ${response.status}`;
      if (body.enabled !== true) return 'MUNSHI_ENABLED is false';
      return null;
    },
  },
  {
    name: 'the site origin passes the CORS preflight',
    async run() {
      const response = await fetch(`${base}/v1/chat`, {
        method: 'OPTIONS',
        headers: { origin: siteOrigin, 'access-control-request-method': 'POST' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const allowed = response.headers.get('access-control-allow-origin');
      return response.status === 204 && allowed === siteOrigin
        ? null
        : `status ${response.status}, allow-origin ${allowed}`;
    },
  },
  {
    name: 'another origin is refused',
    async run() {
      const response = await fetch(`${base}/v1/session`, {
        method: 'POST',
        headers: {
          origin: 'https://not-the-portfolio.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ turnstileToken: 'smoke' }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return response.status === 403 ? null : `status ${response.status}`;
    },
  },
  {
    name: 'chat without a session is refused, so secrets and limiters are in place',
    async run() {
      const response = await fetch(`${base}/v1/chat`, {
        method: 'POST',
        headers: { origin: siteOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'smoke' }] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // 503 here would mean a missing secret or binding: the config is loaded before the session check.
      return response.status === 401 ? null : `status ${response.status}`;
    },
  },
];

async function attempt() {
  const failures = [];
  for (const check of checks) {
    let problem;
    try {
      problem = await check.run();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (problem) failures.push(`${check.name}: ${problem}`);
  }
  return failures;
}

// A new version takes a few seconds to reach every location.
let failures = [];
for (let i = 1; i <= ATTEMPTS; i++) {
  failures = await attempt();
  if (failures.length === 0) break;
  if (i < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}

if (failures.length > 0) {
  console.error(
    `Smoke test failed for ${base}:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`Smoke test passed for ${base}: ${checks.length} checks.`);
