import "dotenv/config";

import { readFile } from "node:fs/promises";

import { serve } from "@hono/node-server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";
import { createPublicClient, http, keccak256, toHex } from "viem";
import { celoSepolia } from "viem/chains";
import { CELO_CHAIN_ID, TEXTILE_API, TOKENS, corridorPair, formatUnits, parseUnits, roundTripResult } from "./route-lab.js";
import { CAIP2, EXPLORER_URL, NETWORK, PAY_TO, PRICE, RPC_URL, USDC, facilitator } from "./x402.js";

const app = new Hono();
const publicClient = createPublicClient({ chain: celoSepolia, transport: http(RPC_URL) });
const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"));

app.get("/healthz", (c) => c.json({ ok: true, network: "Celo Sepolia", chainId: 11142220 }));

// Route Lab is a read-only frontend/API on this same server. Keep the existing
// paid Celo Sepolia POST /decode endpoint and its payment middleware unchanged.
const routeLabAssets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
} as const;

for (const [route, [file, contentType]] of Object.entries(routeLabAssets)) {
  app.get(route, async (c) => {
    const content = await readFile(new URL(`../public/route-lab/${file}`, import.meta.url), "utf8");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
    c.header("Cache-Control", "no-store");
    return c.body(content, 200, { "Content-Type": contentType });
  });
}

const safePairs = ["wARS", "cNGN", "wBRL", "wCOP", "wMXN", "IDRX"] as const;
const maxRouteLabNotional = 1000;

async function textileJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  const text = await response.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { throw new Error(`Textile API returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`Textile API HTTP ${response.status}: ${payload?.error?.message ?? text.slice(0, 180)}`);
  return payload;
}

async function routeLabQuote(pair: string, amountText: string) {
  if (!(safePairs as readonly string[]).includes(pair)) return { status: 400, body: { error: "Choose one of the supported demo corridors." } };
  let start: bigint;
  try { start = parseUnits(amountText, TOKENS.USDT.decimals); }
  catch (error) { return { status: 400, body: { error: error instanceof Error ? error.message : "Invalid amount." } }; }
  if (start > BigInt(maxRouteLabNotional) * 10n ** 6n) return { status: 400, body: { error: `Demo notional is capped at ${maxRouteLabNotional} USDT.` } };

  const levels = await textileJson(`${TEXTILE_API}/rfq/levels?chainId=${CELO_CHAIN_ID}`);
  const { forward, reverse } = corridorPair(levels, pair as keyof typeof TOKENS);
  if (!forward || !reverse) return { status: 422, body: { error: `No current ${pair}/USDT route is listed.` } };
  if (!forward.levels?.length || !reverse.levels?.length || BigInt(forward.maxSellAmount ?? "0") === 0n || BigInt(reverse.maxSellAmount ?? "0") === 0n) {
    return { status: 422, body: { error: `The current ${pair}/USDT route has no visible depth in one direction.` } };
  }

  const forwardMin = BigInt(forward.minSellAmount ?? "0");
  const forwardMax = BigInt(forward.maxSellAmount ?? "0");
  if (start < forwardMin) return { status: 422, body: { error: `Starting amount is below the current first-leg minimum of ${formatUnits(forwardMin, 6)} USDT.` } };
  if (start > forwardMax) return { status: 422, body: { error: `Starting amount exceeds the visible first-leg size of ${formatUnits(forwardMax, 6)} USDT.` } };

  const preview = async (sellToken: string, buyToken: string, sellAmount: bigint) => textileJson(`${TEXTILE_API}/rfq/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: CELO_CHAIN_ID, sellToken, buyToken, sellAmount: String(sellAmount) }),
  });
  const first = await preview(TOKENS.USDT.address, TOKENS[pair as keyof typeof TOKENS].address, start);
  if (first?.data?.status !== "preview" || !first.data.buyAmount) return { status: 422, body: { error: `First indicative preview unavailable: ${first?.data?.reason ?? first?.data?.status ?? "no quote"}.` } };
  const middle = BigInt(first.data.buyAmount);
  const reverseMin = BigInt(reverse.minSellAmount ?? "0");
  const reverseMax = BigInt(reverse.maxSellAmount ?? "0");
  const pairDecimals = TOKENS[pair as keyof typeof TOKENS].decimals;
  if (middle < reverseMin) return { status: 422, body: { error: `The return leg is below its current minimum (${formatUnits(reverseMin, pairDecimals, 6)} ${pair}).` } };
  if (middle > reverseMax) return { status: 422, body: { error: `The return leg exceeds visible depth (${formatUnits(reverseMax, pairDecimals, 6)} ${pair}).` } };
  const second = await preview(TOKENS[pair as keyof typeof TOKENS].address, TOKENS.USDT.address, middle);
  if (second?.data?.status !== "preview" || !second.data.buyAmount) return { status: 422, body: { error: `Return-leg preview unavailable: ${second?.data?.reason ?? second?.data?.status ?? "no quote"}.` } };

  const finish = BigInt(second.data.buyAmount);
  const { delta, roiPct } = roundTripResult(start, finish);
  return { status: 200, body: {
    chainId: CELO_CHAIN_ID,
    pair,
    amount: formatUnits(start, 6),
    intermediate: formatUnits(middle, pairDecimals, 6),
    returnAmount: formatUnits(finish, 6),
    delta: formatUnits(delta, 6),
    roiPct: Number.isFinite(roiPct) ? roiPct : null,
    levelsAsOf: levels?.data?.asOf ?? null,
    sampledAt: new Date().toISOString(),
    disclaimer: "Two separate indicative previews—not a simultaneous executable route. Excludes gas and execution risk; not profit or a trade.",
  } };
}

app.get("/api/quote", async (c) => {
  try {
    const result = await routeLabQuote(c.req.query("pair") || "wARS", c.req.query("amount") || "10");
    c.header("Cache-Control", "no-store");
    return c.json(result.body, result.status as 200 | 400 | 422 | 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown read error";
    return c.json({ error: `Textile read failed: ${message}. Nothing was signed or sent.` }, 502, { "Cache-Control": "no-store" });
  }
});

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
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
console.log(`Celo Transaction Trace Sepolia seller at http://localhost:${port}`);
console.log(`network: Celo Sepolia (${CAIP2}); price: ${PRICE} raw USDC units`);
if (!process.env.X402_API_KEY) {
  console.warn("X402_API_KEY missing: unpaid 402 checks work, but facilitator settlement will fail.");
}
