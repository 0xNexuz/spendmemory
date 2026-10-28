# SpendMemory

A Sui payment review demo for the [Walrus × Tatum Total Recall hackathon](https://recall-tatum-walrus.vercel.app/). It reads a Sui wallet balance through Tatum RPC, recalls matching past decisions from Walrus Memory, and gives a human a review brief. A human decision can be stored on Walrus Mainnet and confirmed by its blob ID. The app **does not send payments**.

- [Live public app](https://spendmemory.vercel.app/) on Vercel; [evidence replay](https://spendmemory.vercel.app/?replay=1)
- [Public source repository](https://github.com/0xNexuz/spendmemory) on GitHub

## What the demo proves

1. Review a proposal for a Sui wallet and payee. Tatum returns the live Mainnet SUI balance.
2. The first review has no matching memory, so it recommends manual review.
3. A person records an approval or decline with a specific reason. The server saves the Walrus Memory job ID and waits for a confirmed blob ID.
4. Restart the app and review a similar proposal. The app recalls the confirmed decision and visibly changes its recommendation.
5. The proof panel shows the confirmed blob ID. A separate lookup verifies an actual Sui transaction digest through Tatum when one is available.

The `spendmemory-mainnet` namespace has **50 confirmed Mainnet memories**: one original fictional demo decision and 49 additional clearly labeled fictional demo decisions. Each of the 49 seed jobs returned a blob ID and the 49 blobs were independently listed through the Walrus Memory SDK. The separate integration-check namespace is excluded. These are real Mainnet writes containing synthetic scenarios, not 50 independent users. The hosted counter reads the namespace live.

## Run locally

Requires Node.js 20.19+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`. Add your own `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, and `MEMWAL_ACCOUNT_ID` to `.env` for live features. Create the Mainnet Walrus account and delegate key at [memory.walrus.xyz](https://memory.walrus.xyz/). The key stays server-side. The application deliberately accepts only the [Mainnet relayer](https://docs.wal.app/walrus-memory/getting-started/choose-your-path), so a testnet write cannot be mistaken for hackathon proof.

The dev API binds to `127.0.0.1:8787` and Vite proxies `/api` to it. Its proposals are stored in ignored `.local/data.json` for one local operator. The production Vercel app uses a serverless API and stores proposal history in each visitor's browser; confirmed decisions are shared in Walrus. The user chose open writes for visitors. Server credentials remain in Vercel secrets. The public API checks input lengths and allows writes while the confirmed namespace count is below 100; this count check is not an atomic quota or abuse defense.

## Scripts

```powershell
npm test       # exact amount and policy checks
npm run build  # typecheck and production frontend bundle
npm run dev    # local API and frontend
```

## Integration design

- **Tatum:** Sui GraphQL RPC reads wallet SUI balance and transaction effects at `https://sui-mainnet.gateway.tatum.io/graphql` with a server-side `x-api-key` header. The former JSON-RPC endpoint returned HTTP 404 in a live check on 2026-10-28. A balance read is displayed as unverified if the key is absent or the call fails.
- **Walrus Memory:** the `@mysten-incubation/memwal` SDK recalls decisions by merchant and category; only exact matching structured memories can affect a recommendation. A write job must return a blob ID before a decision is shown as confirmed.
- **Policy:** insufficient live balance is a hard stop. The configurable amount threshold requires review. Recalled approvals can suggest considering approval, but never authorize payment. A matching history of declines changes the suggestion to decline or investigate.
- **Write safety:** a decision moves to `pending_memory` before the remote write. When a job ID is received, the UI can check that job again after a timeout or restart. If the initial request's result is uncertain, the proposal remains locked until the operator checks the Walrus dashboard; a blind retry could create duplicate Mainnet memories.

## Submission work remaining

- A separate test namespace passed a confirmed Mainnet write and recall on 2026-10-28; it is not counted as a product decision. Tatum Mainnet balance and transaction reads were also verified. The original fictional product decision changed a matching proposal from `review` to `decline` after restart. The product namespace now has 50 confirmed Mainnet memories, including 49 labeled fictional seed decisions.
- Verify the hosted evaluation and write flow after deployment; preserve confirmed blob IDs.
- Publish a blog post and record a 2–3 minute demo video.
- Confirm the event's special prize discrepancy with the organizers: the event page lists agent payments while the rules list a mystery bounty.

Submission has not been completed.
