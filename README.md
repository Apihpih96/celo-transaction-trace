# Celo Transaction Trace

A small, dependency-free prototype for inspecting pasted Celo transaction-receipt JSON. It validates a transaction hash, links to the corresponding Blockscout page, and locally decodes receipt metadata and ERC-20 `Transfer` events.

## Run it

Open `index.html` in a browser. No build step, account, API key, backend, network lookup, or transaction signing is required. The built-in example loads a verified Celo mainnet swap and demonstrates decoding six selected `Transfer` logs.

## Current scope

- Accepts a transaction receipt as JSON and decodes its status, block number, gas used, transaction hash, log count, and ERC-20 transfer addresses/raw values.
- Includes a real Celo mainnet example: [`0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260`](https://celo.blockscout.com/tx/0x3cf7830fb32b72878c49613de423639414e18ba92fa148bbbce6d83461cf9260).
- The bundled example is a selected-log excerpt, not the complete receipt. Token values remain raw units because token decimals are not included.
- This is an offline parser, not an autonomous agent. It does not fetch receipts, call Chainstack or another paid service, send transactions, or provide wallet functionality.

## Next build step

For the hackathon's Build with Buy track, a later version would need a useful paid service integration with payment proof, plus the event's required project registration, ERC-8004 identity, public repository and pre-transaction attribution setup. None of those on-chain or paid actions are performed by this prototype.

## Repository

Public project repository for the Celo Agents on Open Rails hackathon. The working Wabi app includes a richer UI; this repository is a portable, standalone prototype.
