import { createHandler } from '../server/hosted.js';
import { beginRemember, getBalance, getTransaction, hasMemory, hasTatum, listProductMemories, memoryJobStatus, recall, recallByProposal } from '../server/integrations.js';

export default createHandler({
  hasMemory,
  hasTatum,
  getBalance,
  getTransaction,
  recall,
  recallByProposal,
  beginRemember,
  listProductMemories,
  memoryJobStatus,
  signingSecret: process.env.APP_SIGNING_SECRET,
  maxReviewSui: process.env.MAX_REVIEW_SUI || '25',
});
