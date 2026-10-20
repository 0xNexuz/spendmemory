import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, parseSuiToMist, relevantMemories } from '../server/policy.js';

const proposal = { merchant: 'Northwind Tools', category: 'software', amountMist: String(parseSuiToMist('3')) };
const cap = parseSuiToMist('25');

test('amount parsing uses exact MIST precision', () => {
  assert.equal(parseSuiToMist('1.000000001'), 1000000001n);
  assert.throws(() => parseSuiToMist('1.0000000001'));
  assert.throws(() => parseSuiToMist('0'));
});

test('chain balance is a hard stop even with approving memories', () => {
  const result = evaluatePolicy({ proposal, balanceMist: '1', memories: [{ decision: 'approve' }], maxReviewMist: cap });
  assert.equal(result.recommendation, 'decline');
});

test('matching Walrus decline changes the later recommendation', () => {
  const noMemory = evaluatePolicy({ proposal, balanceMist: String(parseSuiToMist('10')), memories: [], maxReviewMist: cap });
  const learned = evaluatePolicy({ proposal, balanceMist: String(parseSuiToMist('10')), memories: [{ decision: 'decline' }], maxReviewMist: cap });
  assert.equal(noMemory.recommendation, 'review');
  assert.equal(learned.recommendation, 'decline');
});

test('only exact merchant and category memories influence policy', () => {
  const results = [
    { text: JSON.stringify({ app: 'spendmemory', v: 1, merchant: 'Northwind Tools', category: 'software', decision: 'decline' }), blob_id: 'good' },
    { text: JSON.stringify({ app: 'spendmemory', v: 1, merchant: 'Other Tools', category: 'software', decision: 'decline' }), blob_id: 'wrong' },
  ];
  assert.deepEqual(relevantMemories(results, proposal).map((m) => m.blobId), ['good']);
});
