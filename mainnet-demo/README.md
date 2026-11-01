# Celo Mainnet USA₮ x402 receipt demo

A separate, seller-side mainnet path for demonstrating paid receipt decoding on Celo. It serves a `POST /decode` x402 route priced in USA₮ and reads receipts from Celo Mainnet. The existing `../sepolia-demo` remains a separate testnet-only demo; do not treat its Sepolia settlement as mainnet proof.

## Safety defaults

This is preparation and an unpaid smoke-test path, not permission to spend, deploy, or initiate a mainnet settlement. The mainnet route has a default-deny switch: `X402_ENABLE_SETTLEMENT=false` (the default). In safe mode, an unpaid request gets a 402 challenge, but a request carrying a payment header is rejected before settlement. There is deliberately no buyer/private-key script in this folder.

Do not set settlement to `true`, deploy a live payable service, top up a facilitator balance, or invite a buyer to pay until the owner has reviewed the exact amount, facilitator cost/credit terms and specific real-payment approval, and the buyer is verified eligible for the event. The event's Open Corridors lane requires independent user activity before Oct 6; the buyer must not be the builder or the builder's main funder, and must not be first-funded by either. The builder must not seed or reimburse the buyer. Do not claim that the existing Sepolia payment qualifies.

## Configuration

Requirements: Node.js 20+ and pnpm 9+.

1. Copy `.env.example` to `.env`.
2. Set `X402_PAY_TO` to the seller's Celo Mainnet receiving address. This is the seller destination, not the buyer wallet.
3. Confirm `X402_PRICE_USAT`: it is a positive integer of raw units; USA₮ has 6 decimals, so `10000` is `0.01 USA₮`. This sample value is not an instruction or approved payment amount.
4. Leave `X402_ENABLE_SETTLEMENT=false` for the unpaid check. No API key is needed for that check.
5. From this directory run `pnpm install`, then `pnpm build`, `pnpm test`, and `pnpm dev`.
6. In a second terminal run `pnpm check:402`. It sends an unauthenticated request and verifies a 402 challenge for Celo Mainnet USA₮, including the configured price and seller address. It has no wallet signer and sends no payment authorization.

## Mainnet rails (verified against current Celo docs and facilitator)

- Network: Celo Mainnet, CAIP-2 `eip155:42220` (chain ID `42220`).
- Asset: USA₮ / Tether America USD, contract `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771`, 6 decimals.
- EIP-712 metadata: `name: "Tether America USD"`, `version: "1"`.
- Hosted facilitator: `https://api.x402.celo.org`; Forno RPC: `https://forno.celo.org`.
- A valid facilitator key is required for `/settle`; store it only as server-side `X402_API_KEY`, never in browser code, repository files, or a buyer client. Celo documents one free credit per settlement for new accounts, followed by settlement gas at cost plus 0.3% of payment value; deposits are final/non-refundable. Check live terms and account balance before any real run.
- The facilitator's live `/supported` response was checked and lists `USA₮` at the address above for `eip155:42220` with EIP-3009.

## What remains before a real demonstration

1. The owner chooses and approves the exact live payment amount and any facilitator exposure; this repository preparation does not approve those.
2. Identify a willing, genuinely independent buyer and verify the pre-Oct 6 Celo activity eligibility without funding or reimbursing them.
3. Keep the buyer's wallet entirely theirs; no private key is collected by the seller or stored in this repo.
4. Only after the above, separately review and explicitly enable settlement on the server, keep the API key server-side, and run one carefully supervised payment. x402 settlements are not attribution-tagged; submit the seller PayTo address as required by the track instructions and report this accurately.
5. Verify the mainnet payment receipt and save its transaction hash plus the decoded API response for submission. A 402 smoke test is only route wiring, not payment proof.

No production deployment or mainnet payment has been performed by this preparation.
