import test from 'node:test';
import assert from 'node:assert/strict';
import { createdAtMs, createHandler, GLOBAL_WRITE_LIMIT, idempotencyKey, LIVE_NAMESPACE, MAX_MEMORIES, readTicket, recentCount, signTicket, toProof, walletKey, WRITE_LIMIT } from '../server/hosted.js';
import { applyPaymentCheck, reconcilePayment } from '../server/policy.js';
import { saveMessage, viewMessage } from '../server/save-message.js';

// A stand-in wallet: a "signature" carries the exact message and the signing address.
const fakeSign = (message, address) => `fake:${Buffer.from(JSON.stringify({ message, address })).toString('base64')}`;
async function fakeVerify(bytes, signature, address) {
  if (!signature.startsWith('fake:')) throw new Error('bad signature');
  const { message, address: signer } = JSON.parse(Buffer.from(signature.slice(5), 'base64').toString());
  if (message !== new TextDecoder().decode(bytes) || signer !== address) throw new Error('bad signature');
}
async function signedBy(ticket, decision, reason, address) {
  const p = readTicket(ticket, SECRET, 1_700_000_000_000);
  return fakeSign(await saveMessage({ walletAddress: p.wallet, proposalId: p.id, decision, reason, expiresAt: p.expiresAt }), address ?? p.wallet);
}

const SECRET = 'test-secret';
const WALLET = `0x${'a'.repeat(64)}`;
const OTHER = `0x${'b'.repeat(64)}`;
const SUI = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const DIGEST = '7'.repeat(44);

function fakes(overrides = {}) {
  const calls = { remember: [], recall: [] };
  const deps = {
    hasMemory: () => true,
    hasTatum: () => true,
    getBalance: async () => '5000000000',
    getTransaction: async () => ({ effects: { status: { status: 'SUCCESS' } }, checkpoint: 123, timestampMs: '1700000000000', balanceChanges: [
      { owner: { address: WALLET }, coinType: { repr: SUI }, amount: '-21000000' },
      { owner: { address: OTHER }, coinType: { repr: SUI }, amount: '20000000' },
    ] }),
    recall: async (proposal, namespace) => { calls.recall.push(namespace); return []; },
    recallByProposal: async () => [],
    beginRemember: async (memory, namespace, options) => { calls.remember.push({ memory, namespace, options }); return { job_id: '00000000-0000-0000-0000-000000000001' }; },
    listProductMemories: async () => [],
    memoryJobStatus: async () => ({ status: 'done', blob_id: 'blob123' }),
    verifySignature: fakeVerify,
    signingSecret: SECRET,
    maxReviewSui: '25',
    now: () => 1_700_000_000_000,
    ...overrides,
  };
  return { deps, calls };
}

async function call(handler, { method = 'GET', action, body, query = {}, origin, host = 'spendmemory.vercel.app', ip = '203.0.113.7' } = {}) {
  if (action === 'remember' && body && body.signature === undefined) {
    try { body = { ...body, signature: await signedBy(body.ticket, body.decision, String(body.reason ?? '')) }; } catch { /* leave unsigned: the ticket itself is under test */ }
  }
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method, body, query: { action, ...query }, headers: { host, 'x-forwarded-for': `${ip}, 10.0.0.1`, ...(origin ? { origin } : {}) } }, res);
  return res;
}

const proposalBody = { merchant: 'DemoCloud subscription', category: 'Software', amountSui: '0.02', walletAddress: WALLET };

test('refuses to run without a signing secret', async () => {
  const { deps } = fakes({ signingSecret: '' });
  const res = await call(createHandler(deps), { action: 'status' });
  assert.equal(res.statusCode, 503);
});

test('status reports visitor and demo memory counts separately', async () => {
  const { deps } = fakes({ listProductMemories: async (ns) => (ns === LIVE_NAMESPACE ? [1, 2] : [1, 2, 3]) });
  const res = await call(createHandler(deps), { action: 'status' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.memoryCount, 2);
  assert.equal(res.body.demoMemoryCount, 3);
  assert.equal(res.body.maxMemories, MAX_MEMORIES);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.lastSavedAt, null);
  assert.equal(res.body.recentSaves, 0);
});

test('a bad amount is a 400, not a server error', async () => {
  const { deps } = fakes();
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: { ...proposalBody, amountSui: 'lots' } });
  assert.equal(res.statusCode, 400);
});

test('an invalid wallet address is rejected', async () => {
  const { deps } = fakes();
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: { ...proposalBody, walletAddress: '0x123' } });
  assert.equal(res.statusCode, 400);
});

test('cross-site writes are blocked', async () => {
  const { deps } = fakes();
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: proposalBody, origin: 'https://evil.example' });
  assert.equal(res.statusCode, 403);
});

test('evaluate recalls from the visitor namespace and signs a ticket', async () => {
  const { deps, calls } = fakes();
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: proposalBody });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.recall, [LIVE_NAMESPACE]);
  const payload = readTicket(res.body.ticket, SECRET, 1_700_000_000_000);
  assert.equal(payload.merchant, 'democloud subscription');
  assert.equal(payload.payment, null);
  assert.equal(res.body.evaluation.payment, null);
});

test('a saved decision carries the proposal and an idempotency key', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Unrequested renewal, check the invoice first.' } });
  assert.equal(res.statusCode, 202);
  assert.equal(calls.remember.length, 1);
  const { memory, namespace, options } = calls.remember[0];
  assert.equal(namespace, LIVE_NAMESPACE);
  assert.equal(memory.proposalId, evaluated.body.proposal.id);
  assert.equal(memory.scenarioType, 'user-reported');
  assert.equal(options.idempotencyKey, idempotencyKey(evaluated.body.proposal.id));
  assert.equal(memory.payment, undefined);
});

test('a proposal that already has a saved decision cannot be saved twice', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  deps.recallByProposal = async () => [{ text: JSON.stringify({ proposalId: evaluated.body.proposal.id }) }];
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Second attempt at the same proposal.' } });
  assert.equal(res.statusCode, 409);
  assert.equal(calls.remember.length, 0);
});

test('the same proposal always maps to the same idempotency key', () => {
  assert.equal(idempotencyKey('p-1'), idempotencyKey('p-1'));
  assert.notEqual(idempotencyKey('p-1'), idempotencyKey('p-2'));
});

test('writes stop at the public cap', async () => {
  const { deps, calls } = fakes({ listProductMemories: async () => new Array(MAX_MEMORIES).fill(0) });
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'approve', reason: 'Planned monthly renewal.' } });
  assert.equal(res.statusCode, 429);
  assert.equal(calls.remember.length, 0);
});

test('tampered, malformed and expired tickets are rejected with 400', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const good = signTicket({ id: 'p1', merchant: 'm', category: 'c', amountSui: '1', createdAt: 'x', expiresAt: 1_700_000_100_000 }, SECRET);
  const [body, sig] = good.split('.');
  const forged = `${Buffer.from(JSON.stringify({ id: 'p1', merchant: 'other', category: 'c', amountSui: '1', createdAt: 'x', expiresAt: 1_700_000_100_000 })).toString('base64url')}.${sig}`;
  const expired = signTicket({ id: 'p2', expiresAt: 1_699_999_999_999 }, SECRET);
  const otherKey = signTicket({ id: 'p3', expiresAt: 1_700_000_100_000 }, 'another-secret');
  for (const ticket of [forged, `${body}.${sig}.extra`, 'nonsense', expired, otherKey, 42]) {
    const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket, decision: 'decline', reason: 'Long enough reason.' } });
    assert.equal(res.statusCode, 400, `ticket ${String(ticket).slice(0, 12)} should be rejected`);
  }
  assert.equal(calls.remember.length, 0);
});

test('a short reason or unknown decision is rejected', async () => {
  const { deps } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  for (const body of [{ decision: 'decline', reason: 'short' }, { decision: 'maybe', reason: 'A perfectly long reason.' }]) {
    const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, ...body } });
    assert.equal(res.statusCode, 400);
  }
});

test('a verified payment is checked by Tatum and travels into the saved memory', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: { ...proposalBody, txDigest: DIGEST } });
  assert.equal(evaluated.statusCode, 200);
  assert.equal(evaluated.body.evaluation.payment.matches, true);
  assert.match(evaluated.body.evaluation.reasons.at(-1), /Tatum confirmed this wallet paid exactly 0.02 SUI/);
  await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'approve', reason: 'Paid the agreed monthly plan.' } });
  assert.deepEqual(calls.remember[0].memory.payment, { digest: DIGEST, checkpoint: 123, verifiedBy: 'tatum-sui-graphql' });
});

test('a malformed transaction digest is rejected before any lookup', async () => {
  const { deps } = fakes({ getTransaction: async () => { throw new Error('should not be called'); } });
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: { ...proposalBody, txDigest: 'not-a-digest!' } });
  assert.equal(res.statusCode, 400);
});

test('a payment that cannot be fetched is reported, not trusted', async () => {
  const { deps } = fakes({ getTransaction: async () => { throw new Error('Transaction not found on Sui Mainnet.'); } });
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: { ...proposalBody, txDigest: DIGEST } });
  assert.equal(evaluated.statusCode, 200);
  assert.equal(evaluated.body.evaluation.payment.checked, false);
  assert.match(evaluated.body.evaluation.payment.error, /not found/);
  assert.equal(readTicket(evaluated.body.ticket, SECRET, 1_700_000_000_000).payment, null);
});

test('job status rejects malformed IDs and returns the blob when done', async () => {
  const { deps } = fakes();
  const handler = createHandler(deps);
  assert.equal((await call(handler, { action: 'memory-status', query: { jobId: '../etc' } })).statusCode, 400);
  const ok = await call(handler, { action: 'memory-status', query: { jobId: '00000000-0000-0000-0000-000000000001' } });
  assert.deepEqual(ok.body, { status: 'done', blobId: 'blob123', error: null });
});

test('reconciliation needs the exact amount, a SUI coin, a paying wallet and success', () => {
  const base = { status: 'SUCCESS', walletAddress: WALLET, amountMist: 20000000n };
  const paid = { owner: { address: WALLET }, coinType: { repr: SUI }, amount: '-21000000' };
  const received = { owner: { address: OTHER }, coinType: { repr: '0x2::sui::SUI' }, amount: '20000000' };
  assert.equal(reconcilePayment({ ...base, balanceChanges: [paid, received] }).matches, true);
  assert.equal(reconcilePayment({ ...base, balanceChanges: [paid, { ...received, amount: '19000000' }] }).matches, false);
  assert.equal(reconcilePayment({ ...base, balanceChanges: [paid, { ...received, coinType: { repr: '0xabc::usdc::USDC' } }] }).matches, false);
  assert.equal(reconcilePayment({ ...base, balanceChanges: [{ ...paid, amount: '5' }, received] }).matches, false);
  assert.equal(reconcilePayment({ ...base, status: 'FAILURE', balanceChanges: [paid, received] }).matches, false);
  assert.equal(reconcilePayment({ ...base, balanceChanges: [paid, received] }).walletChangeSui, '-0.021');
});

test('a payment mismatch can only make the suggestion more cautious', () => {
  const consider = { recommendation: 'consider', reasons: ['Past approval.'] };
  const decline = { recommendation: 'decline', reasons: ['Past decline.'] };
  assert.equal(applyPaymentCheck(consider, { checked: true, matches: false, succeeded: true }, '1').recommendation, 'review');
  assert.equal(applyPaymentCheck(consider, { checked: false }, '1').recommendation, 'review');
  assert.equal(applyPaymentCheck(decline, { checked: true, matches: true, succeeded: true }, '1').recommendation, 'decline');
  assert.equal(applyPaymentCheck(consider, null, '1'), consider);
});

test('one connection cannot flood the shared memory', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const statuses = [];
  for (let i = 0; i <= WRITE_LIMIT; i++) {
    const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
    statuses.push((await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Flooding attempt number ' + i } })).statusCode);
  }
  assert.deepEqual(statuses, [...new Array(WRITE_LIMIT).fill(202), 429]);
  assert.equal(calls.remember.length, WRITE_LIMIT);
  const other = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody, ip: '198.51.100.9' });
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: other.body.ticket, decision: 'approve', reason: 'A different visitor.' }, ip: '198.51.100.9' });
  assert.equal(res.statusCode, 202);
});

test('a burst of saves across all visitors is refused, using Walrus timestamps', async () => {
  const NOW = 1_700_000_000_000;
  const recent = Array.from({ length: GLOBAL_WRITE_LIMIT }, (_, i) => ({ created_at: new Date(NOW - i * 1000).toISOString() }));
  const { deps, calls } = fakes({ listProductMemories: async () => recent });
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody, ip: '192.0.2.1' });
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Arrives during a burst.' }, ip: '192.0.2.1' });
  assert.equal(res.statusCode, 429);
  assert.equal(calls.remember.length, 0);
  const old = recent.map(() => ({ created_at: new Date(NOW - 11 * 60_000).toISOString() }));
  deps.listProductMemories = async () => old;
  const later = await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Arrives after the burst.' }, ip: '192.0.2.1' });
  assert.equal(later.statusCode, 202);
});

test('Walrus timestamps are read as ISO strings, seconds or milliseconds', () => {
  const ms = 1_700_000_000_000;
  assert.equal(createdAtMs('2023-11-14T22:13:20.000Z'), ms);
  assert.equal(createdAtMs(1_700_000_000), ms);
  assert.equal(createdAtMs(String(ms)), ms);
  assert.equal(createdAtMs('not a date'), null);
  assert.equal(createdAtMs(undefined), null);
  assert.equal(recentCount([{ created_at: ms - 1000 }, { created_at: ms - 11 * 60_000 }, {}], ms), 1);
});

test('memory is per wallet: another wallet\'s decisions do not shape this review', async () => {
  const mine = walletKey(WALLET);
  const theirs = walletKey(OTHER);
  const memory = (key, decision) => ({ text: JSON.stringify({ app: 'spendmemory', v: 1, merchant: 'democloud subscription', category: 'software', decision, walletKey: key }), blob_id: `${decision}-${key}` });
  const { deps } = fakes({ recall: async () => [memory(theirs, 'decline'), memory(theirs, 'decline'), memory(mine, 'approve')] });
  const res = await call(createHandler(deps), { method: 'POST', action: 'evaluate', body: proposalBody });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.evaluation.matchedMemories.map((m) => m.blobId), [`approve-${mine}`]);
  assert.equal(res.body.evaluation.recommendation, 'consider');
  assert.equal(readTicket(res.body.ticket, SECRET, 1_700_000_000_000).walletKey, mine);
});

test('a saved decision is stored with its wallet key, not the address', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: { ...proposalBody, walletAddress: WALLET.toUpperCase().replace('0X', '0x') } });
  await call(handler, { method: 'POST', action: 'remember', body: { ticket: evaluated.body.ticket, decision: 'decline', reason: 'Not this month, thanks.' } });
  const { memory } = calls.remember[0];
  assert.equal(memory.walletKey, walletKey(WALLET));
  assert.equal(JSON.stringify(memory).includes(WALLET.slice(2)), false);
});

test('a ticket issued before per-wallet memory must be evaluated again', async () => {
  const { deps, calls } = fakes();
  const old = signTicket({ id: 'p-old', merchant: 'm', category: 'c', amountSui: '1', createdAt: 'x', payment: null, expiresAt: 1_700_000_100_000 }, SECRET);
  const res = await call(createHandler(deps), { method: 'POST', action: 'remember', body: { ticket: old, decision: 'decline', reason: 'Saved from an old tab.' } });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.remember.length, 0);
});

test('the proof list shows checkable facts and hides personal notes', async () => {
  const saved = (o) => ({ blob_id: o.blob, text: JSON.stringify({ app: 'spendmemory', v: 1, merchant: 'My landlord', category: 'rent', decision: o.decision, reason: 'private note', walletKey: 'w_abc', createdAt: o.at, ...(o.payment ? { payment: o.payment } : {}) }) });
  const items = [
    saved({ blob: 'b-old', decision: 'approve', at: '2026-10-28T09:00:00.000Z' }),
    saved({ blob: 'b-new', decision: 'decline', at: '2026-10-29T09:00:00.000Z', payment: { digest: DIGEST, checkpoint: 9 } }),
    { blob_id: 'junk', text: 'not json' },
    { blob_id: 'other', text: JSON.stringify({ app: 'someone-else', decision: 'approve' }) },
  ];
  const { deps } = fakes({ recallRecent: async (ns) => { assert.equal(ns, LIVE_NAMESPACE); return items; } });
  const res = await call(createHandler(deps), { action: 'proofs' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.proofs.map((p) => p.blobId), ['b-new', 'b-old']);
  assert.deepEqual(res.body.proofs[0].payment, { digest: DIGEST, checkpoint: 9 });
  const text = JSON.stringify(res.body);
  for (const secret of ['My landlord', 'private note', 'w_abc']) assert.equal(text.includes(secret), false, `${secret} leaked`);
  assert.equal(toProof({ blob_id: 'x', text: '{}' }), null);
});

test('saving needs a signature from the reviewed wallet', async () => {
  const { deps, calls } = fakes();
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  const ticket = evaluated.body.ticket;
  const reason = 'Unrequested renewal, check the invoice.';
  const attempts = {
    missing: '',
    otherWallet: await signedBy(ticket, 'decline', reason, OTHER),
    otherDecision: await signedBy(ticket, 'approve', reason),
    otherReason: await signedBy(ticket, 'decline', 'A different reason entirely.'),
    garbage: 'not-a-real-signature-at-all',
  };
  for (const [name, signature] of Object.entries(attempts)) {
    const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket, decision: 'decline', reason, signature } });
    assert.equal(res.statusCode, 401, name);
  }
  assert.equal(calls.remember.length, 0);
  const ok = await call(handler, { method: 'POST', action: 'remember', body: { ticket, decision: 'decline', reason, signature: await signedBy(ticket, 'decline', reason) } });
  assert.equal(ok.statusCode, 202);
  assert.equal(calls.remember[0].memory.signedBy, 'reviewed-wallet');
});

test('the signed message names the wallet, proposal and decision and moves no funds', async () => {
  const m = await saveMessage({ walletAddress: WALLET.toUpperCase().replace('0X', '0x'), proposalId: 'p-1', decision: 'decline', reason: '  Not needed  ', expiresAt: 1_700_000_100_000 });
  assert.match(m, new RegExp(`Wallet: ${WALLET}`));
  assert.match(m, /Proposal: p-1/);
  assert.match(m, /Decision: decline/);
  assert.match(m, /Reason SHA-256: [0-9a-f]{64}/);
  assert.match(m, /does not move funds/);
  assert.equal(m, await saveMessage({ walletAddress: WALLET, proposalId: 'p-1', decision: 'decline', reason: 'Not needed', expiresAt: 1_700_000_100_000 }));
});

test('reasons stay private: the brief omits them and only the signed-in owner can read them', async () => {
  const mine = walletKey(WALLET);
  const memory = (key, reason) => ({ text: JSON.stringify({ app: 'spendmemory', v: 1, merchant: 'democloud subscription', category: 'software', decision: 'decline', reason, walletKey: key, createdAt: '2026-10-28T10:00:00.000Z' }), blob_id: `b-${reason.length}` });
  const { deps } = fakes({ recall: async () => [memory(mine, 'My private note about this charge'), memory(walletKey(OTHER), 'Someone else entirely')] });
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  assert.equal(evaluated.body.evaluation.matchedMemories.length, 1);
  assert.equal(JSON.stringify(evaluated.body).includes('private note'), false);
  const p = readTicket(evaluated.body.ticket, SECRET, 1_700_000_000_000);
  const view = viewMessage({ walletAddress: p.wallet, proposalId: p.id, expiresAt: p.expiresAt });
  for (const signature of [undefined, fakeSign(view, OTHER), fakeSign(view.replace('Proposal:', 'Proposal: x'), p.wallet)]) {
    const res = await call(handler, { method: 'POST', action: 'reasons', body: { ticket: evaluated.body.ticket, signature } });
    assert.equal(res.statusCode, 401);
  }
  const ok = await call(handler, { method: 'POST', action: 'reasons', body: { ticket: evaluated.body.ticket, signature: fakeSign(view, p.wallet) } });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.body.reasons.map((r) => r.reason), ['My private note about this charge']);
});

test('a rejected signature is logged with a cause but no reason, merchant or signature', async () => {
  const lines = [];
  const { deps } = fakes({ log: (line) => lines.push(line) });
  const handler = createHandler(deps);
  const evaluated = await call(handler, { method: 'POST', action: 'evaluate', body: proposalBody });
  const ticket = evaluated.body.ticket;
  const reason = 'Unrequested renewal, check the invoice.';
  const signature = await signedBy(ticket, 'decline', reason, OTHER);
  const res = await call(handler, { method: 'POST', action: 'remember', body: { ticket, decision: 'decline', reason, signature, signedBytes: Buffer.from('something else').toString('base64') } });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /signed a different message/);
  assert.ok(lines.some((l) => /signature rejected: scheme=\S+ walletSignedSameBytes=false/.test(l)));
  const all = lines.join('\n');
  for (const secret of [reason, 'DemoCloud', signature]) assert.equal(all.includes(secret), false, secret);
});
