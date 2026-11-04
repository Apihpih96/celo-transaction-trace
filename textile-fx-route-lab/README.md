# Textile FX Route Lab — read-only prototype

A responsive demo with two deliberately separate modules:

- Textile FX corridor previews on Celo (USDT → local token → USDT).
- A Solana mainnet read-only integration that checks the USDC and USDT mint accounts through Solana RPC, then asks Jupiter Swap API v2 for a quote-only USDC → USDT route.

The Solana module never supplies a taker address, wallet, signer, or API key. The code requires Jupiter to return `transaction: null`; it does not retain or use a transaction payload. It never calls `/execute`, submits, bridges, or trades. Solana/Jupiter is not presented as Textile liquidity or a Celo-to-Solana route.

## Run the demo

Requirements: Node.js 18 or newer. No `npm install` or API key is needed.

1. Unzip this folder.
2. Open a terminal in `textile-fx-route-lab`.
3. Run `npm run demo`.
4. Open `http://127.0.0.1:4173`.
5. The Celo/Textile preview loads in its own panel. To make a Solana request, enter an amount and press **Fetch quote**. Stop the server with Ctrl+C.

The app server binds only to `127.0.0.1`. Each module has its own read-only panel and explanation. The Solana input is capped at 1,000 USDC; one quote action makes one confirmed-account RPC read and one Jupiter `/order` GET. The app also enforces a short interval between Jupiter requests to stay within keyless public limits. Quotes are live and may change or be unavailable; no sample price is hard-coded.

## Solana integration details

- Reads the canonical Solana mainnet USDC and USDT SPL token mint accounts via `getMultipleAccounts`, validates ownership by the SPL Token program, initialization and six-decimal precision, and displays the confirmed RPC slot.
- Requests a keyless Jupiter Swap API v2 quote for USDC → USDT. `/order` is called without `taker`, so this is quote-only; the backend rejects any response that is not explicitly transaction-null.
- Shows the quote router, returned fee basis points, price-impact value when provided, response time and RPC slot. Missing optional fee/impact values are labeled as unavailable.
- Has no wallet connection, key custody, signing, transaction submission, execution, or automatic refresh. Nothing is sent to Solana except read-only RPC/API requests.

Jupiter's public keyless rate limit is 0.5 requests/second; the server applies a conservative local throttle. Solana public RPC availability is not guaranteed. The amount is only a quote input, not a balance or order. A quote is not an executable guarantee or financial advice.

## Textile/Celo module

The original Textile simulator remains separate and unchanged in purpose: it reads public Celo corridor levels (chain ID 42220), calls Textile's unauthenticated indicative-preview endpoint for two legs, checks visible depth/minimums and shows an estimated difference. These are neither simultaneous nor executable quotes; gas, slippage, timing and execution risk are excluded.

## Commands and tests

```sh
npm run demo
npm test
node scan.mjs --pair wARS --amount 10
node scan.mjs --pair all --amount 10
```

The tests cover amount parsing, arithmetic, Textile corridor selection, Jupiter query construction, SPL mint verification and quote-only response validation.

## Public references

- Jupiter Swap API: https://developers.jup.ag/docs/swap
- Jupiter Order & Execute (including quote-only behavior without `taker`): https://developers.jup.ag/docs/swap/order-and-execute
- Jupiter rate limits: https://developers.jup.ag/docs/portal/rate-limits
- Solana mainnet JSON-RPC: https://api.mainnet-beta.solana.com
- Textile RFQ API: https://docs.textilecredit.com/api/v2/rfq.html
- Textile quoting guide: https://docs.textilecredit.com/guides/quoting-the-order-book.html
- Textile Celo address book: https://docs.textilecredit.com/protocol/address-book.html
- Agents on Open Rails: https://www.loops.house/agents-on-open-rails
