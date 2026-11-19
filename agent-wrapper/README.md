# Celo Transaction Trace agent wrapper prototype

This is a separate, read-only Node.js service around the existing Celo Transaction Trace tools. It makes the receipt parser callable over HTTP and provides read-only calls to Concordium's hosted testnet registry MCP. It can run locally or as a separate hosted service; it does not change the existing website or paid x402 API.

## Run and test

Requires Node.js 20+; no install or environment variables are needed.

```sh
cd agent-wrapper
npm test
npm start
```

The server binds to `127.0.0.1:4174` by default. Set `PORT` or `HOST` to change that for local development. The root `render.yaml` defines a separate Render Free web service. Its hosted service card uses Render's HTTPS URL. Auto-deploy is disabled, so later code updates require a manual deploy.

- `GET /healthz` — local service health.
- `GET /agent-card.json` — local prototype service description. `registrations` is empty: no Concordium registration or badge is claimed.
- `POST /api/analyze-receipt` — submit `{ "receipt": { ... } }` (or the receipt object itself). This only analyzes JSON supplied by the caller; it does not fetch Celo receipts or infer token decimals or intent.
- `GET /api/concordium/testnet` — reads live CIS-8/CIS-8004 deployment and testnet status through the fixed official hosted MCP URL.
- `GET /api/concordium/badges/{token_address}` — asks the hosted MCP to check the supplied testnet badge token address. A false result is returned as a verification result, not a transport error.

All operations are read-only. There is no wallet, key, signing, transaction submission, registration, x402 payment or paid test path in this wrapper. The Render Free plan sleeps after 15 minutes without inbound traffic and can take about a minute to wake; free bandwidth and build-pipeline quotas apply. The existing Celo ERC-8004 record is on Celo Mainnet; it is not a Concordium testnet registration. A real Concordium badge check needs a valid testnet token address. Any future registration requires a supported wallet flow and explicit user action; this prototype does not do that.
