import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, idempotencyKey, LIVE_NAMESPACE, MAX_MEMORIES, readTicket, signTicket } from '../server/hosted.js';
import { applyPaymentCheck, reconcilePayment } from '../server/policy.js';

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
    signingSecret: SECRET,
    maxReviewSui: '25',
    now: () => 1_700_000_000_000,
    ...overrides,
  };
  return { deps, calls };
}

async function call(handler, { method = 'GET', action, body, query = {}, origin, host = 'spendmemory.vercel.app' } = {}) {
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method, body, query: { action, ...query }, headers: { host, ...(origin ? { origin } : {}) } }, res);
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
