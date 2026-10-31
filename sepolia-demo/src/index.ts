import "dotenv/config";

import { serve } from "@hono/node-server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";
import { createPublicClient, http, keccak256, toHex } from "viem";
import { celoSepolia } from "viem/chains";
import { CAIP2, EXPLORER_URL, NETWORK, PAY_TO, PRICE, RPC_URL, USDC, facilitator } from "./x402.js";

const app = new Hono();
const publicClient = createPublicClient({ chain: celoSepolia, transport: http(RPC_URL) });
const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"));

app.get("/healthz", (c) => c.json({ ok: true, network: "Celo Sepolia", chainId: 11142220 }));

if (!PAY_TO || !/^0x[0-9a-fA-F]{40}$/.test(PAY_TO)) {
  throw new Error("Set X402_PAY_TO to a valid receiving address in sepolia-demo/.env");
}

const server = new x402ResourceServer(facilitator);
server.register(CAIP2, new ExactEvmScheme());
app.use(
  "*",
  paymentMiddleware(
    {
      "POST /decode": {
        accepts: [
          {
            scheme: "exact",
            network: CAIP2,
            payTo: PAY_TO as `0x${string}`,
            price: {
              amount: PRICE,
              asset: USDC,
              extra: { name: "USDC", version: "2" },
            },
          },
        ],
        description: "Decode a Celo Sepolia transaction receipt and ERC-20 Transfer logs",
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
      network: "Celo Sepolia",
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      logCount: receipt.logs.length,
      erc20Transfers: transfers,
      explorerUrl: `${EXPLORER_URL}/tx/${receipt.transactionHash}`,
      note: "Transfer values are raw token units; token decimals are not fetched.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown RPC error";
    if (/receipt not found|transaction not found/i.test(message)) {
      return c.json({ error: "No Celo Sepolia receipt found for that hash" }, 404);
    }
    console.error("Sepolia RPC lookup failed:", message);
    return c.json({ error: "Celo Sepolia receipt lookup failed" }, 502);
  }
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`Celo Transaction Trace Sepolia seller at http://localhost:${port}`);
console.log(`network: Celo Sepolia (${CAIP2}); price: ${PRICE} raw USDC units`);
if (!process.env.X402_API_KEY) {
  console.warn("X402_API_KEY missing: unpaid 402 checks work, but facilitator settlement will fail.");
}
