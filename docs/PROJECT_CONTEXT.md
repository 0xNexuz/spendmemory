# Project Context

## Project Identity

- **Project:** SpendMemory, a human-controlled Sui payment review assistant whose recommendations learn from Walrus Memory.
- **Repository:** Local Git repository in this folder; no remote configured.
- **Stage:** DEVELOPMENT.
- **Status:** Live Tatum and Walrus Mainnet integrations VERIFIED; one fictional product decision changed a later recommendation after restart. Public replay build prepared for GitHub and Vercel.
- **Updated:** 2026-10-28.

## Git State

- **Branch/HEAD:** `master`; local root commit exists (see `git log -1`).
- **Working tree:** Check `git status` for current changes. `node_modules`, `.env`, `.local`, and `dist` are ignored.
- **Last verified milestone:** Product demo went from `review` to `decline` after restart through a confirmed, recalled Mainnet decision memory on 2026-10-28.

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

- **Stack:** Vite/React frontend; local Express API; Walrus Memory TypeScript SDK; Tatum Sui GraphQL RPC; JSON file for local proposal state.
- **Control flow:** proposal → Tatum balance + Walrus recall → deterministic recommendation → human decision → Walrus write job → confirmed blob ID.
- **Trust assumptions:** Live API is local single operator only. No payment signing or wallet custody. Public production build renders a static evidence replay with no API, writes, or credentials.
- **Constraints:** Secrets via `.env`; Mainnet relayer only; exact structured memory matching; uncertain write locks instead of blind retry.

## Progress

- **Approved scope:** Build SpendMemory project. External deployment, publishing, costs, credentials, and submission still require user authorization/input.
- **Implemented:** Proposal form, live Tatum balance call path, Walrus recall path, deterministic policy, human decision write/confirm path with known-job reconciliation, transaction lookup, local history, responsive UI, setup docs.
- **Verified:** Tatum key is configured in ignored `.env`; Mainnet GraphQL balance and transaction reads succeeded on 2026-10-28. Live method discovery listed GraphQL only; JSON-RPC POST returned 404, so the app was migrated to GraphQL.
- **Verified:** Walrus Mainnet credentials are configured in ignored `.env`. Health and recall succeeded. A single integration-check memory was confirmed and recalled in the separate `spendmemory-integration-check` namespace, blob ID `5lVVwlcm0n7S5vzohoc_GYZcREzQO0FV7mZ9IZdKPy4`. This is test data, not a product decision memory or submission-count evidence.
- **Verified:** User-provided wallet address initially returned 0 SUI through Tatum, so a public funded Mainnet address was used for both fictional demo proposals. A later recheck of the user's address returned 5.27027 SUI (5,270,270,000 MIST), independently matched by Tatum and Sui's public Mainnet GraphQL endpoint. A `DemoCloud subscription` / `software` / 0.02 SUI proposal initially returned `review`; a delegated `decline` decision produced confirmed Mainnet blob ID `VpDjzjIwtRW1UQJ8LOrUjUp2rbfV-RaIU36yB8DNSdg` (job `bfbf13d9-babe-4877-8cee-15a12d221523`). After a real server restart, the same proposal returned `decline`, with one matching recalled memory and the same blob ID. No payment was sent.
- **Count:** 1 confirmed product decision memory on Mainnet, explicitly fictional demo content; 9 more confirmed memories needed to reach the event minimum. Two useful local demo records remain (before and after); the timed-out local proposal was removed.
- **P0:** Add nine more purposeful decision memories through the app, preserving confirmed blob IDs and clear demo labeling. Recheck learning behavior after more writes.
- **P1:** Authenticated public deployment, blog, demo video, submission evidence.
- **Deployment preparation:** Production Vite build renders an interactive public replay of the confirmed before/after memory result; local development still renders the live app. The replay uses verified blob evidence and no secrets or write endpoint. Public milestone count is a manually maintained snapshot.

## Verification

| Date | Command/check | Result |
|---|---|---|
| 2026-10-20 | `npm test` | VERIFIED: 4 policy tests passed. |
| 2026-10-20 | `npm run build` | VERIFIED: TypeScript check and Vite bundle passed. |
| 2026-10-20 | Local API smoke | VERIFIED: status reports both integrations unconfigured; proposal evaluation conservatively reports unverified balance/recall. Disposable local proposal removed. |
| 2026-10-20 | Browser render | VERIFIED: app loaded at `http://127.0.0.1:5173/`, controls and missing-credential state rendered. |
| 2026-10-28 | Tatum Mainnet GraphQL | VERIFIED: balance query returned 0 MIST for a public example address; transaction query returned SUCCESS and a checkpoint for a live digest. JSON-RPC POST returned 404. |
| 2026-10-28 | `npm test` and `npm run build` | VERIFIED: 4 policy tests passed; TypeScript and Vite production build passed with the runner config loader. |
| 2026-10-28 | Walrus Mainnet SDK | VERIFIED: health and empty recall succeeded; isolated test write job `a462c967-d77e-4765-8d00-de35702dce77` confirmed blob ID `5lVVwlcm0n7S5vzohoc_GYZcREzQO0FV7mZ9IZdKPy4`, and recall returned the same blob. App has 0 confirmed decision memories. |
| 2026-10-28 | Product Mainnet loop | VERIFIED: Tatum balance and Walrus recall in first proposal; confirmed decision write; server restart; second proposal changed from `review` to `decline` with the confirmed blob recalled. Initial SDK `/version` preflight timed out at the 5s default; increasing `preflightTimeoutMs` to 20s resolved it. |
| 2026-10-28 | `npm test` and `npm run build` | VERIFIED after timeout adjustment: 4 policy tests passed; TypeScript and Vite build passed. |
| 2026-10-28 | User wallet balance recheck | VERIFIED: Tatum and Sui public Mainnet GraphQL both returned 5,270,270,000 MIST (5.27027 SUI), all in coin balance. This supersedes the earlier 0 SUI observation. |
| 2026-10-28 | Public replay build | VERIFIED: 4 policy tests passed and `npm run build` produced a Vite production bundle. Browser rendering and hosted deployment remain unverified. |

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

- Publish the authorized GitHub repository and Vercel public replay, verify the hosted page, then grow from one to at least ten confirmed Mainnet product decisions with honest demo labeling. Prepare video and blog separately; submission remains a separate authorization boundary.
