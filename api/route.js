import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { evaluatePolicy, mistToSui, normalizeLabel, parseSuiToMist, relevantMemories } from '../server/policy.js';
import { beginRemember, getBalance, getTransaction, hasMemory, hasTatum, listProductMemories, memoryJobStatus, recall } from '../server/integrations.js';

const ADDRESS = /^0x[a-fA-F0-9]{64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const JOB = /^[0-9a-f-]{36}$/i;
const MAX_MEMORIES = 100;
const maxReviewMist = parseSuiToMist(process.env.MAX_REVIEW_SUI || '25');
const send = (res, code, value) => res.status(code).json(value);
const scrub = (error) => error instanceof Error ? error.message : 'Unknown error';

function ticket(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.APP_SIGNING_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readTicket(value) {
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Invalid proposal ticket.');
  const [body, signature] = value.split('.');
  if (!body || !signature) throw new Error('Invalid proposal ticket.');
  const expected = createHmac('sha256', process.env.APP_SIGNING_SECRET).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid proposal ticket.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.id || !payload.expiresAt || Date.now() > payload.expiresAt) throw new Error('Proposal ticket expired. Evaluate again.');
  return payload;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.APP_SIGNING_SECRET || !hasMemory() || !hasTatum()) return send(res, 503, { error: 'Live integrations are not configured.' });
  if (req.method !== 'GET' && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Cross-site writes are blocked.' }); }
    catch { return send(res, 403, { error: 'Invalid request origin.' }); }
  }
  const action = String(req.query.action || '');
  try {
    if (action === 'status' && req.method === 'GET') {
      const count = (await listProductMemories()).length;
      return send(res, 200, { network: 'Sui Mainnet', memoryCount: count, maxMemories: MAX_MEMORIES, maxReviewSui: mistToSui(maxReviewMist) });
    }
    if (action === 'evaluate' && req.method === 'POST') {
      const merchant = String(req.body?.merchant || '').trim();
      const category = String(req.body?.category || '').trim();
      const walletAddress = String(req.body?.walletAddress || '').trim();
      const amountMist = parseSuiToMist(req.body?.amountSui);
      if (merchant.length < 2 || merchant.length > 80 || category.length < 2 || category.length > 50 || !ADDRESS.test(walletAddress)) return send(res, 400, { error: 'Enter a merchant, category, and valid Sui address.' });
      const proposal = { id: randomUUID(), merchant, category, walletAddress, amountMist: String(amountMist), amountSui: mistToSui(amountMist), createdAt: new Date().toISOString() };
      const [balanceResult, memoryResult] = await Promise.allSettled([getBalance(walletAddress), recall(proposal)]);
      const balanceMist = balanceResult.status === 'fulfilled' ? balanceResult.value : null;
      const matches = memoryResult.status === 'fulfilled' ? relevantMemories(memoryResult.value, proposal) : [];
      const evaluation = { ...evaluatePolicy({ proposal, balanceMist, memories: matches, maxReviewMist }), balanceSui: balanceMist == null ? null : mistToSui(balanceMist), chainVerified: balanceMist != null, memoryVerified: memoryResult.status === 'fulfilled', chainError: balanceResult.status === 'rejected' ? scrub(balanceResult.reason) : null, memoryError: memoryResult.status === 'rejected' ? scrub(memoryResult.reason) : null, matchedMemories: matches.map(({ blobId, decision, reason, createdAt }) => ({ blobId, decision, reason, createdAt })) };
      const signed = ticket({ id: proposal.id, merchant: normalizeLabel(merchant), category: normalizeLabel(category), amountSui: proposal.amountSui, createdAt: proposal.createdAt, expiresAt: Date.now() + 30 * 60_000 });
      return send(res, 200, { proposal, evaluation, ticket: signed });
    }
    if (action === 'remember' && req.method === 'POST') {
      const payload = readTicket(req.body?.ticket);
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();
      if (!['approve', 'decline'].includes(decision) || reason.length < 8 || reason.length > 500) return send(res, 400, { error: 'Choose approve or decline and give a reason of 8–500 characters.' });
      if ((await listProductMemories()).length >= MAX_MEMORIES) return send(res, 429, { error: 'Public demo memory cap reached. Evaluation remains available.' });
      const memory = { app: 'spendmemory', v: 1, source: 'public-web', merchant: payload.merchant, category: payload.category, amountSui: payload.amountSui, decision, reason, createdAt: payload.createdAt, proposalId: payload.id };
      const accepted = await beginRemember(memory);
      return send(res, 202, { jobId: accepted.job_id });
    }
    if (action === 'memory-status' && req.method === 'GET') {
      const jobId = String(req.query.jobId || '');
      if (!JOB.test(jobId)) return send(res, 400, { error: 'Invalid memory job ID.' });
      const job = await memoryJobStatus(jobId);
      return send(res, 200, { status: job.status, blobId: job.blob_id || null, error: job.status === 'failed' ? job.error : null });
    }
    if (action === 'transaction' && req.method === 'GET') {
      const digest = String(req.query.digest || '');
      if (!DIGEST.test(digest)) return send(res, 400, { error: 'Invalid Sui transaction digest.' });
      const tx = await getTransaction(digest);
      return send(res, 200, { digest, status: tx.effects.status.status, checkpoint: tx.checkpoint, balanceChanges: tx.balanceChanges });
    }
    return send(res, 404, { error: 'Unknown API action.' });
  } catch (error) { return send(res, 502, { error: scrub(error) }); }
}
