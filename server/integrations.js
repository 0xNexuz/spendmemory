import { MemWal } from '@mysten-incubation/memwal';

const GRAPHQL_URL = 'https://sui-mainnet.gateway.tatum.io/graphql';

export function hasTatum() { return Boolean(process.env.TATUM_API_KEY); }
export function hasMemory() { return Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID); }

function memoryClient(namespace) {
  if (!hasMemory()) throw new Error('Walrus Memory credentials are not configured.');
  const url = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz';
  if (url !== 'https://relayer.memory.walrus.xyz') throw new Error('This build only permits the Walrus Memory Mainnet relayer.');
  return MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: url,
    namespace: namespace || process.env.MEMWAL_NAMESPACE || 'spendmemory-mainnet',
    preflightTimeoutMs: 20000,
  });
}

async function tatumQuery(query, variables) {
  if (!hasTatum()) throw new Error('Tatum API key is not configured.');
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.TATUM_API_KEY },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Tatum GraphQL returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.errors?.length) throw new Error(`Tatum GraphQL: ${data.errors[0].message || 'request failed'}`);
  return data.data;
}

export async function getBalance(address) {
  const data = await tatumQuery(
    'query Balance($address: SuiAddress!) { address(address: $address) { balance(coinType: "0x2::sui::SUI") { totalBalance } } }',
    { address },
  );
  if (!data.address) throw new Error('Tatum GraphQL did not return the Sui address.');
  return String(data.address.balance?.totalBalance ?? '0');
}

export async function getTransaction(digest) {
  const data = await tatumQuery(
    'query Transaction($digest: String!) { transaction(digest: $digest) { digest effects { status timestamp checkpoint { sequenceNumber } balanceChanges { nodes { amount coinType { repr } owner { address } } } } } }',
    { digest },
  );
  if (!data.transaction) throw new Error('Transaction not found on Sui Mainnet.');
  const effects = data.transaction.effects;
  return {
    effects: { status: { status: effects?.status || 'unknown' } },
    checkpoint: effects?.checkpoint?.sequenceNumber ?? null,
    timestampMs: effects?.timestamp ? String(Date.parse(effects.timestamp)) : null,
    balanceChanges: effects?.balanceChanges?.nodes || [],
  };
}

// The relayer caps recall at 100 results. The public namespace is capped at 100 memories,
// so every memory in it is a candidate for exact merchant and category matching.
const RECALL_LIMIT = 100;

export async function recall(proposal, namespace) {
  const client = memoryClient(namespace);
  const response = await client.recall({ query: `SpendMemory payment decision for merchant ${proposal.merchant} in category ${proposal.category}${proposal.walletKey ? ` for wallet ${proposal.walletKey}` : ''}`, limit: RECALL_LIMIT });
  return response.results || [];
}

/** The most recent memories in a namespace, used to spot a proposal that already has a saved decision. */
export async function recallByProposal(proposal, namespace) {
  const client = memoryClient(namespace);
  const response = await client.recall({ query: `SpendMemory payment decision for merchant ${proposal.merchant} in category ${proposal.category}${proposal.walletKey ? ` for wallet ${proposal.walletKey}` : ''}`, limit: RECALL_LIMIT, sort: 'recent' });
  return response.results || [];
}

export async function beginRemember(decision, namespace, options = {}) {
  const client = memoryClient(namespace);
  if (options.idempotencyKey) {
    // rememberBulk takes an idempotency key, so a repeated request for the same proposal cannot create a second memory.
    const accepted = await client.rememberBulk([{ text: JSON.stringify(decision) }], { idempotencyKey: options.idempotencyKey });
    const jobId = accepted?.job_ids?.[0];
    if (!jobId) throw new Error('Walrus Memory did not return a write job ID.');
    return { job_id: jobId, status: accepted.status };
  }
  const response = await client.remember(JSON.stringify(decision));
  if (!response.job_id) throw new Error('Walrus Memory did not return a write job ID.');
  return response;
}

export async function finishRemember(jobId) {
  const client = memoryClient();
  const response = await client.waitForRememberJob(jobId);
  if (!response.blob_id) throw new Error('Walrus Memory did not return a confirmed blob ID.');
  return response;
}

export async function memoryJobStatus(jobId) {
  return memoryClient().getRememberStatus(jobId);
}

export async function listProductMemories(namespace = process.env.MEMWAL_NAMESPACE || 'spendmemory-mainnet') {
  const client = memoryClient(namespace);
  const memories = [];
  let cursor;
  do {
    const page = await client.listMemories({ cursor, namespace, limit: 100 });
    memories.push(...page.memories);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor && memories.length < 1000);
  return memories;
}
