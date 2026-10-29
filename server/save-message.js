// Shared by the browser and the server, so both build the exact same text to sign.

async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The message a wallet signs to save one decision. It names the wallet, the proposal and the decision, and moves no funds. */
export async function saveMessage({ walletAddress, proposalId, decision, reason, expiresAt }) {
  return [
    'SpendMemory: save this decision to Walrus Memory.',
    '',
    `Wallet: ${String(walletAddress).trim().toLowerCase()}`,
    `Proposal: ${proposalId}`,
    `Decision: ${decision}`,
    `Reason SHA-256: ${await sha256Hex(String(reason).trim())}`,
    `Valid until: ${new Date(expiresAt).toISOString()}`,
    '',
    'Signing only saves a memory. It does not move funds or approve a transaction.',
  ].join('\n');
}

/** The message a wallet signs to read back its own saved reasons for one review. It changes nothing. */
export function viewMessage({ walletAddress, proposalId, expiresAt }) {
  return [
    'SpendMemory: show my saved reasons.',
    '',
    `Wallet: ${String(walletAddress).trim().toLowerCase()}`,
    `Proposal: ${proposalId}`,
    `Valid until: ${new Date(expiresAt).toISOString()}`,
    '',
    'Signing only reveals your own notes to you. It does not save anything or move funds.',
  ].join('\n');
}
