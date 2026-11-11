import { createServer, preview, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
const production = process.argv.includes('--production');
const values = loadEnv(production ? 'production' : 'development', process.cwd(), '');
for (const key of ['DATABASE_URL','ESCROWPAL_DATA_DIR','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','VITE_PAYPAL_CLIENT_ID','LLM_PROVIDER','LLM_API_KEY','LLM_BASE_URL','LLM_MODEL','LAYA_BASE_URL','LAYA_API_KEY'])
  if (process.env[key] === undefined && values[key]) process.env[key] = values[key];
const { default: handler } = await import('../api/rpc.js');
const api = async (req: IncomingMessage & { body?: unknown; query?: unknown }, res: ServerResponse) => {
  const wrapped = Object.assign(res, {
    status(n: number) { res.statusCode = n; return wrapped; },
    json(value: unknown) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); return wrapped; },
    send(value: unknown) { res.end(value as any); return wrapped; },
  });
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      let size = 0; const parts: Buffer[] = [];
      for await (const data of req) { size += data.length; if (size > 3_600_000) return wrapped.status(413).json({ error: 'Request exceeds the upload limit.' }); parts.push(data); }
      try { req.body = JSON.parse(Buffer.concat(parts).toString() || '{}'); }
      catch { return wrapped.status(400).json({ error: 'Send valid JSON.' }); }
    }
    await handler(req, wrapped);
  } catch { wrapped.status(500).json({ error: 'Local API failed. Check the terminal log.' }); }
};
const address = { host: '127.0.0.1', port: Number(process.env.PORT || 4173), strictPort: true };
const plugin: Plugin = {
  name: 'escrowpal-local-api',
  configureServer(vite) { vite.middlewares.use('/api/rpc', api as any); },
  configurePreviewServer(vite) { vite.middlewares.use('/api/rpc', api as any); },
};
const server = production
  ? await preview({ preview: address, plugins: [plugin] })
  : await createServer({ server: address, plugins: [plugin] });
if (!production) await (server as Awaited<ReturnType<typeof createServer>>).listen();
server.printUrls();
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  if (closing) return; closing = true;
  await server.close();
  const { db } = await import('../api/_lib/db.js');
  await (db as unknown as { $client?: { close?: () => Promise<void> } }).$client?.close?.();
  process.exit(0);
});
