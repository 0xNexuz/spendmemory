export function saveMessage(input: { walletAddress: string; proposalId: string; decision: 'approve' | 'decline'; reason: string; expiresAt: number }): Promise<string>;
export function viewMessage(input: { walletAddress: string; proposalId: string; expiresAt: number }): string;
