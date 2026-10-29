import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { saveMessage, viewMessage } from './save-message.js';
import { applyPaymentCheck, evaluatePolicy, mistToSui, normalizeLabel, parseSuiToMist, reconcilePayment, relevantMemories } from './policy.js';

// The public Vercel API, written against injected integrations so it can be tested without network access.

export const LIVE_NAMESPACE = 'spendmemory-user-decisions-v1';
export const MAX_MEMORIES = 100;
const ADDRESS = /^0x[a-fA-F0-9]{64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const JOB = /^[0-9a-f-]{36}$/i;
const TICKET_TTL_MS = 30 * 60_000;
export const WRITE_LIMIT = 5;
export const WRITE_WINDOW_MS = 10 * 60_000;
export const GLOBAL_WRITE_LIMIT = 15;

/** Milliseconds since epoch for a Walrus created_at value (ISO string, or seconds/ms number), or null. */
export function createdAtMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : t;
}

/** How many memories in a namespace listing were created inside the window ending at `now`. */
export function recentCount(memories, now, windowMs = WRITE_WINDOW_MS) {
  const cutoff = now - windowMs;
  return memories.filter((m) => { const t = createdAtMs(m?.created_at); return t !== null && t > cutoff; }).length;
}

class ClientError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const scrub = (error) => error instanceof Error ? error.message : 'Unknown error';
const send = (res, code, value) => res.status(code).json(value);

export function signTicket(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function readTicket(value, secret, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 3000) throw new ClientError(400, 'Invalid proposal ticket.');
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra !== undefined) throw new ClientError(400, 'Invalid proposal ticket.');
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ClientError(400, 'Invalid proposal ticket.');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { throw new ClientError(400, 'Invalid proposal ticket.'); }
  if (!payload.id || !payload.expiresAt || now > payload.expiresAt) throw new ClientError(400, 'Proposal ticket expired. Evaluate again.');
  return payload;
}

/** True if a confirmed memory for this proposal is already in the namespace. */
export function alreadySaved(results, proposalId) {
  return results.some((item) => {
    try { return JSON.parse(item.text).proposalId === proposalId; } catch { return false; }
  });
}

/**
 * Memories belong to the wallet they were saved for. The key is a hash of the lower-cased address,
 * so memory text does not carry the address itself. It is pseudonymous, not secret: addresses are public.
 */
export function walletKey(address) {
  return `w_${createHash('sha256').update(String(address).trim().toLowerCase()).digest('hex').slice(0, 32)}`;
}

/** Keeps only memories saved for this wallet. */
export function forWallet(memories, key) {
  return memories.filter((m) => m.walletKey === key);
}

/**
 * Public evidence for one saved visitor decision. Deliberately leaves out the merchant label, the reason
 * and the wallet key: those are the visitor's own notes. Keeps what anyone can check.
 */
export function toProof(item) {
  let m;
  try { m = JSON.parse(item.text); } catch { return null; }
  if (m?.app !== 'spendmemory' || !['approve', 'decline'].includes(m.decision) || !item.blob_id) return null;
  return {
    blobId: item.blob_id,
    decision: m.decision,
    category: typeof m.category === 'string' ? m.category.slice(0, 50) : null,
    createdAt: m.createdAt || item.created_at || null,
    walletBound: Boolean(m.walletKey),
    signed: Boolean(m.signedBy),
    payment: m.payment?.digest ? { digest: m.payment.digest, checkpoint: m.payment.checkpoint ?? null } : null,
  };
}

export function idempotencyKey(proposalId) {
  return `spendmemory-proposal-${createHash('sha256').update(String(proposalId)).digest('hex').slice(0, 32)}`;
}

/**
 * deps: { hasMemory, hasTatum, getBalance, getTransaction, recall, recallByProposal, beginRemember,
 *         listProductMemories, memoryJobStatus, signingSecret, maxReviewSui, now }
 */
export function createHandler(deps) {
  const now = deps.now || (() => Date.now());
  const maxReviewMist = parseSuiToMist(deps.maxReviewSui || '25');
  // Logs carry no reasons, merchants or signatures: only enough to tell why a wallet's signature failed.
  const log = deps.log || ((line) => console.warn(line));
  const SCHEMES = { 0: 'ed25519', 1: 'secp256k1', 2: 'secp256r1', 3: 'multisig', 5: 'zklogin', 6: 'passkey' };
  async function checkSignature(message, signature, wallet, signedBytes, purpose) {
    const expected = new TextEncoder().encode(message);
    try { await deps.verifySignature(expected, signature, wallet); }
    catch (error) {
      let scheme = 'unknown';
      try { scheme = SCHEMES[Buffer.from(signature, 'base64')[0]] ?? 'unknown'; } catch { /* not base64 */ }
      const sameBytes = typeof signedBytes === 'string' ? signedBytes === Buffer.from(expected).toString('base64') : 'not sent';
      log(`[${purpose}] signature rejected: scheme=${scheme} walletSignedSameBytes=${sameBytes} reason=${String(error?.message || error).slice(0, 160)}`);
      const hint = sameBytes === false ? ' Your wallet signed a different message than the one shown; try another wallet.' : '';
      throw new ClientError(401, `That signature is not from the wallet being reviewed. Connect that wallet and sign again.${hint}`);
    }
  }
  // Per connection, per instance: serverless instances do not share memory. The Walrus-backed global limit below is shared.
  const recentWrites = new Map();
  function allowWrite(ip) {
    const cutoff = now() - WRITE_WINDOW_MS;
    const times = (recentWrites.get(ip) || []).filter((t) => t > cutoff);
    if (times.length >= WRITE_LIMIT) { recentWrites.set(ip, times); return false; }
    times.push(now());
    recentWrites.set(ip, times);
    if (recentWrites.size > 5000) recentWrites.delete(recentWrites.keys().next().value);
    return true;
  }

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const secret = deps.signingSecret;
    if (!secret || !deps.hasMemory() || !deps.hasTatum()) return send(res, 503, { error: 'Live integrations are not configured.' });
    if (req.method !== 'GET' && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Cross-site writes are blocked.' }); }
      catch { return send(res, 403, { error: 'Invalid request origin.' }); }
    }
    const action = String(req.query?.action || '');
    try {
      if (action === 'status' && req.method === 'GET') {
        const [live, demo] = await Promise.all([deps.listProductMemories(LIVE_NAMESPACE), deps.listProductMemories()]);
        const newest = (list) => { const ts = list.map((m) => createdAtMs(m?.created_at)).filter((t) => t !== null); return ts.length ? new Date(Math.max(...ts)).toISOString() : null; };
        return send(res, 200, { network: 'Sui Mainnet', memoryCount: live.length, demoMemoryCount: demo.length, totalMemoryCount: live.length + demo.length, maxMemories: MAX_MEMORIES, maxReviewSui: mistToSui(maxReviewMist), lastSavedAt: newest(live), demoLastSavedAt: newest(demo), recentSaves: recentCount(live, now()), recentSaveLimit: GLOBAL_WRITE_LIMIT });
      }

      if (action === 'evaluate' && req.method === 'POST') {
        const merchant = String(req.body?.merchant || '').trim();
        const category = String(req.body?.category || '').trim();
        const walletAddress = String(req.body?.walletAddress || '').trim();
        const txDigest = String(req.body?.txDigest || '').trim();
        let amountMist;
        try { amountMist = parseSuiToMist(req.body?.amountSui); }
        catch (error) { throw new ClientError(400, scrub(error)); }
        if (merchant.length < 2 || merchant.length > 80 || category.length < 2 || category.length > 50 || !ADDRESS.test(walletAddress)) throw new ClientError(400, 'Enter a merchant, category, and valid Sui address.');
        if (txDigest && !DIGEST.test(txDigest)) throw new ClientError(400, 'That does not look like a Sui transaction digest.');

        const wallet = walletKey(walletAddress);
        const proposal = { id: randomUUID(), merchant, category, walletAddress, walletKey: wallet, amountMist: String(amountMist), amountSui: mistToSui(amountMist), createdAt: new Date(now()).toISOString() };
        const [balanceResult, memoryResult, txResult] = await Promise.allSettled([
          deps.getBalance(walletAddress),
          deps.recall(proposal, LIVE_NAMESPACE),
          txDigest ? deps.getTransaction(txDigest) : Promise.resolve(null),
        ]);
        const balanceMist = balanceResult.status === 'fulfilled' ? balanceResult.value : null;
        const matches = memoryResult.status === 'fulfilled' ? forWallet(relevantMemories(memoryResult.value, proposal), wallet) : [];
        let payment = null;
        if (txDigest) {
          if (txResult.status === 'fulfilled' && txResult.value) {
            const tx = txResult.value;
            payment = { digest: txDigest, checkpoint: tx.checkpoint, timestampMs: tx.timestampMs, ...reconcilePayment({ status: tx.effects.status.status, balanceChanges: tx.balanceChanges, walletAddress, amountMist }), error: null };
          } else {
            payment = { digest: txDigest, checked: false, error: txResult.status === 'rejected' ? scrub(txResult.reason) : 'Transaction was not returned.' };
          }
        }
        const base = evaluatePolicy({ proposal, balanceMist, memories: matches, maxReviewMist });
        const evaluation = {
          ...applyPaymentCheck(base, payment, proposal.amountSui),
          balanceSui: balanceMist == null ? null : mistToSui(balanceMist),
          chainVerified: balanceMist != null,
          memoryVerified: memoryResult.status === 'fulfilled',
          chainError: balanceResult.status === 'rejected' ? scrub(balanceResult.reason) : null,
          memoryError: memoryResult.status === 'rejected' ? scrub(memoryResult.reason) : null,
          // Reasons are the wallet owner's notes: they come back only through the signed `reasons` action.
          matchedMemories: matches.map(({ blobId, decision, createdAt }) => ({ blobId, decision, createdAt })),
          payment,
        };
        const verifiedPayment = payment?.matches ? { digest: payment.digest, checkpoint: payment.checkpoint } : null;
        const signed = signTicket({ id: proposal.id, merchant: normalizeLabel(merchant), category: normalizeLabel(category), amountSui: proposal.amountSui, createdAt: proposal.createdAt, walletKey: wallet, wallet: walletAddress.toLowerCase(), payment: verifiedPayment, expiresAt: now() + TICKET_TTL_MS }, secret);
        return send(res, 200, { proposal, evaluation, ticket: signed });
      }

      if (action === 'remember' && req.method === 'POST') {
        const payload = readTicket(req.body?.ticket, secret, now());
        if (!payload.walletKey) throw new ClientError(400, 'This review was made before memory became per wallet. Evaluate it again.');
        const decision = String(req.body?.decision || '');
        const reason = String(req.body?.reason || '').trim();
        if (!['approve', 'decline'].includes(decision) || reason.length < 8 || reason.length > 500) throw new ClientError(400, 'Choose approve or decline and give a reason of 8–500 characters.');
        if (!payload.wallet) throw new ClientError(400, 'This review was made before wallet signing. Evaluate it again.');
        const signature = req.body?.signature;
        if (typeof signature !== 'string' || signature.length < 16 || signature.length > 5000) throw new ClientError(401, 'Connect the wallet you are reviewing and sign to save this decision.');
        const message = await saveMessage({ walletAddress: payload.wallet, proposalId: payload.id, decision, reason, expiresAt: payload.expiresAt });
        await checkSignature(message, signature, payload.wallet, req.body?.signedBytes, 'remember');
        const ip = String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
        if (!allowWrite(ip)) throw new ClientError(429, 'Too many saved decisions from this connection. Try again in a few minutes.');
        const [existing, saved] = await Promise.all([deps.listProductMemories(LIVE_NAMESPACE), deps.recallByProposal(payload, LIVE_NAMESPACE)]);
        if (alreadySaved(saved, payload.id)) throw new ClientError(409, 'This proposal already has a saved decision. Evaluate a new proposal to record another.');
        if (existing.length >= MAX_MEMORIES) throw new ClientError(429, 'Public demo memory cap reached. Evaluation remains available.');
        // Shared across every serverless instance: Walrus records when each memory was created.
        if (recentCount(existing, now()) >= GLOBAL_WRITE_LIMIT) throw new ClientError(429, 'Many decisions were saved in the last few minutes. Try again shortly.');
        const memory = { app: 'spendmemory', v: 1, source: 'public-web', scenarioType: 'user-reported', merchant: payload.merchant, category: payload.category, amountSui: payload.amountSui, decision, reason, createdAt: payload.createdAt, proposalId: payload.id, walletKey: payload.walletKey, signedBy: 'reviewed-wallet' };
        if (payload.payment) memory.payment = { digest: payload.payment.digest, checkpoint: payload.payment.checkpoint, verifiedBy: 'tatum-sui-graphql' };
        const accepted = await deps.beginRemember(memory, LIVE_NAMESPACE, { idempotencyKey: idempotencyKey(payload.id) });
        return send(res, 202, { jobId: accepted.job_id });
      }

      if (action === 'reasons' && req.method === 'POST') {
        const payload = readTicket(req.body?.ticket, secret, now());
        if (!payload.wallet || !payload.walletKey) throw new ClientError(400, 'This review was made before wallet signing. Evaluate it again.');
        const signature = req.body?.signature;
        if (typeof signature !== 'string' || signature.length < 16 || signature.length > 5000) throw new ClientError(401, 'Connect the wallet you are reviewing and sign to see its reasons.');
        const message = viewMessage({ walletAddress: payload.wallet, proposalId: payload.id, expiresAt: payload.expiresAt });
        await checkSignature(message, signature, payload.wallet, req.body?.signedBytes, 'reasons');
        const proposal = { merchant: payload.merchant, category: payload.category, walletKey: payload.walletKey };
        const matches = forWallet(relevantMemories(await deps.recall(proposal, LIVE_NAMESPACE), proposal), payload.walletKey);
        return send(res, 200, { reasons: matches.map(({ blobId, decision, reason, createdAt }) => ({ blobId, decision, reason, createdAt })) });
      }

      if (action === 'proofs' && req.method === 'GET') {
        const items = await deps.recallRecent(LIVE_NAMESPACE);
        const proofs = items.map(toProof).filter(Boolean)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        return send(res, 200, { namespace: LIVE_NAMESPACE, count: proofs.length, proofs });
      }

      if (action === 'memory-status' && req.method === 'GET') {
        const jobId = String(req.query?.jobId || '');
        if (!JOB.test(jobId)) throw new ClientError(400, 'Invalid memory job ID.');
        const job = await deps.memoryJobStatus(jobId);
        return send(res, 200, { status: job.status, blobId: job.blob_id || null, error: job.status === 'failed' ? job.error : null });
      }

      if (action === 'transaction' && req.method === 'GET') {
        const digest = String(req.query?.digest || '');
        if (!DIGEST.test(digest)) throw new ClientError(400, 'Invalid Sui transaction digest.');
        const tx = await deps.getTransaction(digest);
        return send(res, 200, { digest, status: tx.effects.status.status, checkpoint: tx.checkpoint, timestampMs: tx.timestampMs, balanceChanges: tx.balanceChanges });
      }

      return send(res, 404, { error: 'Unknown API action.' });
    } catch (error) {
      if (error instanceof ClientError) {
        if (action === 'remember' || action === 'reasons') log(`[${action}] ${error.status}: ${error.message}`);
        return send(res, error.status, { error: error.message });
      }
      if (action === 'remember' || action === 'reasons') log(`[${action}] 502: ${scrub(error)}`);
      return send(res, 502, { error: scrub(error) });
    }
  };
}
