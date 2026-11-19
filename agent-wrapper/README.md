# Celo Transaction Trace agent wrapper prototype

This is a separate Node.js service around the existing Celo Transaction Trace tools. It exposes a receipt parser and read-only Concordium testnet checks. The agent card continues to claim no Concordium registration until a transaction is actually confirmed on-chain.

## Run and test

Requires Node.js 20+.

```sh
cd agent-wrapper
yarn install
node ./node_modules/esbuild/bin/esbuild src/register-client.js --bundle --format=esm --platform=browser --target=es2022 --outfile=public/register-client.bundle.js
node --test
npm start
```

The server binds to `127.0.0.1:4174` by default. Set `PORT` or `HOST` to change that for local development. `npm test` and `npm start` build the browser helper first. The root `render.yaml` defines a separate Render Free web service; auto-deploy is disabled, so code updates need a manual deploy.

- `GET /healthz` — local service health.
- `GET /agent-card.json` — local prototype service description. `registrations` is empty: no Concordium registration or badge is claimed.
- `GET /concordium-agent-card.json` — the hosted Concordium card.
- `GET /register` — a phone-friendly, user-initiated Testnet registration helper. It fetches the current card, verifies its SHA-256, serializes the `CIS-8004.register` parameters with the checked Testnet schema, and refuses to request a wallet transaction if the card or payload differs. It only connects the expected Testnet account and requests a wallet review after the owner taps the button. It never signs automatically; the owner decides in the wallet. The wallet fee can change; check the live fee and payload before signing. A returned transaction hash still needs an explorer check before claiming registration succeeded.
- `GET /api/concordium/register-info` — public transaction details used by the helper; contains no secrets.
- `POST /api/analyze-receipt` — analyze `{ "receipt": { ... } }` (or the receipt object itself). This only analyzes JSON supplied by the caller; it does not fetch Celo receipts or infer token decimals or intent.
- `GET /api/concordium/testnet` — reads live CIS-8/CIS-8004 deployment and testnet status through the fixed official hosted MCP URL.
- `GET /api/concordium/badges/{token_address}` — asks the hosted MCP to check the supplied testnet badge token address. A false result is a verification result, not a transport error.

The registration helper makes no wallet request on page load or connection. It is limited to Concordium Testnet, the prepared owner account, contract `12802.0`, entrypoint `CIS-8004.register`, amount `0 CCD`, and 30,000 maximum contract execution energy. The wallet is the source of the current fee; the last observed review estimated 217.756912 CCD, which can change. If the wallet review differs from the page, decline it.

The Render Free plan sleeps after 15 minutes without inbound traffic and can take about a minute to wake; free bandwidth and build-pipeline quotas apply. The existing Celo ERC-8004 record is on Celo Mainnet; it is not a Concordium Testnet registration. A real Concordium badge check needs a valid Testnet token address. No other part of this wrapper signs or submits transactions, makes x402 payments or runs a paid test path.
