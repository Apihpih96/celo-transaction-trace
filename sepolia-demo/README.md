# Celo Sepolia x402 receipt demo

This adds a testnet-only paid HTTP API to Celo Transaction Trace. `POST /decode` asks an x402 client for 0.01 test USDC, then reads a Celo Sepolia receipt through Forno and returns receipt metadata plus decoded ERC-20 `Transfer` logs. It does not touch Celo mainnet and has no mainnet mode.

## Safe, unpaid check

Requirements: Node.js 20+ and pnpm 9+.

1. Copy `.env.example` to `.env` and put an address you control on Celo Sepolia in `X402_PAY_TO`.
2. From this directory, run `pnpm install` and `pnpm dev`.
3. In a second terminal, run `pnpm check:402`.

The smoke test sends an unpaid request and verifies a `402 Payment Required` response with Celo Sepolia payment terms. It does not sign or settle a payment. `X402_API_KEY` is not needed for this check.

## Optional paid Sepolia demonstration

This is deliberately a separate, explicit step. It requires a Celo x402 facilitator API key and test USDC in a throwaway Sepolia wallet. The facilitator's settlement uses free starter credits if available; when those are exhausted, settlement can incur facilitator fees. Use the Celo x402 dashboard and Sepolia faucet yourself; never paste a private key or seed phrase into chat or commit it.

For a real settlement, save the buyer key only in this ignored local `.env`, set `SEPOLIA_TX_HASH` to a real Celo Sepolia receipt, and run `pnpm buy`. It signs a testnet USDC authorization; the facilitator settles on Celo Sepolia. Do not run `pnpm buy` unless you specifically choose to make that testnet payment.

## Boundaries

- Fixed chain: Celo Sepolia (`eip155:11142220`) and its x402 facilitator.
- Price: `10000` raw USDC units = 0.01 USDC (USDC has 6 decimals).
- The receipt lookup uses the public Celo Sepolia Forno RPC endpoint.
- `pnpm check:402` is a no-payment check, not evidence that settlement works.
- No production hosting is configured. GitHub Pages only hosts the static demo; this seller runs locally until deliberately deployed to a server.
- This does not yet provide a mainnet tagged transaction flow, ERC-8004 registration, or an independent-user test.
