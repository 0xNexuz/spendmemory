import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { createHandler } from '../server/hosted.js';
import { beginRemember, getBalance, getTransaction, hasMemory, hasTatum, listProductMemories, memoryJobStatus, recall, recallByProposal, recallRecent } from '../server/integrations.js';

export default createHandler({
  hasMemory,
  hasTatum,
  getBalance,
  getTransaction,
  recall,
  recallByProposal,
  recallRecent,
  beginRemember,
  listProductMemories,
  memoryJobStatus,
  // Throws unless the signature over these exact bytes comes from this address (zkLogin wallets are checked on Mainnet).
  verifySignature: async (bytes, signature, address) => { await verifyPersonalMessageSignature(bytes, signature, { address }); },
  signingSecret: process.env.APP_SIGNING_SECRET,
  maxReviewSui: process.env.MAX_REVIEW_SUI || '25',
});
