import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { evaluatePolicy, mistToSui, normalizeLabel, parseSuiToMist, relevantMemories } from './policy.js';
import { beginRemember, finishRemember, getBalance, getTransaction, hasMemory, hasTatum, recall } from './integrations.js';
import { readStore, updateStore } from './store.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers.origin && !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(req.headers.origin)) {
    return res.status(403).json({ error: 'Only the local app may change data.' });
  }
  next();
});

const SUI_ADDRESS = /^0x[a-fA-F0-9]{64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const maxReviewMist = parseSuiToMist(process.env.MAX_REVIEW_SUI || '25');
const scrub = (error) => error instanceof Error ? error.message : 'Unknown error';

app.get('/api/status', async (_req, res) => {
  const store = await readStore();
  res.json({
    network: 'Sui Mainnet',
    tatumConfigured: hasTatum(),
    memoryConfigured: hasMemory(),
    confirmedWritesThisInstall: store.proposals.filter((p) => p.memory?.blobId).length,
    maxReviewSui: mistToSui(maxReviewMist),
  });
});

app.get('/api/proposals', async (_req, res) => {
  const store = await readStore();
  res.json({ proposals: [...store.proposals].reverse() });
});

app.post('/api/proposals', async (req, res) => {
  try {
    const merchant = String(req.body.merchant || '').trim();
    const category = String(req.body.category || '').trim();
    const walletAddress = String(req.body.walletAddress || '').trim();
    const amountMist = String(parseSuiToMist(req.body.amountSui));
    if (merchant.length < 2 || merchant.length > 80) throw new Error('Merchant label must be 2–80 characters.');
    if (category.length < 2 || category.length > 50) throw new Error('Category must be 2–50 characters.');
    if (!SUI_ADDRESS.test(walletAddress)) throw new Error('Enter a 0x-prefixed 64-character Sui wallet address.');

    const proposal = { id: randomUUID(), merchant, category, walletAddress, amountMist, amountSui: mistToSui(amountMist), createdAt: new Date().toISOString(), state: 'open' };
    let balanceMist = null;
    let chainError = null;
    let memoryError = null;
    let matches = [];
    if (hasTatum()) {
      try { balanceMist = await getBalance(walletAddress); }
      catch (error) { chainError = scrub(error); }
    }
    if (hasMemory()) {
      try { matches = relevantMemories(await recall(proposal), proposal); }
      catch (error) { memoryError = scrub(error); }
    }
    proposal.evaluation = {
      ...evaluatePolicy({ proposal, balanceMist, memories: matches, maxReviewMist }),
      balanceSui: balanceMist == null ? null : mistToSui(balanceMist),
      matchedMemories: matches.map(({ blobId, decision, reason, createdAt }) => ({ blobId, decision, reason, createdAt })),
      chainError,
      memoryError,
      chainVerified: balanceMist != null,
      memoryVerified: hasMemory() && memoryError == null,
    };
    await updateStore((store) => { store.proposals.push(proposal); });
    res.status(201).json({ proposal });
  } catch (error) { res.status(400).json({ error: scrub(error) }); }
});

app.post('/api/proposals/:id/decision', async (req, res) => {
  if (!hasMemory()) return res.status(503).json({ error: 'Configure Walrus Memory Mainnet credentials before saving a decision.' });
  const decision = String(req.body.decision || '');
  const reason = String(req.body.reason || '').trim();
  if (!['approve', 'decline'].includes(decision) || reason.length < 8 || reason.length > 500) {
    return res.status(400).json({ error: 'Choose approve or decline and give a reason of 8–500 characters.' });
  }
  let proposal;
  try {
    proposal = await updateStore((store) => {
      const found = store.proposals.find((p) => p.id === req.params.id);
      if (!found) throw new Error('Proposal not found.');
      if (found.state !== 'open') throw new Error('Decision already saved or pending. Review its state before retrying.');
      found.state = 'pending_memory';
      return structuredClone(found);
    });
  } catch (error) { return res.status(409).json({ error: scrub(error) }); }

  const memory = {
    app: 'spendmemory', v: 1, merchant: normalizeLabel(proposal.merchant),
    category: normalizeLabel(proposal.category), amountSui: proposal.amountSui,
    decision, reason, createdAt: new Date().toISOString(), proposalId: proposal.id,
  };
  try {
    const accepted = await beginRemember(memory);
    await updateStore((store) => {
      const found = store.proposals.find((p) => p.id === proposal.id);
      found.memoryJobId = accepted.job_id;
      found.decision = { decision, reason, at: memory.createdAt };
    });
    const stored = await finishRemember(accepted.job_id);
    res.json({ proposal: await confirmMemory(proposal.id, stored) });
  } catch (error) {
    // Keep pending to prevent an uncertain network result from creating a duplicate Mainnet write.
    res.status(502).json({ error: `Memory confirmation is pending: ${scrub(error)}. If a job ID was received, use Check write status.` });
  }
});

async function confirmMemory(id, stored) {
  return updateStore((store) => {
    const found = store.proposals.find((p) => p.id === id);
    found.state = 'decided';
    found.memory = { blobId: stored.blob_id, jobId: stored.job_id, owner: stored.owner, namespace: stored.namespace };
    return structuredClone(found);
  });
}

app.post('/api/proposals/:id/reconcile', async (req, res) => {
  const store = await readStore();
  const proposal = store.proposals.find((p) => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
  if (proposal.state !== 'pending_memory' || !proposal.memoryJobId) return res.status(409).json({ error: 'No known Walrus Memory job can be checked for this proposal.' });
  try {
    const stored = await finishRemember(proposal.memoryJobId);
    res.json({ proposal: await confirmMemory(proposal.id, stored) });
  } catch (error) { res.status(502).json({ error: `Memory job is not confirmed: ${scrub(error)}` }); }
});

app.get('/api/transactions/:digest', async (req, res) => {
  if (!DIGEST.test(req.params.digest)) return res.status(400).json({ error: 'Enter a valid Sui transaction digest.' });
  try {
    const result = await getTransaction(req.params.digest);
    res.json({ digest: req.params.digest, status: result.effects?.status?.status || 'unknown', checkpoint: result.checkpoint || null, timestampMs: result.timestampMs || null, balanceChanges: result.balanceChanges || [] });
  } catch (error) { res.status(502).json({ error: scrub(error) }); }
});

app.use((error, _req, res, _next) => res.status(400).json({ error: scrub(error) }));

const port = Number(process.env.PORT || 8787);
app.listen(port, '127.0.0.1', () => console.log(`SpendMemory API listening on http://127.0.0.1:${port}`));
