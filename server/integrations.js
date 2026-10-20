import { MemWal } from '@mysten-incubation/memwal';

const RPC_URL = 'https://sui-mainnet.gateway.tatum.io/';

export function hasTatum() { return Boolean(process.env.TATUM_API_KEY); }
export function hasMemory() { return Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID); }

function memoryClient() {
  if (!hasMemory()) throw new Error('Walrus Memory credentials are not configured.');
  const url = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz';
  if (url !== 'https://relayer.memory.walrus.xyz') throw new Error('This build only permits the Walrus Memory Mainnet relayer.');
  return MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: url,
    namespace: process.env.MEMWAL_NAMESPACE || 'spendmemory-mainnet',
  });
}

export async function tatumRpc(method, params) {
  if (!hasTatum()) throw new Error('Tatum API key is not configured.');
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.TATUM_API_KEY },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Tatum RPC returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(`Tatum RPC: ${data.error.message || 'request failed'}`);
  return data.result;
}

export async function getBalance(address) {
  const result = await tatumRpc('suix_getBalance', [address]);
  return String(result.totalBalance);
}

export async function getTransaction(digest) {
  return tatumRpc('sui_getTransactionBlock', [digest, { showEffects: true, showBalanceChanges: true, showInput: true }]);
}

export async function recall(proposal) {
  const client = memoryClient();
  const response = await client.recall({ query: `SpendMemory payment decision for merchant ${proposal.merchant} in category ${proposal.category}`, limit: 30 });
  return response.results || [];
}

export async function beginRemember(decision) {
  const client = memoryClient();
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
