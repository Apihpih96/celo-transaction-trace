#!/usr/bin/env node
import { CELO_CHAIN_ID, TEXTILE_API, TOKENS, corridorPair, formatUnits, parseUnits, roundTripResult } from "./strategy.mjs";

function parseArgs(argv) {
  const result = { pair: "wARS", amount: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pair" && argv[i + 1]) result.pair = argv[++i];
    else if (arg.startsWith("--pair=")) result.pair = arg.slice(7);
    else if (arg === "--amount" && argv[i + 1]) result.amount = argv[++i];
    else if (arg.startsWith("--amount=")) result.amount = arg.slice(9);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  return result;
}

function explain() {
  console.log(`Textile FX Solo Scout — READ-ONLY quote preview (Celo Mainnet, chain ${CELO_CHAIN_ID})

Usage:
  node scan.mjs --pair wARS --amount 10
  node scan.mjs --pair all --amount 10

--pair: ${Object.keys(TOKENS).filter((name) => name !== "USDT").join(", ")}, or all
--amount: starting USDT amount used only for indicative API previews; required

This program reads public Textile levels and free indicative previews. It never requests a firm quote,
connects a wallet, signs, broadcasts, approves tokens, sends funds, or records a trade.`);
}

async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Textile API returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`Textile API HTTP ${response.status}: ${payload?.error?.message ?? text.slice(0, 240)}`);
  return payload;
}

async function preview(sellToken, buyToken, sellAmount) {
  return getJson(`${TEXTILE_API}/rfq/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: CELO_CHAIN_ID, sellToken, buyToken, sellAmount: String(sellAmount) }),
  });
}

function resultLine(symbol, input, forward, reverse) {
  const first = forward?.data;
  if (!first || first.status !== "preview") {
    const reason = first?.reason ?? first?.message ?? first?.status ?? "No indicative quote";
    console.log(`\n${symbol}: first leg unavailable (${reason}). No trade attempted.`);
    return;
  }
  const second = reverse?.data;
  if (!second || second.status !== "preview") {
    const reason = second?.reason ?? second?.message ?? second?.status ?? "No indicative quote";
    console.log(`\n${symbol}: outbound preview available; return leg unavailable (${reason}). No trade attempted.`);
    console.log(`  ${input} USDT → ${formatUnits(first.buyAmount, TOKENS[symbol].decimals, 6)} ${symbol}`);
    return;
  }
  const start = BigInt(input);
  const finish = BigInt(second.buyAmount);
  const { delta, roiPct } = roundTripResult(start, finish);
  console.log(`\n${symbol}/USDT indicative round trip`);
  console.log(`  Start:     ${formatUnits(start, TOKENS.USDT.decimals, 6)} USDT`);
  console.log(`  Leg 1:     ${formatUnits(start, TOKENS.USDT.decimals, 6)} USDT → ${formatUnits(first.buyAmount, TOKENS[symbol].decimals, 6)} ${symbol}`);
  console.log(`  Leg 2:     ${formatUnits(first.buyAmount, TOKENS[symbol].decimals, 6)} ${symbol} → ${formatUnits(finish, TOKENS.USDT.decimals, 6)} USDT`);
  console.log(`  Indicative change: ${formatUnits(delta, TOKENS.USDT.decimals, 6)} USDT (${roiPct.toFixed(4)}%)`);
  console.log("  Not realized P&L: this uses two separate, potentially stale previews; excludes gas and can differ from firm quotes.");
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return explain();
  if (!options.amount) throw new Error("Choose a preview size, for example --amount 10. This is not an order.");
  const start = parseUnits(options.amount, TOKENS.USDT.decimals);
  const levels = await getJson(`${TEXTILE_API}/rfq/levels?chainId=${CELO_CHAIN_ID}`);
  const symbols = options.pair.toLowerCase() === "all"
    ? Object.keys(TOKENS).filter((name) => name !== "USDT")
    : [Object.keys(TOKENS).find((name) => name.toLowerCase() === options.pair.toLowerCase())];
  if (symbols.some((symbol) => !symbol)) throw new Error(`Unknown pair: ${options.pair}. Choose one of ${Object.keys(TOKENS).filter((name) => name !== "USDT").join(", ")}, or all.`);

  console.log(`Textile FX levels timestamp: ${levels?.data?.asOf ?? "not supplied"}`);
  console.log(`Live Celo mainnet read only • starting preview size ${formatUnits(start, 6)} USDT • no order requested`);
  for (const symbol of symbols) {
    const pair = corridorPair(levels, symbol);
    if (!pair.forward || !pair.reverse) {
      console.log(`\n${symbol}/USDT: not listed in current Celo levels response.`);
      continue;
    }
    if (!pair.forward.levels?.length || !pair.reverse.levels?.length || BigInt(pair.forward.maxSellAmount ?? "0") === 0n || BigInt(pair.reverse.maxSellAmount ?? "0") === 0n) {
      console.log(`\n${symbol}/USDT: listed, but current levels report no depth in one or both directions.`);
      continue;
    }
    const minimum = BigInt(pair.forward.minSellAmount ?? "0");
    if (start < minimum) {
      console.log(`\n${symbol}/USDT: preview size below current minimum (${formatUnits(minimum, 6)} USDT); skipped, no amount auto-adjusted.`);
      continue;
    }
    try {
      const first = await preview(TOKENS.USDT.address, TOKENS[symbol].address, start);
      if (first?.data?.status !== "preview") {
        resultLine(symbol, start, first, null);
        continue;
      }
      const reverseInput = BigInt(first.data.buyAmount);
      const reverseMinimum = BigInt(pair.reverse.minSellAmount ?? "0");
      if (reverseInput < reverseMinimum) {
        console.log(`\n${symbol}/USDT: first preview returned ${formatUnits(reverseInput, TOKENS[symbol].decimals, 6)} ${symbol}, below the live reverse minimum ${formatUnits(reverseMinimum, TOKENS[symbol].decimals, 6)}; return preview skipped.`);
        continue;
      }
      const second = await preview(TOKENS[symbol].address, TOKENS.USDT.address, reverseInput);
      resultLine(symbol, start, first, second);
    } catch (error) {
      console.log(`\n${symbol}/USDT: preview failed: ${error.message}. No order or transaction was attempted.`);
    }
  }
}

run().catch((error) => {
  console.error(`Unable to run read-only preview: ${error.message}`);
  process.exitCode = 1;
});
