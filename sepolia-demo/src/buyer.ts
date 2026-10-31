// Optional paid testnet buyer. This signs a Sepolia USDC authorization and asks
// the Celo Sepolia facilitator to settle it. Do not run without the owner's go-ahead.
import "dotenv/config";

import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { CAIP2, EXPLORER_URL } from "./x402.js";

const key = process.env.BUYER_PRIVATE_KEY;
if (!key) throw new Error("Set BUYER_PRIVATE_KEY for a throwaway Sepolia-only wallet in your local .env.");
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("BUYER_PRIVATE_KEY must be a 32-byte hex key.");
const hash = process.env.SEPOLIA_TX_HASH;
if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  throw new Error("Set SEPOLIA_TX_HASH to a valid Celo Sepolia transaction hash.");
}

const account = privateKeyToAccount(key as `0x${string}`);
const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: CAIP2, client: new ExactEvmScheme(account) }],
});
const url = process.env.SELLER_URL ?? "http://localhost:3001/decode";
console.log(`Optional testnet payment from ${account.address}; no CELO is needed for x402 gas.`);
const response = await payFetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ transactionHash: hash }),
});
console.log(`HTTP ${response.status}`);
console.log(await response.text());
const receiptHeader = response.headers.get("payment-response");
if (receiptHeader) {
  const payment = JSON.parse(Buffer.from(receiptHeader, "base64").toString("utf8")) as { transaction?: string };
  console.log("Settlement receipt:", payment);
  if (payment.transaction) console.log(`${EXPLORER_URL}/tx/${payment.transaction}`);
}
