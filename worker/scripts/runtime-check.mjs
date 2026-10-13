/**
 * Runs the Worker in the real Workers runtime (workerd, through `wrangler dev`) against the
 * local stub upstream and checks the things the Node unit tests cannot: that the bundle loads,
 * that the bindings in wrangler.jsonc exist, that a streamed answer passes through intact,
 * and that the Rate Limiting binding really refuses the sixth session in a minute.
 *
 *   npm run test:runtime -w worker
 *
 * Everything stays on 127.0.0.1. No Cloudflare account, key or network is needed.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER_PORT = 8799;
const STUB_PORT = 8788;
const BASE = `http://127.0.0.1:${WORKER_PORT}`;
const ORIGIN = 'http://localhost:4321';
const START_TIMEOUT_MS = 90_000;

const children = [];
// Rate limit counters are kept on disk between runs. A fresh directory means a second run
// within the same minute does not start already over the limit.
const stateDir = mkdtempSync(join(tmpdir(), 'munshi-runtime-'));

function start(command, args, env = {}) {
  const windows = process.platform === 'win32';
  const child = spawn(command, args, {
    cwd: workerDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    // npx is a .cmd shim on Windows and cannot be spawned without a shell.
    shell: windows,
    // Elsewhere, a process group of its own, so the whole tree can be signalled at once.
    detached: !windows,
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  children.push(child);
  return { child, output: () => output };
}

/**
 * wrangler dev is a chain of processes ending in workerd. Killing only the first leaves the
 * rest holding the port, and the next run would silently talk to the old Worker. So the whole
 * tree is stopped, and on Windows this waits until it has gone.
 */
function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
  }
}

/** A port left open by an earlier run would answer in place of the Worker under test. */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop whatever is listening on it and run again.`,
        ),
      ),
    );
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
  });
}

async function waitFor(url, label, logs) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${label} did not start in time.\n${logs()}`);
}

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

function post(path, body, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function run() {
  await assertPortFree(STUB_PORT);
  await assertPortFree(WORKER_PORT);

  const stub = start('node', ['scripts/stub-upstream.mjs'], { STUB_PORT: String(STUB_PORT) });
  const worker = start(
    'npx',
    [
      'wrangler',
      'dev',
      '--env',
      'local',
      '--port',
      String(WORKER_PORT),
      '--ip',
      '127.0.0.1',
      '--persist-to',
      stateDir,
    ],
    { WRANGLER_SEND_METRICS: 'false', CI: 'true' },
  );

  await waitFor(`http://127.0.0.1:${STUB_PORT}/`, 'Stub upstream', stub.output);
  await waitFor(`${BASE}/v1/health`, 'wrangler dev', worker.output);

  const health = await (await fetch(`${BASE}/v1/health`)).json();
  check(
    'health reports ok and a knowledge version',
    health.status === 'ok' && /^[0-9a-f]{12}$/.test(health.knowledge),
    JSON.stringify(health),
  );

  const preflight = await fetch(`${BASE}/v1/chat`, {
    method: 'OPTIONS',
    headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
  });
  check(
    'preflight allows the configured origin',
    preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === ORIGIN,
  );

  const foreign = await post(
    '/v1/session',
    { turnstileToken: 'x' },
    { origin: 'https://evil.test' },
  );
  check('another origin is refused', foreign.status === 403);

  const failed = await post('/v1/session', { turnstileToken: 'fail' });
  check('a failed challenge is refused', failed.status === 403);

  const sessionResponse = await post('/v1/session', { turnstileToken: 'solved' });
  const session = await sessionResponse.json();
  check(
    'a solved challenge returns a session token',
    sessionResponse.status === 200 && typeof session.token === 'string',
  );

  const unauthenticated = await post('/v1/chat', { messages: [{ role: 'user', content: 'Hi' }] });
  check('chat without a session is refused', unauthenticated.status === 401);

  const chat = await post(
    '/v1/chat',
    { messages: [{ role: 'user', content: 'Where is Sourabh based?' }] },
    { authorization: `Bearer ${session.token}` },
  );
  const text = await chat.text();
  const answer = text
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)).choices[0]?.delta?.content ?? '')
    .join('');
  check(
    'chat streams server-sent events',
    chat.status === 200 && (chat.headers.get('content-type') ?? '').startsWith('text/event-stream'),
  );
  check('the stream ends with [DONE]', text.trimEnd().endsWith('data: [DONE]'));
  check(
    'the answer echoes the question through the stub',
    answer.includes('Where is Sourabh based?'),
    answer,
  );
  check(
    'the Worker put its system prompt first',
    /2 messages, the first being a \d{5}-character system prompt/.test(answer),
    answer,
  );

  // Two sessions were requested above (one failed its challenge). The limit is 5 a minute.
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const response = await post('/v1/session', { turnstileToken: 'solved' });
    await response.arrayBuffer();
    statuses.push(response.status);
  }
  check(
    'the Rate Limiting binding refuses sessions past the limit',
    statuses.includes(200) && statuses.at(-1) === 429,
    statuses.join(', '),
  );

  // Log lines reach this process a moment after the response does.
  const logDeadline = Date.now() + 15_000;
  while (!worker.output().includes('"question":') && Date.now() < logDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const log = worker.output();
  check(
    'the request log has the question and outcome',
    log.includes('"event":"request"') && log.includes('"question":"Where is Sourabh based?"'),
  );
  check(
    'the request log has no client address',
    !log.includes('"ip"') && !/cf-connecting-ip/i.test(log),
  );

  // The script CI runs after a deploy, pointed at this local Worker, so it is tested too.
  const smoke = start('node', ['scripts/smoke.mjs', BASE, ORIGIN]);
  const smokeExit = await new Promise((resolve) => smoke.child.on('exit', resolve));
  check('the post-deploy smoke test passes against this Worker', smokeExit === 0, smoke.output());

  if (failures > 0) console.log(`\n--- wrangler dev output ---\n${log}`);
}

try {
  console.log('Runtime check (wrangler dev + stub upstream)');
  await run();
} catch (error) {
  failures++;
  console.error(error);
} finally {
  stopAll();
  rmSync(stateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

console.log(
  failures === 0 ? '\nRuntime check passed.' : `\nRuntime check failed: ${failures} problem(s).`,
);
process.exit(failures === 0 ? 0 : 1);
