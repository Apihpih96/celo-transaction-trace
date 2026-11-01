# Textile FX Route Lab — solo demo prototype

A small, responsive, read-only demo for exploring a Textile FX corridor on Celo. It reads current public corridor levels, requests two free indicative previews (USDT → local token → USDT), and shows the estimated round-trip difference. It is designed to demonstrate the idea without connecting a wallet or making a trade.

## Run the visual demo

Requirements: Node.js 18 or newer. No `npm install` and no API key are needed.

1. Unzip this folder on your computer.
2. Open a terminal in the `textile-fx-solo` folder.
3. Run:

   ```sh
   npm run demo
   ```

4. Open `http://127.0.0.1:4173` in a browser.
5. Choose a corridor and starting USDT amount, then press **Preview route**. Stop the server with Ctrl+C.

The server listens only on `127.0.0.1`. Default demo notional is 10 USDT and the interface caps it at 1,000 USDT; it is just the amount passed to the free preview API, not an order. Results are live and can change or be unavailable as liquidity changes. No canned profitable result is shown.

## What it does

- Reads Textile's public levels for Celo (chain ID 42220).
- Uses the documented unauthenticated indicative-preview endpoint for the two legs.
- Shows the preview time, each leg, approximate difference and explicit limitations.
- Checks the current corridor minimum/visible size before requesting previews.
- Includes a `node:test` suite for amount parsing, unit formatting, arithmetic and corridor selection.

## What it intentionally cannot do

This prototype has no wallet connection, private key/API key, allowance, firm-quote request, signature, transaction broadcast, order, settlement, or persistent trade logging. It does not provide a button to execute a route. The local `/api/quote` endpoint is a read-only preview interface; it only calls Textile's public levels and free preview endpoints. The server binds to localhost.

Two separate indicative previews are not simultaneous or executable quotes, can be stale, and exclude gas, slippage, timing and execution risk. The estimate is not realized P&L and is not financial advice. The Textile test environment does not provide a Celo test corridor, so this demo reads public Celo mainnet market data but does not transact on mainnet.

No existing test-USDC demo or previously completed Celo receipt-decoder work is replaced by this prototype. Whether a solo builder's own Textile fills qualify for hackathon judging remains unconfirmed. Do not make mainnet trades or payments based on this demo.

## Commands

```sh
npm run demo
npm test
node scan.mjs --pair wARS --amount 10
node scan.mjs --pair all --amount 10
```

The original CLI scanner remains available. The visual Route Lab uses a smaller curated corridor list: wARS, cNGN, wBRL, wCOP, wMXN and IDRX. A corridor can be listed but have no current depth or valid quote.

## Public references

- Agents on Open Rails: https://www.loops.house/agents-on-open-rails
- Textile RFQ API: https://docs.textilecredit.com/api/v2/rfq.html
- Textile quoting guide: https://docs.textilecredit.com/guides/quoting-the-order-book.html
- Textile Celo address book: https://docs.textilecredit.com/protocol/address-book.html
- Textile testnet details: https://docs.textilecredit.com/testnet.html
