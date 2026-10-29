export function saveMessage(input: { walletAddress: string; proposalId: string; decision: 'approve' | 'decline'; reason: string; expiresAt: number }): Promise<string>;
