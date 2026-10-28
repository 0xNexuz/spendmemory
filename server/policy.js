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

const SUI_COIN = /^0x0*2::sui::SUI$/;

/**
 * Checks a Sui transaction against a proposal: the wallet's SUI balance must go down,
 * and another address must receive exactly the proposed amount of SUI.
 */
export function reconcilePayment({ status, balanceChanges, walletAddress, amountMist }) {
  const wallet = String(walletAddress).toLowerCase();
  const amount = BigInt(amountMist);
  let walletChange = 0n;
  let recipient = null;
  let suiSeen = false;
  for (const change of balanceChanges || []) {
    if (!SUI_COIN.test(change?.coinType?.repr || '')) continue;
    suiSeen = true;
    let value;
    try { value = BigInt(change.amount); } catch { continue; }
    const owner = String(change?.owner?.address || '').toLowerCase();
    if (owner === wallet) walletChange += value;
    else if (value === amount && recipient === null) recipient = owner;
  }
  const succeeded = String(status).toUpperCase() === 'SUCCESS';
  const walletPaid = walletChange < 0n;
  return {
    checked: true,
    succeeded,
    walletPaid,
    recipient,
    walletChangeSui: walletChange === 0n ? '0' : `${walletChange < 0n ? '-' : ''}${mistToSui(walletChange < 0n ? -walletChange : walletChange)}`,
    suiSeen,
    matches: succeeded && walletPaid && recipient !== null,
  };
}

/** Adds the payment check to a policy result. A mismatch can only make the suggestion more cautious. */
export function applyPaymentCheck(result, payment, amountSui) {
  if (!payment) return result;
  const reasons = [...result.reasons];
  let recommendation = result.recommendation;
  if (!payment.checked) {
    reasons.push('The payment transaction could not be checked on Sui.');
    if (recommendation === 'consider') recommendation = 'review';
  } else if (payment.matches) {
    reasons.push(`Tatum confirmed this wallet paid exactly ${amountSui} SUI in a successful transaction.`);
  } else {
    reasons.push(payment.succeeded
      ? `The transaction does not show this wallet paying exactly ${amountSui} SUI.`
      : 'The payment transaction did not succeed on Sui.');
    if (recommendation === 'consider') recommendation = 'review';
  }
  return { ...result, recommendation, reasons };
}
