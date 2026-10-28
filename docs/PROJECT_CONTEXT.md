# Project Context

## Project Identity

- **Project:** SpendMemory, a human-controlled Sui payment review assistant whose recommendations learn from Walrus Memory.
- **Repository:** Local Git repository in this folder; `origin` is the public [GitHub repository](https://github.com/0xNexuz/spendmemory).
- **Stage:** SUBMISSION_PREPARATION.
- **Status:** Live Tatum and Walrus Mainnet integrations VERIFIED; 51 confirmed product-namespace memories (all fictional demo scenarios, 49 seeded in batches). Public GitHub repo and Vercel live app deployed; hosted evaluate, write, job confirmation, and count verified anonymously.
- **Updated:** 2026-10-28.

## Git State

- **Branch/HEAD:** `master` tracks `origin/master`; verify current HEAD with `git log -1` and remote with `gh api` after each push.
- **Working tree:** Check `git status` for current changes. `node_modules`, `.env`, `.local`, and `dist` are ignored.
- **Last verified milestone:** Vercel hosted review flow confirmed a fictional decision blob `M0Xo9ZQKokoCeIxxzh3ZOHC6QlJXGgpuXBCJhL4nKsI` and live namespace count 51 on 2026-10-28. The previous 49 seed blobs were independently listed through the SDK.

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

- **Stack:** Vite/React frontend; local Express API and Vercel serverless API; Walrus Memory TypeScript SDK; Tatum Sui GraphQL RPC; JSON file for local proposal state and browser storage for hosted proposals.
- **Control flow:** proposal → Tatum balance + Walrus recall → deterministic recommendation → human decision → Walrus write job → confirmed blob ID.
- **Trust assumptions:** No payment signing or wallet custody. User chose public, unauthenticated hosted writes. Server secrets remain in Vercel. Hosted proposal history is browser local and confirmed decisions share one Walrus account. Input limits and a 100-confirmed-memory check bound normal use, but the check is not atomic and does not prevent abuse or replay under concurrency.
- **Constraints:** Secrets via `.env`; Mainnet relayer only; exact structured memory matching; uncertain write locks instead of blind retry.

## Progress

- **Approved scope:** Build SpendMemory project. External deployment, publishing, costs, credentials, and submission still require user authorization/input.
- **Implemented:** Notebook-style frontend redesign with generated artwork (pending review on its own branch). Proposal form, live Tatum balance call path, Walrus recall path, deterministic policy, human decision write/confirm path with known-job reconciliation, transaction lookup, local history, responsive UI, setup docs.
- **Verified:** Tatum key is configured in ignored `.env`; Mainnet GraphQL balance and transaction reads succeeded on 2026-10-28. Live method discovery listed GraphQL only; JSON-RPC POST returned 404, so the app was migrated to GraphQL.
- **Verified:** Walrus Mainnet credentials are configured in ignored `.env`. Health and recall succeeded. A single integration-check memory was confirmed and recalled in the separate `spendmemory-integration-check` namespace, blob ID `5lVVwlcm0n7S5vzohoc_GYZcREzQO0FV7mZ9IZdKPy4`. This is test data, not a product decision memory or submission-count evidence.
- **Verified:** User-provided wallet address initially returned 0 SUI through Tatum, so a public funded Mainnet address was used for both fictional demo proposals. A later recheck of the user's address returned 5.27027 SUI (5,270,270,000 MIST), independently matched by Tatum and Sui's public Mainnet GraphQL endpoint. A `DemoCloud subscription` / `software` / 0.02 SUI proposal initially returned `review`; a delegated `decline` decision produced confirmed Mainnet blob ID `VpDjzjIwtRW1UQJ8LOrUjUp2rbfV-RaIU36yB8DNSdg` (job `bfbf13d9-babe-4877-8cee-15a12d221523`). After a real server restart, the same proposal returned `decline`, with one matching recalled memory and the same blob ID. No payment was sent.
- **Count:** 51 confirmed product-namespace memories on Mainnet: one original fictional demo decision, 49 fictional demo seeds, and one fictional hosted flow check. Zero remain to the user's technical 50-write goal. Per repository policy, seeded data is not counted as hackathon submission evidence; obtain eligible decisions separately. The integration check is excluded.
- **P0 (readiness audit 2026-10-28):** publish the blog post; record the 2–3 minute demo video; save at least 10 genuine (non-fictional) decisions through the hosted app, since this repository's own rule excludes seeded data as evidence; prepare the submission form, including the Walrus Memory delegate/agent ID that other entrants report the form asks for (UNVERIFIED against the official form).
- **P1 (readiness audit) progress 2026-10-28:** DONE in code: idempotent hosted writes (relayer idempotency key + already-saved check, 409), recall limit 100, 400s for client errors, optional Tatum payment verification carried into memory through the signed ticket, API tests (23 total passing), best-effort per-connection write limit (5 per 10 min). BLOCKED: Vercel firewall rate-limit rule; the firewall API returned 404 "config not found" for create, so it must be added in the Vercel dashboard (Firewall → custom rule: path `/api/route`, query `action=remember`, method POST, rate limit 5 per 600 s per IP, deny). UNVERIFIED end to end: the hosted write path now uses `rememberBulk` with an idempotency key (same call the seed script used on Mainnet) and the transaction query now selects `coinType { repr }` (valid per Sui GraphQL docs); previews have no secrets, so the first real hosted save is the end-to-end check. PROPOSED: primary track Consumer Finance Apps, since the policy is deterministic rather than an AI agent; user to decide.
- **Deployment:** Production at [spendmemory.vercel.app](https://spendmemory.vercel.app/) serves the live app (notebook redesign since commit `d806ac5`) with a Vercel serverless API; replay is at `/?replay=1`. Vercel project `xreyys-projects/spendmemory` is connected to GitHub. Anonymous production status, evaluation, job lookup, and a new hosted write were verified.

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
| 2026-10-28 | GitHub and Vercel | VERIFIED: public `0xNexuz/spendmemory` branch matched local commit `e9933c3` at first push; Vercel production deployment `dpl_9QdYRGFo1EYZ22ohNFoCueD62VaR` was READY at `https://spendmemory.vercel.app/`, anonymous HTTP 200; hosted JS contained the replay merchant and confirmed blob ID, with no `MEMWAL_PRIVATE_KEY` string. GitHub was connected to the Vercel project. |
| 2026-10-28 | 50 Mainnet product memories | VERIFIED: seeded 49 explicitly fictional demo decisions in batches of 10/10/10/10/9. Each job confirmed with a blob ID. SDK namespace listing returned 50 memories and included all 49 seed blobs; original confirmed demo memory makes 50. Integration-check namespace excluded. |
| 2026-10-28 | Hosted API local smoke | VERIFIED: serverless handler returned status 200 and evaluated a fictional proposal with Tatum and Walrus both verified and a signed proposal ticket. Hosted deployment remains to be checked. |
| 2026-10-28 | Vercel live flow | VERIFIED: Git-linked production deployment was Ready; anonymous status API returned 50 before hosted write, evaluation verified both Tatum and Walrus with 5 matching memories, hosted write job `03f1b650-ce50-44e4-bb8b-eef764dd1dc8` returned confirmed blob `M0Xo9ZQKokoCeIxxzh3ZOHC6QlJXGgpuXBCJhL4nKsI`, and status then returned 51. Homepage returned HTTP 200 with live UI bundle and no private-key variable string. |
| 2026-10-28 | Frontend redesign (branch `frontend-notebook-redesign`) | VERIFIED (build) / PARTIAL (fonts): notebook art direction and generated artwork added to the public replay and local workspace; workspace sidebar, sticky top bar and phone tab bar rebuilt with scroll-tracked sections, live counts and status chips; public page got a sticky section nav; backend untouched. Vercel preview `dpl_9o8L8z12XpU6xvoeGNYZQCCuRFw1` for the first commit built READY (tsc + vite). Production and dev bundles built with esbuild and rendered in headless Chromium at 1440px and 390px (no horizontal overflow, no page errors; replay toggle, clipping hover and copy controls exercised). `npm ci` could not reach the npm registry in that sandbox, so `npm test`, `tsc` and `vite build` were not run there; the Vercel preview build is the type and build check. Google Fonts were also unreachable, so Archivo/Reenie Beanie rendering is unverified locally. |
| 2026-10-28 | Redesign merged to production | VERIFIED: `master` fast-forwarded to `d806ac5` (redesign, restyled live app, new README). `npm test` passed 4/4. Vercel production deployment `dpl_8n8JvRMNDGg52RbGVyMzGHfEM83E` READY with `tsc --noEmit && vite build`; `spendmemory.vercel.app` served the new bundle (contains the new headings), `/art/head-5.webp` returned 200, and the bundle contained none of `MEMWAL_PRIVATE_KEY`, `TATUM_API_KEY`, `APP_SIGNING_SECRET` or `x-api-key`. |
| 2026-10-28 | Readiness audit evidence | VERIFIED through the deployed API: `status` returned `memoryCount` 51 and cap 100; `memory-status` for job `bfbf13d9-…` returned blob `VpDjzjIwtRW1UQJ8LOrUjUp2rbfV-RaIU36yB8DNSdg` and job `03f1b650-…` returned blob `M0Xo9ZQKokoCeIxxzh3ZOHC6QlJXGgpuXBCJhL4nKsI`. UNVERIFIED: official event pages and the Walrus aggregator were unreachable from the audit sandbox; deadline 2026-11-10 17:00 UTC matches another entrant's README. Conservative score 64/100; not submission-ready while blog, video and submission remain open. |
| 2026-10-28 | Hosted hardening (branch `hosted-hardening`) | VERIFIED locally: `node --test tests/*.test.js` 23/23 passed; disabling the duplicate check, the signature check or the write limit makes the matching tests fail. Vercel preview `dpl_3AHLaTZeZUymbp2Ec6aVdxuekUdC` built READY (tsc + vite). Preview API returns 503 because previews have no secrets, so hosted writes and the new Tatum query are verified only after production deploy. |
| 2026-10-28 | Hosted hardening in production | VERIFIED: master fast-forwarded to `dec5290`; production deployment `dpl_CLD9oiBQJCN8J6nt9ATPRknjHqEc` READY. Live `transaction` lookup with a well-formed unknown digest returned "Transaction not found on Sui Mainnet." (so Tatum accepted the new `coinType { repr }` query); `status` returned visitor 0 / demo 51 / cap 100; a malformed job ID returned 400. UNVERIFIED: hosted save through `rememberBulk` with an idempotency key, until the first real save. |

## Decision Log

### 2026-10-20 — SpendMemory approved

- **Decision:** Implement the recommended SpendMemory direction.
- **Reason:** User approval after event discovery and ranked concepts.
- **Status:** APPROVED.

### 2026-10-20 — Human-controlled prototype

- **Decision:** Integrate live reads and memory writes without sending payments. Keep the first build local until authentication and persistence are ready.
- **Reason:** Demonstrates sponsor integrations and visible learning while preserving the human payment boundary.
- **Status:** APPROVED within implementation scope.

### 2026-10-28 — Open hosted writes and 50 Mainnet memories

- **Decision:** User selected open writes for all visitors and requested 50 confirmed memories. Implement hosted browser-local proposals with serverless Tatum/Walrus access and seed fictional scenarios to the shared Mainnet namespace. Label synthetic content plainly.
- **Status:** 50-memory target VERIFIED and exceeded by one hosted flow check; hosted deployment VERIFIED.

### 2026-10-28 — Notebook redesign shipped

- **Decision:** User approved merging the frontend redesign (artwork merged from three references, new navigation, restyled live app) and a presentable README into `master`.
- **Status:** DEPLOYED to production; readiness audit recorded under Progress.

## Next Action

- Prepare video, blog, and eligible submission evidence. Fictional seed records document real Mainnet integration but are excluded as hackathon evidence by repository policy. Submission remains a separate authorization boundary.

### 2026-10-28 — Separate visitor decisions from demo memories

Approved by user. Hosted reads and writes now use spendmemory-user-decisions-v1; the existing spendmemory-mainnet namespace is retained for demo evidence. Status exposes separate visitor/demo/total counts. New decisions are user-reported, not independently verified purchases. Production build passed; hosted verification follows deployment.

### 2026-10-28 — Clarify test memory labels

User requested clearer judge-facing wording. UI calls the testing records "Test memories (confirmed Mainnet writes)" and explains that the writes and blob IDs are real, while decisions use example scenarios. Test memories remain excluded from visitor recommendations.
