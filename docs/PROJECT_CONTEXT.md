# Project Context

## Project Identity

- **Project:** SpendMemory, a human-controlled Sui payment review assistant whose recommendations learn from Walrus Memory.
- **Repository:** Local Git repository in this folder; no remote configured.
- **Stage:** DEVELOPMENT.
- **Status:** Local prototype VERIFIED; live integrations UNVERIFIED.
- **Updated:** 2026-10-20.

## Git State

- **Branch/HEAD:** `master`; local root commit exists (see `git log -1`).
- **Working tree:** Clean after context update is committed. `node_modules`, `.env`, `.local`, and `dist` are ignored.
- **Last verified milestone:** Local policy tests, frontend build, API smoke, and browser render passed on 2026-10-20.

## Hackathon Context

- **Competition:** [Total Recall](https://recall-tatum-walrus.vercel.app/), Walrus × Tatum.
- **Tracks:** Markets & Sports Prediction; Smart Agents for Real Life; Consumer Finance Apps. Primary target: Smart Agents for Real Life, with Consumer Finance fit.
- **Deadline:** 2026-11-10 17:00 UTC (18:00 Africa/Lagos).
- **Required:** Walrus Memory Mainnet writes, 10+ Mainnet memories, Tatum RPC for relevant onchain data, public repo, demo, published blog post.
- **Judging:** integration 30%, technical quality 30%, creativity 20%, presentation 20%.
- **Rules:** [Event rules](https://thewalrussessions.wal.app/tatum-total-recall/index.html). The landing page and rules disagree on one $500 special prize; confirm before optimizing for it.

## Strategic Decisions

- **Selected idea:** SpendMemory — APPROVED by user on 2026-10-20.
- **Why:** Clear before/after learning loop, Sui wallet and transaction context, reuse of builder strengths in agent policy and payment receipts.
- **Alternatives considered:** Forecast Jury, CrewBalance, TrustDesk, SourceScout.
- **Target user:** A person reviewing repeat Sui payments with a human approval policy.

## Architecture Decisions

- **Stack:** Vite/React frontend; local Express API; Walrus Memory TypeScript SDK; Tatum Sui JSON-RPC; JSON file for local proposal state.
- **Control flow:** proposal → Tatum balance + Walrus recall → deterministic recommendation → human decision → Walrus write job → confirmed blob ID.
- **Trust assumptions:** Local single operator only. No payment signing, wallet custody, or public authentication. Do not deploy publicly in this state.
- **Constraints:** Secrets via `.env`; Mainnet relayer only; exact structured memory matching; uncertain write locks instead of blind retry.

## Progress

- **Approved scope:** Build SpendMemory project. External deployment, publishing, costs, credentials, and submission still require user authorization/input.
- **Implemented:** Proposal form, live Tatum balance call path, Walrus recall path, deterministic policy, human decision write/confirm path with known-job reconciliation, transaction lookup, local history, responsive UI, setup docs.
- **Unverified:** Live Tatum and Walrus calls, Mainnet blob count, end-to-end learning across a real restart.
- **Blocked:** Live calls need the user's Tatum API key and Walrus Memory Mainnet delegate credentials. No credentials are stored in the repository.
- **P0:** Run live integration smoke after credentials; confirm 10 meaningful writes and restart behavior.
- **P1:** Authenticated public deployment, blog, demo video, submission evidence.

## Verification

| Date | Command/check | Result |
|---|---|---|
| 2026-10-20 | `npm test` | VERIFIED: 4 policy tests passed. |
| 2026-10-20 | `npm run build` | VERIFIED: TypeScript check and Vite bundle passed. |
| 2026-10-20 | Local API smoke | VERIFIED: status reports both integrations unconfigured; proposal evaluation conservatively reports unverified balance/recall. Disposable local proposal removed. |
| 2026-10-20 | Browser render | VERIFIED: app loaded at `http://127.0.0.1:5173/`, controls and missing-credential state rendered. |

## Decision Log

### 2026-10-20 — SpendMemory approved

- **Decision:** Implement the recommended SpendMemory direction.
- **Reason:** User approval after event discovery and ranked concepts.
- **Status:** APPROVED.

### 2026-10-20 — Human-controlled prototype

- **Decision:** Integrate live reads and memory writes without sending payments. Keep the first build local until authentication and persistence are ready.
- **Reason:** Demonstrates sponsor integrations and visible learning while preserving the human payment boundary.
- **Status:** APPROVED within implementation scope.

## Next Action

- Perform real Mainnet integration checks when credentials are available. Deployment, publication, and submission are separate authorization boundaries.
