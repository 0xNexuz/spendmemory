import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MemWal } from '@mysten-incubation/memwal';

const target = 50;
const namespace = process.env.MEMWAL_NAMESPACE || 'spendmemory-mainnet';
const manifestPath = resolve('.local', 'seed-50.json');
const groups = [
  ['CloudCart', 'software', 'decline', ['Unrecognized cloud add-on; verify the account owner first.', 'The renewal was not requested; review the invoice before paying.', 'A duplicate plan appears in the subscription list; avoid a second charge.', 'The service is inactive this month; pause this recurring charge.', 'The vendor name differs from the approved invoice; investigate.']],
  ['TransitPass', 'transport', 'approve', ['Monthly transit pass matches the planned commute budget.', 'The fare is within the agreed travel allowance.', 'This renewal keeps an active commute pass available.', 'The charge matches the expected transit schedule.', 'A verified transit pass is needed for this week.']],
  ['MarketBasket', 'groceries', 'approve', ['Weekly essentials are within the household food budget.', 'The basket is a planned grocery purchase.', 'Food staples were included in this week’s budget.', 'This purchase replaces an earlier grocery trip, not an extra one.', 'The amount is below the planned groceries limit.']],
  ['MysteryMint', 'collectibles', 'decline', ['Unknown mint link; verify the project before spending.', 'The asset has no independent provenance check.', 'A time-pressure promotion is not a sufficient purchase reason.', 'The mint address has not been reviewed.', 'This speculative collectible is outside the agreed budget.']],
  ['DevDesk', 'work tools', 'approve', ['The tool is used by the active development project.', 'This seat renewal matches the approved work plan.', 'The amount is within the work tools allowance.', 'The subscription supports the current release workflow.', 'The vendor and price match the expected software invoice.']],
  ['GameBoost', 'entertainment', 'decline', ['An impulse add-on exceeds the entertainment plan.', 'The purchase duplicates content already owned.', 'The promotion is not part of this month’s budget.', 'The extra item has no planned use.', 'Hold this optional purchase for a later review.']],
  ['CommunityAid', 'donations', 'approve', ['The charity is on the planned monthly giving list.', 'The amount matches the agreed donation budget.', 'The recipient has already been reviewed for this campaign.', 'This recurring gift fits the current giving plan.', 'The donation supports an approved community program.']],
  ['FitnessLoop', 'wellness', 'decline', ['The subscription is unused; cancel before renewing.', 'The plan duplicates an existing fitness membership.', 'The renewal price increased without approval.', 'Pause the plan while the account is inactive.', 'A yearly commitment needs a separate review.']],
  ['StudyShelf', 'education', 'approve', ['The course supports the current learning goal.', 'The purchase fits the education allowance.', 'This resource is on the planned reading list.', 'The subscription is needed for an active course.', 'The price matches the approved study materials budget.']],
];

function buildPlan() {
  const base = new Date().toISOString();
  const plan = [];
  for (const [merchant, category, decision, reasons] of groups) {
    reasons.forEach((reason, index) => plan.push({ app: 'spendmemory', v: 1, source: 'demo-seed', fictional: true, merchant: merchant.toLowerCase(), category, amountSui: (0.01 + index * 0.005).toFixed(3), decision, reason: `Fictional demo decision: ${reason}`, createdAt: base, proposalId: `demo-seed-${merchant.toLowerCase()}-${index + 1}` }));
  }
  ['Unrecognized extra seat; verify the team roster.', 'The invoice duplicates an active plan.', 'The upgrade was not requested by the account owner.', 'Hold the recurring charge until the vendor confirms it.'].forEach((reason, index) => plan.push({ app: 'spendmemory', v: 1, source: 'demo-seed', fictional: true, merchant: 'democloud subscription', category: 'software', amountSui: (0.02 + index * 0.005).toFixed(3), decision: 'decline', reason: `Fictional demo decision: ${reason}`, createdAt: base, proposalId: `demo-seed-democloud-${index + 1}` }));
  return plan;
}

async function save(manifest) {
  await mkdir(resolve('.local'), { recursive: true });
  const temp = `${manifestPath}.tmp`;
  await writeFile(temp, JSON.stringify(manifest, null, 2));
  await rename(temp, manifestPath);
}

async function list(client) {
  const all = [];
  let cursor;
  do { const page = await client.listMemories({ cursor, namespace, limit: 100 }); all.push(...page.memories); cursor = page.has_more ? page.next_cursor : undefined; } while (cursor);
  return all;
}

if (!process.argv.includes('--execute')) {
  console.log(`Dry run: ${buildPlan().length} explicitly fictional decisions in ${namespace}; target ${target}. Pass --execute to submit.`);
  process.exit(0);
}
if (!process.env.MEMWAL_PRIVATE_KEY || !process.env.MEMWAL_ACCOUNT_ID) throw new Error('Walrus Mainnet credentials are required.');
const client = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: 'https://relayer.memory.walrus.xyz', namespace, preflightTimeoutMs: 20000 });
let manifest;
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; manifest = { target, namespace, plan: buildPlan(), batches: {} }; await save(manifest); }
if (manifest.target !== target || manifest.namespace !== namespace || manifest.plan.length !== 49) throw new Error('Seed manifest does not match this plan.');
const initial = await list(client);
console.log(`Starting Mainnet product memory count: ${initial.length}`);
if (initial.length > target) throw new Error('Product namespace already exceeds target; no seed writes submitted.');
for (let start = 0; start < manifest.plan.length; start += 10) {
  const key = String(start / 10);
  const items = manifest.plan.slice(start, start + 10).map(memory => ({ text: JSON.stringify(memory) }));
  let batch = manifest.batches[key];
  if (!batch) {
    batch = { state: 'submitting', start, size: items.length };
    manifest.batches[key] = batch;
    await save(manifest);
    const hash = createHash('sha256').update(JSON.stringify(items)).digest('hex');
    const accepted = await client.rememberBulk(items, { idempotencyKey: `spendmemory-seed-${hash}` });
    batch.state = 'accepted'; batch.jobIds = accepted.job_ids;
    await save(manifest);
    console.log(`Batch ${key}: accepted ${batch.jobIds.length} jobs`);
  }
  if (!batch.jobIds) throw new Error(`Batch ${key} submission status uncertain. Inspect relayer and manifest before any retry.`);
  const results = await client.waitForRememberJobs(batch.jobIds, undefined, { timeoutMs: 180000 });
  batch.results = results.results;
  batch.state = results.succeeded === items.length ? 'done' : 'needs-review';
  await save(manifest);
  console.log(`Batch ${key}: confirmed ${results.succeeded}/${items.length}`);
  if (batch.state !== 'done') throw new Error(`Batch ${key} has unfinished writes. Resume using saved job IDs; do not resubmit.`);
}
const final = await list(client);
const blobs = new Set(final.map(memory => memory.blob_id));
const expected = Object.values(manifest.batches).flatMap(batch => batch.results.map(result => result.blob_id));
console.log(`Final Mainnet product namespace count: ${final.length}`);
console.log(`Seed blobs listed independently: ${expected.filter(id => blobs.has(id)).length}/${expected.length}`);
if (final.length !== target || expected.some(id => !blobs.has(id))) process.exitCode = 2;
