# Celo Transaction Trace

A small browser tool for inspecting pasted Celo transaction-receipt JSON and reading confirmed Solana Devnet transactions. The Celo receipt decoder stays local; the Solana explainer reads public Devnet RPC data and links to the Devnet Explorer.

## Hosted demo

The public demo is live at <https://apihpih96.github.io/celo-transaction-trace/> (HTTP 200 checked 2026-11-07).

## Solana Devnet transaction explainer

The main page includes a read-only Solana Devnet explainer. Paste a base58 transaction signature to fetch its confirmed transaction from the public `api.devnet.solana.com` RPC, then inspect top-level and inner program calls, token-account balance changes (calculated from raw amounts and each mint’s decimals), the network fee in SOL, and a link to Solana Explorer with Devnet selected. A public transaction is prefilled as an example; the sample was fetched successfully from Devnet on 2026-11-10 (slot `520776267`, fee `5000` lamports, six token-account balance changes). The example is community Devnet data, not a transaction by this project.

This feature does not request a wallet, reveal or store keys, sign or send transactions, or call a paid provider. It displays token-account balance deltas rather than assigning token names or asserting intent; mint addresses remain the identifiers. RPC availability and historical Devnet retention are controlled by the public provider. Run parser and request-shape tests with `node --test tests/solana-devnet.test.mjs` (Node.js 18+).

## Textile FX Route Lab

`textile-fx-route-lab/` adds a separate, read-only Celo FX preview demo. It reads public Textile corridor levels and requests two free indicative previews; it has no wallet, signer, trade, or settlement path. It runs locally with Node.js 18+ using `npm run demo` from that folder. The estimates are not executable quotes or realized P&L and exclude gas and execution risk. See the [Route Lab README](textile-fx-route-lab/README.md) for setup, limits, and tests. The demo source is public, but it is not hosted by the static GitHub Pages site.

## How to run

### Browser decoder — offline example, no secrets

From the repository root, start a local static server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/> and click **Load and decode example**. It serves the bundled example locally; no environment variables, API keys, wallet, backend, or network lookup are needed. Stop with Ctrl+C. You can also open `index.html` directly.

### Textile FX Route Lab — live read-only previews

Requires Node.js 18+. From the repository root:

```sh
cd textile-fx-route-lab
npm run demo
```

Open <http://127.0.0.1:4173/>. No API key, environment variable, or `npm install` is needed; this demo makes live public indicative-preview requests to Textile, so it is not an offline mock. Stop with Ctrl+C. See the [Route Lab README](textile-fx-route-lab/README.md) for details and tests.

### Celo Sepolia x402 API — unpaid startup check

Requires Node.js 20+ and pnpm 9+. In `sepolia-demo/`, copy `.env.example` to `.env` and set `X402_PAY_TO` to a Celo Sepolia address you control, then run:

```sh
pnpm install
pnpm dev
```

The server listens on `PORT` (default `3001`). In a second terminal, run `pnpm check:402`; this unpaid check needs no `X402_API_KEY`, buyer key, or payment. `pnpm buy` is a separate paid test and is not part of the quick start. See the [x402 demo README](sepolia-demo/README.md) before using it.

## Current scope

- Accepts a transaction receipt as JSON and decodes its status, block number, gas used, transaction hash, log count, and ERC-20 transfer addresses/raw values.
- Includes a real Celo mainnet example: [`0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260`](https://celo.blockscout.com/tx/0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260).
- The bundled example is a selected-log excerpt, not the complete receipt. Token values remain raw units because token decimals are not included.
- The Celo receipt decoder is offline and does not fetch receipts. The Solana Devnet explainer makes one read-only public RPC lookup when requested. Neither feature sends a transaction or provides wallet functionality. The separate x402 receipt API is hosted under `sepolia-demo/` and serves Celo Sepolia only.

## ERC-8004 identity

`agent.json` is the public profile for this project. It now includes the ERC-8004 registration metadata for agent ID `10016` on Celo Mainnet (`eip155:42220`), owned by the registering Valora wallet. The registration used the profile URI in this file and the event attribution tag below.

The registration succeeded in block `81660684` at `2026-11-01 19:30:42 UTC`. Its transaction is [`0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6`](https://celo.blockscout.com/tx/0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6); actual network fee was approximately `0.040284 CELO`.

The ERC-8004 Identity Registry contract is [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celo.blockscout.com/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) on Celo Mainnet.

## Hackathon attribution

The event tag is `celo_4b23bdd2081f`. The successful ERC-8004 registration transaction above included this ERC-8021 attribution suffix. Future eligible Celo transactions need the tag included before submission; it cannot be added retroactively.

## Experimental Celo Sepolia x402 demo

`sepolia-demo/` contains a separate TypeScript receipt-lookup service and buyer configured for Celo Sepolia. The live Render service is <https://celo-transaction-trace.onrender.com/decode>; its `/healthz` endpoint returned `200` and an unpaid `/decode` request returned the expected `402 Payment Required` on 2026-11-02. A separate approved demonstration settled exactly `0.01` test USDC on Celo Sepolia and returned a decoded receipt. The optional buyer script signs a testnet USDC authorization, so do not run it without explicit approval. The API has no Celo mainnet mode.

## Read-only registration receipt checker

`registration-receipt-checker/` is a local TypeScript page that displays the completed registration hash and checks its public Celo receipt, owner, registry, profile call, and attribution tag. It has no wallet connection or transaction submission method. See that folder’s README for local build and verification steps.

## Known limitations

The static browser decoder handles pasted receipt JSON; it does not retrieve receipts itself. The x402 API is a separate Celo Sepolia service, not a mainnet API. An ERC-8004 identity and tagged Celo Mainnet registration now exist, but this does not mean the application can autonomously send mainnet transactions. The successful testnet settlement demonstrates the paid flow, but does not imply future requests are free or guarantee service availability.
