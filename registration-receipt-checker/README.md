# Celo registration receipt checker

This read-only local page verifies the already completed ERC-8004 registration on Celo Mainnet. It displays the known transaction hash and queries the public Celo RPC for the transaction and receipt. It has no wallet connection, signer, or transaction-submission method; it cannot create another registration.

## Run locally

Prerequisites: Node.js 20+ and pnpm 9+.

```sh
pnpm install
pnpm build
pnpm test:call
pnpm test:receipt
pnpm dev
```

Open the localhost URL printed by Vite. The receipt check runs automatically; `test:receipt` verifies the public transaction and receipt against the expected owner, registry, profile and attribution tag. It can be refreshed with **Check receipt again**. If the RPC is temporarily unavailable, the saved transaction hash remains visible, but the page will not claim the receipt was verified. A lookup error does not mean the transaction failed.

## Verified registration

- Network: Celo Mainnet (chain ID `42220`)
- Agent ID: `10016`
- Transaction: `0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6`
- Intended owner: `0x465ce2143392b99d1420c0cd6d11ec9baf586ede`
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Profile: `https://raw.githubusercontent.com/Apihpih96/celo-transaction-trace/master/agent.json`
- Attribution tag: `celo_4b23bdd2081f`

The page checks that the fetched transaction matches the expected chain, owner, registry, profile call, and tag, then reads the mined receipt and reports its status, block, confirmations, and actual fee. This is a receipt display, not a full security audit or a substitute for an independent explorer check.

## Safety

This project version is read-only. It does not request wallet access, sign, submit or retry a transaction. Do not add a signing flow or run old signer bundles to repeat this registration.
