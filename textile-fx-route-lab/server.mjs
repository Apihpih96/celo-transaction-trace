import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CELO_CHAIN_ID, TEXTILE_API, TOKENS, corridorPair, parseUnits, formatUnits, roundTripResult } from "./strategy.mjs";
import { solanaQuote } from "./solana.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const MAX_USDT = 1000;
const SAFE_PAIRS = ["wARS", "cNGN", "wBRL", "wCOP", "wMXN", "IDRX"];
const MAX_SOLANA_USDC = 1000;
let lastSolanaQuoteAt = 0;

async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Textile API returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`Textile API HTTP ${response.status}: ${payload?.error?.message ?? text.slice(0, 180)}`);
  return payload;
}

async function preview(sellToken, buyToken, sellAmount) {
  return getJson(`${TEXTILE_API}/rfq/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: CELO_CHAIN_ID, sellToken, buyToken, sellAmount: String(sellAmount) }),
  });
}

function fail(status, message) { return { status, body: { error: message } }; }

async function quote(pair, amountText) {
  if (!SAFE_PAIRS.includes(pair)) return fail(400, "Choose one of the supported demo corridors.");
  let start;
  try { start = parseUnits(amountText, TOKENS.USDT.decimals); }
  catch (error) { return fail(400, error.message); }
  if (start > BigInt(MAX_USDT) * 10n ** 6n) return fail(400, `Demo notional is capped at ${MAX_USDT} USDT.`);

  const levels = await getJson(`${TEXTILE_API}/rfq/levels?chainId=${CELO_CHAIN_ID}`);
  const { forward, reverse } = corridorPair(levels, pair);
  if (!forward || !reverse) return fail(422, `No current ${pair}/USDT route is listed.`);
  if (!forward.levels?.length || !reverse.levels?.length || BigInt(forward.maxSellAmount ?? "0") === 0n || BigInt(reverse.maxSellAmount ?? "0") === 0n) {
    return fail(422, `The current ${pair}/USDT route has no visible depth in one direction.`);
  }
  const forwardMin = BigInt(forward.minSellAmount ?? "0");
  const forwardMax = BigInt(forward.maxSellAmount ?? "0");
  if (start < forwardMin) return fail(422, `Starting amount is below the current first-leg minimum of ${formatUnits(forwardMin, 6)} USDT.`);
  if (start > forwardMax) return fail(422, `Starting amount exceeds the visible first-leg size of ${formatUnits(forwardMax, 6)} USDT.`);

  const first = await preview(TOKENS.USDT.address, TOKENS[pair].address, start);
  if (first?.data?.status !== "preview" || !first.data.buyAmount) return fail(422, `First indicative preview unavailable: ${first?.data?.reason ?? first?.data?.status ?? "no quote"}.`);
  const middle = BigInt(first.data.buyAmount);
  const reverseMin = BigInt(reverse.minSellAmount ?? "0");
  const reverseMax = BigInt(reverse.maxSellAmount ?? "0");
  if (middle < reverseMin) return fail(422, `The return leg is below its current minimum (${formatUnits(reverseMin, TOKENS[pair].decimals, 6)} ${pair}).`);
  if (middle > reverseMax) return fail(422, `The return leg exceeds visible depth (${formatUnits(reverseMax, TOKENS[pair].decimals, 6)} ${pair}).`);
  const second = await preview(TOKENS[pair].address, TOKENS.USDT.address, middle);
  if (second?.data?.status !== "preview" || !second.data.buyAmount) return fail(422, `Return-leg preview unavailable: ${second?.data?.reason ?? second?.data?.status ?? "no quote"}.`);

  const finish = BigInt(second.data.buyAmount);
  const { delta, roiPct } = roundTripResult(start, finish);
  return { status: 200, body: {
    chainId: CELO_CHAIN_ID,
    pair,
    amount: formatUnits(start, 6),
    intermediate: formatUnits(middle, TOKENS[pair].decimals, 6),
    returnAmount: formatUnits(finish, 6),
    delta: formatUnits(delta, 6),
    roiPct: Number.isFinite(roiPct) ? roiPct : null,
    levelsAsOf: levels?.data?.asOf ?? null,
    sampledAt: new Date().toISOString(),
    disclaimer: "Two separate indicative previews—not a simultaneous executable route. Excludes gas and execution risk; not profit or a trade.",
  } };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && url.pathname === "/api/quote") {
      let result;
      try { result = await quote(url.searchParams.get("pair") || "wARS", url.searchParams.get("amount") || "10"); }
      catch (error) { result = fail(502, `Textile read failed: ${error.message}`); }
      res.writeHead(result.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(result.body));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/solana-quote") {
      const now = Date.now();
      if (now - lastSolanaQuoteAt < 2100) {
        res.writeHead(429, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "3" });
        res.end(JSON.stringify({ error: "Jupiter’s public keyless limit is 0.5 requests per second. Wait a moment before refreshing." }));
        return;
      }
      lastSolanaQuoteAt = now;
      let body;
      try {
        const amount = url.searchParams.get("amount") || "10";
        const units = parseUnits(amount, 6);
        if (units > BigInt(MAX_SOLANA_USDC) * 10n ** 6n) throw new Error(`Demo notional is capped at ${MAX_SOLANA_USDC} USDC.`);
        body = await solanaQuote(units);
      } catch (error) { body = { error: `Jupiter read failed: ${error.message}` }; }
      const status = body.error ? 502 : 200;
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
      return;
    }
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const staticFiles = { "/": ["index.html", "text/html; charset=utf-8"], "/index.html": ["index.html", "text/html; charset=utf-8"], "/style.css": ["style.css", "text/css; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"] };
    const staticFile = staticFiles[url.pathname];
    if (!staticFile) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Not found"); return; }
    const content = await readFile(join(ROOT, "public", staticFile[0]));
    res.writeHead(200, { "content-type": staticFile[1], "cache-control": "no-store" });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }); res.end("Local demo error");
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Read-only Textile FX demo: http://127.0.0.1:${PORT}`));
