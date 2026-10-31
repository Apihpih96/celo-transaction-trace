# Celo Transaction Trace

A small, dependency-free browser tool for inspecting pasted Celo transaction-receipt JSON. It validates a transaction hash, links to the corresponding Blockscout page, and locally decodes receipt metadata and ERC-20 `Transfer` events.

## Hosted demo

Once GitHub Pages finishes deploying, open the public demo at <https://apihpih96.github.io/celo-transaction-trace/>.

## Run it locally

Open `index.html` in a browser. No build step, account, API key, backend, network lookup, or transaction signing is required. The built-in example loads a verified Celo mainnet swap and demonstrates decoding six selected `Transfer` logs.

## Current scope

- Accepts a transaction receipt as JSON and decodes its status, block number, gas used, transaction hash, log count, and ERC-20 transfer addresses/raw values.
- Includes a real Celo mainnet example: [`0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260`](https://celo.blockscout.com/tx/0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260).
- The bundled example is a selected-log excerpt, not the complete receipt. Token values remain raw units because token decimals are not included.
- This is an offline browser tool, not a callable API or autonomous agent. It does not fetch receipts, call Chainstack or another paid service, send transactions, or provide wallet functionality.

## ERC-8004 profile draft

`agent.json` is a truthful profile for the hosted browser tool. Its `web` service is the public demo; `x402Support` is `false`. It intentionally has no `registrations` entry yet because no ERC-8004 identity has been minted. The file is not yet an on-chain registration, and no transaction has been signed or submitted.

## Hackathon attribution

The event tag is `celo_4b23bdd2081f`. Every Celo mainnet transaction must carry this ERC-8021 attribution suffix before it is sent; untagged transactions cannot be credited later. This prototype currently sends no transactions, so it has no transaction-tagging code path and has made no on-chain activity.

## Experimental Celo Sepolia x402 demo

`sepolia-demo/` contains a separate TypeScript receipt-lookup service and buyer configured for Celo Sepolia. Its local TypeScript build and unpaid `402 Payment Required` check passed; that check advertises a 0.01 test-USDC price but makes no payment. The service is not deployed, and no payment has been signed or settled. The optional buyer script signs a real testnet USDC authorization, so do not run it without explicit approval. There is no mainnet mode.

## Remaining Build with Buy work

The Sepolia demo still needs public hosting and an actual paid test to prove settlement. The mainnet attribution-tagged transaction flow, ERC-8004 identity registration, and independent-user test also remain unfinished. No paid or on-chain action has been performed.
