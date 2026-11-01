import "dotenv/config";

import { serve } from "@hono/node-server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";
import { createPublicClient, http, keccak256, toHex } from "viem";
import { celo } from "viem/chains";
import {
  EXPLORER_URL,
  FACILITATOR_URL,
  NETWORK,
  NETWORK_NAME,
  RPC_URL,
  USAT,
  USAT_NAME,
  USAT_VERSION,
  readConfig,
} from "./config.js";

const config = readConfig(process.env);
const app = new Hono();
const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });
const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"));

const facilitator = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: async () => {
    const headers: Record<string, string> = config.apiKey ? { "X-API-Key": config.apiKey } : {};
    return { verify: headers, settle: headers, supported: headers };
  },
});
const server = new x402ResourceServer(facilitator);
server.register(NETWORK, new ExactEvmScheme());

app.get("/healthz", (c) => c.json({ ok: true, network: NETWORK_NAME, chainId: 42220, asset: "USA₮", settlementEnabled: config.settlementEnabled }));

// Default-deny even if a client sends a paid x402 header. Do not run settlement
// until the operator explicitly flips X402_ENABLE_SETTLEMENT after required review.
app.use("/decode", async (c, next) => {
  if (!config.settlementEnabled && (c.req.header("payment-signature") || c.req.header("x-payment"))) {
    return c.json({ error: "Mainnet settlement is disabled for this demo." }, 503);
  }
  await next();
});

app.use(
  "*",
  paymentMiddleware(
    {
      "POST /decode": {
        accepts: [
          {
            scheme: "exact",
            network: NETWORK,
            payTo: config.payTo,
            price: {
              amount: config.price,
              asset: USAT,
              extra: { name: USAT_NAME, version: USAT_VERSION },
            },
          },
        ],
        description: "Decode a Celo Mainnet transaction receipt and ERC-20 Transfer logs",
      },
    },
    server
  )
);

app.post("/decode", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be JSON with a transactionHash" }, 400);
  }
  const transactionHash = (body as { transactionHash?: unknown })?.transactionHash;
  if (typeof transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    return c.json({ error: "transactionHash must be a 32-byte 0x-prefixed hash" }, 400);
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
    const transfers = receipt.logs
      .filter((log) => log.topics[0]?.toLowerCase() === transferTopic.toLowerCase() && log.topics[1] && log.topics[2])
      .map((log) => ({
        token: log.address,
        from: `0x${log.topics[1]!.slice(-40)}`,
        to: `0x${log.topics[2]!.slice(-40)}`,
        rawAmount: BigInt(log.data).toString(),
      }));

    return c.json({
      network: NETWORK_NAME,
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      logCount: receipt.logs.length,
      erc20Transfers: transfers,
      explorerUrl: `${EXPLORER_URL}/tx/${receipt.transactionHash}`,
      note: "Transfer amounts are raw token units; token decimals are not fetched.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown RPC error";
    if (/receipt not found|transaction not found/i.test(message)) {
      return c.json({ error: "No Celo Mainnet receipt found for that hash" }, 404);
    }
    console.error("Celo Mainnet RPC lookup failed:", message);
    return c.json({ error: "Celo Mainnet receipt lookup failed" }, 502);
  }
});

const port = Number(process.env.PORT ?? 3002);
serve({ fetch: app.fetch, port });
console.log(`Celo Mainnet USA₮ seller at http://localhost:${port}`);
console.log(`network: ${NETWORK} (${NETWORK_NAME}); asset: ${USAT}; price: ${config.price} raw USA₮ units`);
console.log(`settlement enabled: ${config.settlementEnabled}`);
if (!config.settlementEnabled) {
  console.warn("Safe mode: x402 challenge requests work, but signed payment requests are rejected; no settlement will be attempted.");
}
