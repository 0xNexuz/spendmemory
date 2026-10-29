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
  signingSecret: process.env.APP_SIGNING_SECRET,
  maxReviewSui: process.env.MAX_REVIEW_SUI || '25',
});
