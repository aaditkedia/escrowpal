import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const baseURL = process.env.ESCROWPAL_BASE_URL || 'http://127.0.0.1:4173';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { checks: [], probes: [], pageErrors: [], console: [], failed: [], badStatus: [], externalRequests: [] };
const redact = value => String(value).replace(/([?&]k=)[^&\s"']+/g, '$1[redacted]');
const contexts = [];
async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  contexts.push(context);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === baseURL || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    report.externalRequests.push(redact(url.href)); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push(redact(error.message)));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.console.push({ type: message.type(), text: redact(message.text()) }); });
  page.on('requestfailed', request => report.failed.push({ url: redact(request.url()), reason: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.badStatus.push({ url: redact(response.url()), status: response.status() }); });
  return page;
}
const page = await session();
let seller;
function mark(text) { report.checks.push(text); console.log('PASS ' + text); }
async function result(current, action, click) {
  const pending = current.waitForResponse(response => {
    try { return response.url().endsWith('/api/rpc') && response.request().postDataJSON().action === action; } catch { return false; }
  });
  await click(); const response = await pending; assert.equal(response.status(), 200, action); return response.json();
}
async function rpc(current, action, body = {}, code = 200) {
  const response = await current.request.post(baseURL + '/api/rpc', { data: { action, ...body } });
  assert.equal(response.status(), code, action + ' access/state check'); return response.json();
}
async function confirm(current, label) {
  await current.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
  await expect(current.getByRole('dialog')).not.toBeVisible();
}
async function probe(current, label) {
  await current.evaluate(() => document.fonts.ready);
  const axe = await new AxeBuilder({ page: current }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await writeFile('test-results/axe-market-' + label + '.json', JSON.stringify(axe, null, 2));
  const overflow = [];
  for (const width of [320, 360, 768, 1280]) {
    await current.setViewportSize({ width, height: 900 });
    const geometry = await current.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
    overflow.push({ width, ...geometry });
    await current.screenshot({ path: 'test-results/market-' + label + '-' + width + '.png', fullPage: true });
    assert.ok(geometry.scrollWidth <= width + 1, label + ' overflow at ' + width);
  }
  report.probes.push({ route: label, theme: 'single light theme', axeViolations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), incomplete: axe.incomplete.map(v => v.id), overflow });
  await writeFile('test-results/viewport-market-' + label + '.json', JSON.stringify(overflow, null, 2));
  assert.equal(axe.violations.length, 0, label + ' accessibility violations');
  mark(label + ': axe scan and 320/360/768/1280px reflow');
}
async function download(current, label, target) {
  const pending = current.waitForEvent('download'); await current.getByRole('button', { name: label, exact: true }).click();
  await (await pending).saveAs('test-results/' + target); return readFile('test-results/' + target);
}
function receipt(bytes) {
  const data = JSON.parse(bytes.toString()); assert.equal(data.sha256, createHash('sha256').update(JSON.stringify(data.payload)).digest('hex')); return data;
}
try {
  await page.goto(baseURL + '/market');
  await expect(page.getByLabel('Brief title')).toBeVisible();
  await probe(page, 'brief');
  const analysis = await result(page, 'marketExample', () => page.getByRole('button', { name: /Open recorded Laya example/ }).click());
  await expect(page.locator('.market-results')).toBeVisible();
  await expect(page.locator('.sample-notice')).toContainText('No live model runs');
  assert.equal(analysis.result.inferenceMode, 'recorded');
  const saved = receipt(await download(page, 'Export analysis receipt', 'market-analysis-receipt.json'));
  assert.equal(saved.sha256, analysis.sha256);
  assert.ok(!JSON.stringify(saved).includes(analysis.token));
  await page.reload(); await expect(page.locator('.market-report-heading')).toContainText(analysis.result.input.title);
  mark('Recorded example persists on reload and exports a verifiable receipt without its private key');
  await probe(page, 'analysis');

  const chosen = analysis.result.input.options.find(option => option.id !== analysis.result.decision.choiceId && option.quotedPrice <= analysis.result.input.budget);
  const create = page.getByRole('button', { name: 'Create pilot agreement', exact: true });
  await expect(create).toBeDisabled();
  await page.getByLabel('Pilot to review').selectOption(chosen.id);
  await expect(page.getByLabel('Reason for your manual selection')).toBeVisible();
  await page.getByLabel('Reason for your manual selection').fill('Test a tracked local channel with a smaller quoted placement cost.');
  const acknowledgement = page.getByRole('checkbox');
  await acknowledgement.check();
  await page.getByLabel('Pilot to review').selectOption(analysis.result.decision.choiceId);
  await expect(acknowledgement).not.toBeChecked();
  await page.getByLabel('Pilot to review').selectOption(chosen.id); await acknowledgement.check();
  const made = await result(page, 'marketCreate', () => create.click());
  await expect(page.getByRole('heading', { name: 'Ready for the other signature.' })).toBeVisible();
  const buyerURL = page.url();
  const sellerURL = await page.getByRole('textbox', { name: 'Private seller invitation link' }).inputValue();
  const keys = { id: made.id, k: made.buyerToken };
  const view = await rpc(page, 'get', keys);
  assert.equal(view.deal.market.sha256, analysis.sha256);
  assert.equal(view.deal.market.selectedCandidate, chosen.label);
  assert.equal(view.milestones.reduce((sum, m) => sum + Math.round(m.amount * 100), 0), Math.round(view.deal.total * 100));
  await rpc(page, 'get', { id: made.id, k: 'invalid-private-key' }, 403);
  await rpc(page, 'fund', { ...keys, mid: view.milestones[0].id, demo: true }, 409);
  await expect(page.getByRole('button', { name: 'Use a demo hold' })).toHaveCount(0);
  mark('Changed selection resets consent; a reviewed override binds the exact-cent pilot to the original digest');
  mark('Invalid role keys and funding before seller acceptance are rejected by the real API');

  seller = await session(); await seller.goto(sellerURL);
  await expect(seller.getByRole('heading', { name: 'A clear plan. Your choice.' })).toBeVisible();
  await seller.getByRole('button', { name: 'Accept the terms', exact: true }).click();
  await confirm(seller, 'Accept terms as seller');
  await page.reload(); await expect(page.getByRole('button', { name: 'Use a demo hold' })).toHaveCount(3);
  const first = page.locator('.milestone-card').nth(0);
  await first.getByRole('button', { name: 'Use a demo hold' }).click(); await page.keyboard.press('Escape');
  await expect(first).toContainText('Awaiting authorization');
  for (let i = 0; i < 3; i++) {
    await page.locator('.milestone-card').nth(i).getByRole('button', { name: 'Use a demo hold' }).click();
    await confirm(page, 'Record demo hold');
    await expect(page.locator('.milestone-card').nth(i)).toContainText('Authorized');
  }
  await rpc(seller, 'approve', { id: made.id, k: made.sellerToken, mid: view.milestones[0].id, pct: 100 }, 403);
  await seller.reload(); await expect(seller.locator('.delivery-form').first()).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const milestone = seller.locator('.milestone-card').nth(i);
    await milestone.getByRole('textbox', { name: 'What did you deliver?' }).fill('Fictional verification evidence: ' + view.milestones[i].criteria.join('; ') + '. Dated records are available for buyer inspection.');
    if (i === 0) await milestone.locator('input[type=file]').setInputFiles({ name: 'pilot-proof.txt', mimeType: 'text/plain', buffer: Buffer.from('Fictional market pilot delivery evidence. No actual vendor campaign.') });
    await result(seller, 'submit', () => milestone.getByRole('button', { name: 'Submit for advisory review' }).click());
    await expect(milestone).toContainText('Ready for review');
  }
  await page.reload(); await expect(first).toContainText('Ready for review');
  const attachmentURL = redact(new URL(await page.getByRole('link', { name: /pilot-proof.txt/ }).getAttribute('href'), baseURL).href);
  const attachment = page.waitForEvent('download'); await page.getByRole('link', { name: /pilot-proof.txt/ }).click();
  await (await attachment).saveAs('test-results/market-pilot-proof.txt');
  assert.match((await readFile('test-results/market-pilot-proof.txt')).toString(), /Fictional market pilot delivery evidence/);
  await first.getByRole('button', { name: 'Approve $300.00', exact: true }).click();
  await confirm(page, 'Confirm demo settlement');
  await expect(first).toContainText('$300.00 simulated capture recorded');
  mark('Separate seller session signs, submits three deliveries and a downloadable attachment; only the buyer settles');

  const second = page.locator('.milestone-card').nth(1);
  await second.getByRole('button', { name: 'Discuss a dispute' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'What is in dispute?' }).fill('Fictional test dispute: the delivery reference needs further verification before final acceptance.');
  await result(page, 'dispute', () => page.getByRole('dialog').getByRole('button', { name: 'Open a dispute', exact: true }).click());
  await seller.reload();
  const sellerSecond = seller.locator('.milestone-card').nth(1);
  await sellerSecond.getByRole('textbox', { name: 'Add your perspective' }).fill('Fictional response: the pilot setup is supplied, but the measurement reference remains incomplete.');
  await result(seller, 'respond', () => sellerSecond.getByRole('button', { name: 'Update proposal' }).click());
  await sellerSecond.getByRole('button', { name: 'Accept this proposal' }).click();
  await seller.getByRole('dialog').getByRole('button', { name: /Accept \d+% proposal/ }).click();
  await expect(seller.getByRole('dialog')).not.toBeVisible(); await expect(sellerSecond).toContainText('In discussion');
  await page.reload(); await expect(second.getByRole('button', { name: 'Accept this proposal' })).toBeVisible();
  await second.getByRole('button', { name: 'Accept this proposal' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Accept \d+% proposal/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(second).toContainText('Settled by mutual acceptance');
  const third = page.locator('.milestone-card').nth(2);
  await third.getByRole('button', { name: 'Release hold', exact: true }).click(); await confirm(page, 'Confirm demo settlement');
  await expect(page.locator('.room-parties')).toContainText('completed');
  mark('A disputed milestone needs both acceptances; an explicit zero-percent settlement closes the remaining hold');
  await probe(page, 'completed-pilot');
  const pdf = await download(page, 'Agreement PDF', 'market-pilot-agreement.pdf'); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const final = receipt(await download(page, 'Evidence receipt', 'market-pilot-evidence.json'));
  assert.equal(final.payload.deal.status, 'completed');
  assert.equal(final.payload.deal.market.sha256, saved.sha256);
  assert.ok(!JSON.stringify(final).includes(made.buyerToken)); assert.ok(!JSON.stringify(final).includes(made.sellerToken));
  const replay = await rpc(page, 'approve', { ...keys, mid: view.milestones[0].id, pct: 100 }, 409);
  assert.ok(replay.error);
  if (process.env.ESCROWPAL_MARKET_STATE) await writeFile(process.env.ESCROWPAL_MARKET_STATE, JSON.stringify({ deal: keys, analysis: { id: analysis.id, k: analysis.token }, sha256: analysis.sha256 }), { mode: 0o600 });
  mark('Completed pilot exports a PDF and sealed full ledger without role keys, and rejects settlement replay');

  await page.goto(baseURL + '/dashboard'); await expect(page.getByRole('link', { name: /measured pilot/ }).first()).toBeVisible();
  await page.goto(baseURL + '/market'); await page.getByRole('button', { name: 'Fill the fictional bakery comparison' }).click();
  const unavailable = await result(page, 'marketAnalyze', () => page.getByRole('button', { name: 'Run evidence & Laya analysis' }).click());
  await expect(page.getByRole('heading', { name: 'No model recommendation available.' })).toBeVisible();
  assert.equal(unavailable.result.decision.status, 'unavailable'); assert.equal(unavailable.result.decision.choiceId, null);
  await page.getByLabel('Pilot to review').selectOption('newsletter'); await expect(page.getByLabel('Reason for your manual selection')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pilot agreement', exact: true })).toBeDisabled();
  mark('Disabled Laya produces no recommendation and requires an explained, reviewed manual choice');
  await page.goto(baseURL + '/market'); await page.getByRole('button', { name: 'Fill the fictional bakery comparison' }).click();
  for (const reference of await page.getByLabel('Source reference', { exact: true }).all()) await reference.fill('');
  const blocked = await result(page, 'marketAnalyze', () => page.getByRole('button', { name: 'Run evidence & Laya analysis' }).click());
  await expect(page.getByRole('heading', { name: 'More evidence is needed.' })).toBeVisible();
  assert.equal(blocked.result.decision.status, 'needs_evidence');
  await page.getByLabel('Pilot to review').selectOption('newsletter');
  await page.getByLabel('Reason for your manual selection').fill('Manual choice cannot replace missing source references.'); await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Create pilot agreement', exact: true })).toBeDisabled();
  mark('Missing evidence blocks pilot creation even after manual selection and acknowledgement');
  await page.goto(baseURL + '/market/' + analysis.id + '?k=wrong-key');
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('.market-results')).toHaveCount(0);
  await page.goto(buyerURL.replace(/k=[^&]+/, 'k=wrong-key'));
  await expect(page.getByRole('heading', { name: 'This room needs a valid private link.' })).toBeVisible();
  mark('Private analysis and agreement routes render visible access errors for invalid keys');
  // Access-denied responses are intentional; all normal navigation and settlement requests must succeed.
  const denied = report.badStatus.filter(entry => entry.status === 403);
  report.expectedDeniedReads = denied.length;
  report.unexpectedStatuses = report.badStatus.filter(entry => entry.status !== 403);
  assert.deepEqual(report.unexpectedStatuses, []); assert.deepEqual(report.pageErrors, []); report.expectedDownloadNavigations = report.failed.filter(entry => entry.url === attachmentURL && entry.reason === 'net::ERR_ABORTED');
  report.unexpectedFailedRequests = report.failed.filter(entry => !(entry.url === attachmentURL && entry.reason === 'net::ERR_ABORTED'));
  assert.deepEqual(report.unexpectedFailedRequests, []); assert.deepEqual(report.externalRequests, []);
  assert.ok(report.console.every(entry => /403/.test(entry.text)), 'Unexpected console warning/error');

  // Isolate fault injection so its intentionally failed response cannot mask ordinary console/network errors.
  const recovery = await session(); await recovery.goto(baseURL + '/market');
  await recovery.route('**/api/rpc', async route => {
    if (route.request().postDataJSON().action === 'marketExample') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary test outage. Try opening the example again.' }) });
    return route.continue();
  });
  await recovery.getByRole('button', { name: /Open recorded Laya example/ }).click();
  await expect(recovery.getByRole('alert')).toContainText('Temporary test outage');
  await expect(recovery.getByRole('button', { name: /Open recorded Laya example/ })).toBeEnabled();
  await recovery.unroute('**/api/rpc');
  await recovery.getByRole('button', { name: /Open recorded Laya example/ }).click(); await expect(recovery.locator('.market-results')).toBeVisible();
  report.injectedFailure = { status: 503, visibleError: true, retryRecovered: true };
  mark('An injected API outage displays a useful error and recovers when the user retries');
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = redact(error.stack || error);
  await page.screenshot({ path: 'test-results/market-workflow-failure.png', fullPage: true }).catch(() => {});
  console.error(report.failure); process.exitCode = 1;
} finally {
  await writeFile('test-results/market-workflow.json', JSON.stringify(report, null, 2));
  for (const context of contexts) await context.close(); await browser.close();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure }));
}
