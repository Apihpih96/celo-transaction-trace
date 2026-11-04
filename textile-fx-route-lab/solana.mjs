import { formatUnits } from "./strategy.mjs";

export const JUPITER_ORDER_URL = "https://api.jup.ag/swap/v2/order";
export const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
export const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export function buildSolanaOrderUrl(amountUnits) {
  const url = new URL(JUPITER_ORDER_URL);
  url.searchParams.set("inputMint", SOLANA_USDC);
  url.searchParams.set("outputMint", SOLANA_USDT);
  url.searchParams.set("amount", String(amountUnits));
  // Deliberately omit taker, API keys, and all execute/signing paths.
  return url;
}

async function readJsonResponse(response, provider) {
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error(`${provider} returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`${provider} HTTP ${response.status}: ${payload?.error?.message ?? payload?.error ?? payload?.message ?? text.slice(0, 160)}`);
  return payload;
}

export async function verifySolanaStablecoinMints(fetchImpl = fetch) {
  const response = await fetchImpl(SOLANA_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getMultipleAccounts",
      params: [[SOLANA_USDC, SOLANA_USDT], { encoding: "base64", commitment: "confirmed" }],
    }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await readJsonResponse(response, "Solana mainnet RPC");
  if (payload.error) throw new Error(`Solana RPC error: ${payload.error.message ?? "account read failed"}`);
  const accounts = payload?.result?.value;
  if (!Array.isArray(accounts) || accounts.length !== 2) throw new Error("Solana RPC did not return both token mint accounts.");
  for (const [index, account] of accounts.entries()) {
    if (!account || account.owner !== SPL_TOKEN_PROGRAM) throw new Error(`Solana ${index === 0 ? "USDC" : "USDT"} mint is missing or not owned by the expected SPL Token program.`);
    const encoded = account.data?.[0];
    if (typeof encoded !== "string") throw new Error("Solana RPC returned an unreadable mint account.");
    const data = Buffer.from(encoded, "base64");
    if (data.length !== 82 || data[45] !== 1 || data[44] !== 6) throw new Error(`Solana ${index === 0 ? "USDC" : "USDT"} mint did not match an initialized six-decimal SPL token account.`);
  }
  const slot = payload.result.context?.slot;
  if (!Number.isSafeInteger(slot)) throw new Error("Solana RPC did not include a usable confirmation slot.");
  return { slot };
}

export function normalizeSolanaOrder(order, expectedInput) {
  if (!order || typeof order !== "object") throw new Error("Jupiter returned an invalid quote response.");
  if (order.transaction !== null) throw new Error("Jupiter did not return a quote-only response; no transaction was retained.");
  if (String(order.inAmount) !== String(expectedInput)) throw new Error("Jupiter quote input did not match the requested amount.");
  if (!/^\d+$/.test(String(order.outAmount ?? ""))) throw new Error("Jupiter quote did not include a valid output amount.");
  if (typeof order.router !== "string" || !order.router) throw new Error("Jupiter quote did not identify a route provider.");
  return {
    chain: "Solana",
    venue: "Jupiter Swap API v2",
    inputAmount: formatUnits(BigInt(order.inAmount), 6),
    inputSymbol: "USDC",
    outputAmount: formatUnits(BigInt(order.outAmount), 6),
    outputSymbol: "USDT",
    router: order.router,
    feeBps: Number.isInteger(order.feeBps) ? order.feeBps : null,
    priceImpactPct: typeof order.priceImpactPct === "string" ? order.priceImpactPct : null,
    sampledAt: new Date().toISOString(),
    quoteOnly: true,
    transaction: null,
    disclaimer: "Indicative single-hop quote from Jupiter on Solana; not a Textile route, cross-chain bridge, firm execution price, or trade. No wallet, signing, or transaction submission is used.",
  };
}

export async function solanaQuote(amountUnits, fetchImpl = fetch) {
  const mintCheck = await verifySolanaStablecoinMints(fetchImpl);
  const url = buildSolanaOrderUrl(amountUnits);
  const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  const order = await readJsonResponse(response, "Jupiter API");
  return { ...normalizeSolanaOrder(order, amountUnits), mintRpcSlot: mintCheck.slot };
}
