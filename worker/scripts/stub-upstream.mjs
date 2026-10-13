/**
 * Local stand-in for the two services the Worker calls, so `npm run dev` works without a
 * DeepInfra key and without leaving the machine.
 *
 *   node scripts/stub-upstream.mjs        (listens on 127.0.0.1:8788)
 *
 *   POST /v1/openai/chat/completions      streams a canned answer in the provider's format
 *   POST /turnstile/v0/siteverify         accepts any token except "fail"
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 8788);
const CHUNK_DELAY_MS = 25;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function chatCompletions(request, response) {
  const { messages = [] } = JSON.parse(await readBody(request));
  const question = messages.at(-1)?.content ?? '';
  const answer = `This is the local stub, not a real model. You asked: "${question}". The Worker sent ${messages.length} messages, the first being a ${messages[0]?.content.length ?? 0}-character system prompt.`;

  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const word of answer.split(/(?<=\s)/)) {
    const frame = { choices: [{ index: 0, delta: { content: word } }] };
    response.write(`data: ${JSON.stringify(frame)}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
  }
  response.write(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`,
  );
  response.end('data: [DONE]\n\n');
}

async function siteverify(request, response) {
  const form = new URLSearchParams(await readBody(request));
  const success = form.get('response') !== 'fail';
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify(
      success
        ? { success: true, hostname: 'localhost', action: 'munshi' }
        : { success: false, 'error-codes': ['invalid-input-response'] },
    ),
  );
}

const server = createServer((request, response) => {
  const route =
    request.method === 'POST' && request.url === '/v1/openai/chat/completions'
      ? chatCompletions
      : request.method === 'POST' && request.url === '/turnstile/v0/siteverify'
        ? siteverify
        : null;

  if (!route) {
    response.writeHead(404).end();
    return;
  }
  route(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Stub upstream listening on http://127.0.0.1:${PORT}`);
});
