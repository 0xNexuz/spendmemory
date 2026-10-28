import { MemWal } from '@mysten-incubation/memwal';

const GRAPHQL_URL = 'https://sui-mainnet.gateway.tatum.io/graphql';

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
    'query Transaction($digest: String!) { transaction(digest: $digest) { digest effects { status timestamp checkpoint { sequenceNumber } balanceChanges { nodes { amount owner { address } } } } } }',
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
