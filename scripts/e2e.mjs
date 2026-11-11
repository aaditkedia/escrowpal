import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

await mkdir('test-results', { recursive: true });
const directory = await mkdtemp(join(tmpdir(), 'escrowpal-e2e-'));
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const baseURL = 'http://127.0.0.1:' + port;
const env = { ...process.env, PORT: String(port), ESCROWPAL_BASE_URL: baseURL, ESCROWPAL_DATA_DIR: join(directory, 'db'), ESCROWPAL_E2E_STATE: join(directory, 'agreement.json'), ESCROWPAL_MARKET_STATE: join(directory, 'market.json') };
// Explicit blanks take priority over .env files. Tests cannot use real models or payment credentials.
for (const key of ['DATABASE_URL', 'VERCEL', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'VITE_PAYPAL_CLIENT_ID', 'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'LAYA_BASE_URL', 'LAYA_API_KEY']) env[key] = '';
let server;
const serverLog = createWriteStream('test-results/e2e-server.log');
const report = { startedAt: new Date().toISOString(), baseURL, clientBuild: 'production', database: 'isolated persistent PGlite', modelLoaded: false, paypalNetworkTested: false, checks: [] };
async function rpc(action, body = {}) {
  const response = await fetch(baseURL + '/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }), signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, 'RPC ' + action); return response.json();
}
async function start() {
  server = spawn(process.execPath, ['--import', 'tsx', 'scripts/dev-server.ts', '--production'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(serverLog, { end: false }); server.stderr.pipe(serverLog, { end: false });
  let last;
  for (let n = 0; n < 300; n++) {
    if (server.exitCode !== null) throw new Error('Test server exited: ' + server.exitCode);
    try { const config = await rpc('config'); assert.equal(config.laya, false); assert.equal(config.llm, false); assert.equal(config.paypalServer, false); return; }
    catch (error) { last = error; await delay(100); }
  }
  throw last;
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10000); timeout.unref();
  await exited; clearTimeout(timeout);
}
async function run(file) {
  const log = createWriteStream('test-results/' + file.replace('.mjs', '') + '.log');
  const child = spawn(process.execPath, ['scripts/' + file], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { process.stdout.write(data); log.write(data); });
  child.stderr.on('data', data => { process.stderr.write(data); log.write(data); });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  log.end(); assert.equal(code, 0, file + ' failed'); report.checks.push(file + ' passed');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await stop(); await rm(directory, { recursive: true, force: true }); process.exit(1); });
try {
  await start();
  await run('browser-check.mjs');
  await run('market-check.mjs');
  await run('interface-audit.mjs');
  const ui = JSON.parse(await readFile('test-results/interface-audit.json', 'utf8'));
  assert.deepEqual(ui.errors, []);
  assert.ok(ui.pages.every(page => !page.overflow && page.violations.length === 0), 'Interface audit found a regression');
  const agreement = JSON.parse(await readFile(env.ESCROWPAL_E2E_STATE, 'utf8'));
  const market = JSON.parse(await readFile(env.ESCROWPAL_MARKET_STATE, 'utf8'));
  await stop(); await start();
  assert.equal((await rpc('get', agreement)).deal.title, agreement.title);
  const restored = await rpc('get', market.deal);
  assert.equal(restored.deal.status, 'completed');
  assert.equal(restored.deal.market.sha256, market.sha256);
  assert.equal((await rpc('marketGet', market.analysis)).sha256, market.sha256);
  report.checks.push('Agreement, completed market ledger, and sealed analysis survive process restart');
  report.passed = true;
} catch (error) { report.passed = false; report.failure = String(error); process.exitCode = 1; }
finally {
  await stop(); serverLog.end(); await rm(directory, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  await writeFile('test-results/e2e-summary.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
