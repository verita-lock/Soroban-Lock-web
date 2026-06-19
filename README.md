# Soroban Lock Web

The frontend dashboard for **Soroban Lock** — an automated security scanner for [Soroban](https://soroban.stellar.org/) smart contracts on the **Stellar blockchain**.

Built with Next.js 14, TypeScript, and Tailwind CSS. Part of the [Verita Lock](https://github.com/verita-lock) ecosystem.

---

## Stellar Blockchain Integration

Soroban Lock is purpose-built for the **Stellar / Soroban** ecosystem. Here is how the frontend integrates with the blockchain:

### Freighter Wallet

[Freighter](https://freighter.app) is the official Stellar browser extension wallet. The dashboard integrates with it via `window.freighter`:

- Connect your Stellar account (G-address) directly from the header
- Automatically detects the active network (Mainnet / Testnet / Futurenet)
- Displays a live network badge so you always know which chain you are on
- Wallet state is used to pre-fill the connected account's context for future on-chain features (e.g. submitting scan results as a Soroban contract invocation)

```typescript
// lib/wallet.ts
import { connectFreighter, getFreighterNetwork } from '@/lib/wallet'

const publicKey = await connectFreighter()   // G-address
const network   = await getFreighterNetwork() // { name, networkPassphrase, horizonUrl, sorobanRpcUrl }
```

### Soroban Contract ID Scanning

Beyond pasting source code or a GitHub URL, users can scan a **deployed contract** directly by its Soroban contract ID (C-address):

1. Enter a C-address in the "Contract ID" tab of the scan input
2. The core API (`soroban-lock-core`) resolves the WASM bytecode via Soroban RPC
3. The WASM is decompiled and analyzed for vulnerabilities
4. Findings are returned and displayed in the results dashboard

```
CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM
```

### Horizon & Soroban RPC

`lib/stellar.ts` provides typed helpers for direct blockchain queries:

| Function | Description |
|---|---|
| `fetchContractInfo(contractId, network)` | Fetch contract metadata from Horizon REST API |
| `fetchContractWasm(contractId, network)` | Fetch WASM bytecode via `getContractWasm` RPC |
| `fetchContractCode(wasmHash, network)` | Fetch ledger entry via `getLedgerEntries` RPC |
| `checkNetworkHealth(network)` | Ping Horizon to verify connectivity |
| `isValidContractId(id)` | Validate C-address format |
| `isValidPublicKey(key)` | Validate G-address format |

### Supported Networks

| Network | Horizon | Soroban RPC |
|---|---|---|
| Mainnet | `horizon.stellar.org` | `mainnet.stellar.validationcloud.io` |
| Testnet | `horizon-testnet.stellar.org` | `soroban-testnet.stellar.org` |
| Futurenet | `horizon-futurenet.stellar.org` | `rpc-futurenet.stellar.org` |

Network configuration lives in `types/stellar.ts` and is automatically synced from the connected Freighter wallet.

---

## Features

- Paste contract source code, enter a GitHub repo URL, or scan by Soroban contract ID
- Connect Freighter wallet — live network detection (Mainnet / Testnet / Futurenet)
- Real-time scan via the Soroban Lock Core REST API
- Findings table with severity badges (High / Medium / Low)
- Expandable rows with full finding detail (function, file, line)
- Summary bar with per-severity counts
- Findings sorted High → Medium → Low
- Empty state for clean contracts
- Dark mode by default, fully responsive, keyboard accessible

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Wallet | Freighter (Stellar browser extension) |
| Blockchain | Stellar Horizon REST API + Soroban RPC |
| API | Axum REST (soroban-lock-core) |

## Getting Started

```bash
# Install dependencies
npm install

# Set the API URL (defaults to http://localhost:3001)
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Install [Freighter](https://freighter.app) in your browser to enable wallet features.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Base URL for soroban-lock-core |
| `API_SECRET_KEY` | *(unset)* | Shared secret for internal API routes (see below) |
| `KV_REST_API_URL` | *(unset)* | Vercel KV REST endpoint for persistent storage |
| `KV_REST_API_TOKEN` | *(unset)* | Vercel KV REST auth token |

Copy `.env.example` to `.env.local` and fill in the values.

## Internal API Authentication

`POST/GET /api/results` and `POST/GET /api/webhook` are internal routes used to share scan results across page navigations and deliver webhook payloads.

When `API_SECRET_KEY` is set, every request to these routes must include:

```
Authorization: Bearer <API_SECRET_KEY>
```

Requests without a valid token receive `401 Unauthorized`. Leave `API_SECRET_KEY` unset in local development to bypass authentication.

## Persistent Storage (Vercel KV)

By default both routes use an in-memory store that is wiped on every cold start. To survive deployments, connect a [Vercel KV](https://vercel.com/docs/storage/vercel-kv) database and set `KV_REST_API_URL` + `KV_REST_API_TOKEN`. The routes detect these variables at runtime and switch to KV automatically — no code changes needed.

Results are stored with a 30-day TTL; webhook tokens expire after 1 hour.

## API Contract

The app calls `POST /scan` on the core API:

**Request**
```json
{ "source": "<contract source, github url, or contract ID>" }
```

**Response**
```json
{
  "findings": [
    {
      "check_name": "unchecked-auth",
      "severity": "High",
      "file_path": "src/lib.rs",
      "line": 42,
      "function_name": "transfer",
      "description": "Authorization is not verified before executing privileged operation."
    }
  ]
}
```

## Project Structure

```
app/
  page.tsx            # Landing page — scan input + wallet connect
  results/
    page.tsx          # Results page — findings table + summary
  layout.tsx          # Root layout + metadata
  loading.tsx         # Global loading spinner
  not-found.tsx       # 404 page
components/
  ScanInput.tsx       # Code / GitHub URL / Contract ID tabs + scan button
  FindingsTable.tsx   # Expandable findings table
  FindingCard.tsx     # Expanded finding detail card
  SeverityBadge.tsx   # High / Medium / Low colored pill
  EmptyState.tsx      # Clean contract illustration
  WalletConnect.tsx   # Freighter wallet connect button
  NetworkBadge.tsx    # Stellar network indicator pill
lib/
  api.ts              # fetch wrapper for soroban-lock-core
  stellar.ts          # Horizon REST + Soroban RPC helpers
  wallet.ts           # Freighter wallet integration
types/
  findings.ts         # Finding type matching core Rust struct
  stellar.ts          # Stellar network + wallet types
```

## Sister Repos

- [soroban-lock-core](https://github.com/verita-lock/Soroban-Lock-Core) — Rust/Axum analysis engine
- [soroban-lock-contracts](https://github.com/verita-lock/soroban-lock-contracts) — Example contracts for testing

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, dev workflow, and the PR checklist.

## License

MIT
