export function parseSuiToMist(value) {
  const input = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,9})?$/.test(input)) {
    throw new Error('Amount must be a positive SUI value with up to 9 decimal places.');
  }
  const [whole, fraction = ''] = input.split('.');
  const mist = BigInt(whole) * 1_000_000_000n + BigInt((fraction + '000000000').slice(0, 9));
  if (mist <= 0n) throw new Error('Amount must be greater than zero.');
  return mist;
}

export function mistToSui(value) {
  const mist = BigInt(value);
  const whole = mist / 1_000_000_000n;
  const fraction = String(mist % 1_000_000_000n).padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function normalizeLabel(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function relevantMemories(results, proposal) {
  const merchant = normalizeLabel(proposal.merchant);
  const category = normalizeLabel(proposal.category);
  return results.flatMap((item) => {
    try {
      const memory = JSON.parse(item.text);
      if (memory.app !== 'spendmemory' || memory.v !== 1) return [];
      if (normalizeLabel(memory.merchant) !== merchant || normalizeLabel(memory.category) !== category) return [];
      if (!['approve', 'decline'].includes(memory.decision)) return [];
      return [{ ...memory, blobId: item.blob_id, distance: item.distance }];
    } catch {
      return [];
    }
  });
}

export function evaluatePolicy({ proposal, balanceMist, memories, maxReviewMist }) {
  const amount = BigInt(proposal.amountMist);
  const balance = balanceMist == null ? null : BigInt(balanceMist);
  const priorDeclines = memories.filter((m) => m.decision === 'decline').length;
  const priorApprovals = memories.filter((m) => m.decision === 'approve').length;
  const reasons = [];
  let recommendation = 'review';

  if (balance == null) reasons.push('Live Sui balance has not been verified.');
  else if (balance < amount) {
    recommendation = 'decline';
    reasons.push('The proposed amount exceeds the current Sui balance.');
  } else reasons.push(`Live Sui balance covers this amount (${mistToSui(balance)} SUI).`);

  if (amount > BigInt(maxReviewMist)) {
    if (recommendation !== 'decline') recommendation = 'review';
    reasons.push(`Above the ${mistToSui(maxReviewMist)} SUI review threshold.`);
  } else if (priorDeclines > priorApprovals && recommendation !== 'decline') {
    recommendation = 'decline';
    reasons.push(`${priorDeclines} matching past decline${priorDeclines === 1 ? '' : 's'} recalled from Walrus Memory.`);
  } else if (priorApprovals > 0 && priorDeclines === 0 && balance != null && balance >= amount) {
    recommendation = 'consider';
    reasons.push(`${priorApprovals} matching past approval${priorApprovals === 1 ? '' : 's'} recalled from Walrus Memory.`);
  } else if (memories.length === 0) {
    reasons.push('No matching confirmed memory was recalled.');
  }

  return { recommendation, reasons, priorApprovals, priorDeclines };
}
