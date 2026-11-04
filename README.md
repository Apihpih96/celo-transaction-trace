# Celo Transaction Trace

A small, dependency-free browser tool for inspecting pasted Celo transaction-receipt JSON. It validates a transaction hash, links to the corresponding Blockscout page, and locally decodes receipt metadata and ERC-20 `Transfer` events.

## Hosted demo

The public demo is live at <https://apihpih96.github.io/celo-transaction-trace/> (checked 2026-11-02).

## Textile FX Route Lab

`textile-fx-route-lab/` adds a local prototype with two read-only market-data panels: Textile FX previews on Celo and a Jupiter quote-only USDC→USDT panel on Solana. Neither panel connects a wallet, signs, trades, or settles; the Solana quote is not Textile liquidity or a cross-chain route. Run it with Node.js 18+ using `npm run demo` from that folder. The previews are indicative, not executable quotes or realized P&L, and exclude execution costs and risk. See the [Route Lab README](textile-fx-route-lab/README.md) for setup, limits, and tests. A separate `/devnet` page optionally lets the user sign one Memo Program transaction that this local app submits only to Devnet; it transfers no tokens, requires Devnet test SOL for the network fee, and writes a permanently public memo. This local demo is not hosted by the static GitHub Pages site.

## Run it locally

Open `index.html` in a browser. No build step, account, API key, backend, network lookup, or transaction signing is required. The built-in example loads a verified Celo mainnet swap and demonstrates decoding six selected `Transfer` logs.

## Current scope

- Accepts a transaction receipt as JSON and decodes its status, block number, gas used, transaction hash, log count, and ERC-20 transfer addresses/raw values.
- Includes a real Celo mainnet example: [`0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260`](https://celo.blockscout.com/tx/0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260).
- The bundled example is a selected-log excerpt, not the complete receipt. Token values remain raw units because token decimals are not included.
- The static browser decoder is offline: it does not fetch receipts, call Chainstack or another paid service, send transactions, or provide wallet functionality. The separate x402 receipt API is hosted under `sepolia-demo/` and serves Celo Sepolia only.

## ERC-8004 identity

`agent.json` is the public profile for this project. It now includes the ERC-8004 registration metadata for agent ID `10016` on Celo Mainnet (`eip155:42220`), owned by the registering Valora wallet. The registration used the profile URI in this file and the event attribution tag below.

The registration succeeded in block `81660684` at `2026-11-01 19:30:42 UTC`. Its transaction is [`0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6`](https://celo.blockscout.com/tx/0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6); actual network fee was approximately `0.040284 CELO`.

## Hackathon attribution

The event tag is `celo_4b23bdd2081f`. The successful ERC-8004 registration transaction above included this ERC-8021 attribution suffix. Future eligible Celo transactions need the tag included before submission; it cannot be added retroactively.

## Experimental Celo Sepolia x402 demo

`sepolia-demo/` contains a separate TypeScript receipt-lookup service and buyer configured for Celo Sepolia. The live Render service is <https://celo-transaction-trace.onrender.com/decode>; its `/healthz` endpoint returned `200` and an unpaid `/decode` request returned the expected `402 Payment Required` on 2026-11-02. A separate approved demonstration settled exactly `0.01` test USDC on Celo Sepolia and returned a decoded receipt. The optional buyer script signs a testnet USDC authorization, so do not run it without explicit approval. The API has no Celo mainnet mode.

## Read-only registration receipt checker

`registration-receipt-checker/` is a local TypeScript page that displays the completed registration hash and checks its public Celo receipt, owner, registry, profile call, and attribution tag. It has no wallet connection or transaction submission method. See that folder’s README for local build and verification steps.

## Known limitations

The static browser decoder handles pasted receipt JSON; it does not retrieve receipts itself. The x402 API is a separate Celo Sepolia service, not a mainnet API. An ERC-8004 identity and tagged Celo Mainnet registration now exist, but this does not mean the application can autonomously send mainnet transactions. The successful testnet settlement demonstrates the paid flow, but does not imply future requests are free or guarantee service availability.
