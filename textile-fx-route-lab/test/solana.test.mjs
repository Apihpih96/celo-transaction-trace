import test from "node:test";
import assert from "node:assert/strict";
import { buildSolanaOrderUrl, normalizeSolanaOrder, solanaQuote, verifySolanaStablecoinMints, SOLANA_USDC, SOLANA_USDT, SOLANA_RPC_URL } from "../solana.mjs";

test("builds a Solana Jupiter quote URL without a taker or transaction request", () => {
  const url = buildSolanaOrderUrl(10_000_000n);
  assert.equal(url.origin + url.pathname, "https://api.jup.ag/swap/v2/order");
  assert.equal(url.searchParams.get("inputMint"), SOLANA_USDC);
  assert.equal(url.searchParams.get("outputMint"), SOLANA_USDT);
  assert.equal(url.searchParams.get("amount"), "10000000");
  assert.equal(url.searchParams.has("taker"), false);
  assert.equal(url.searchParams.has("apiKey"), false);
});

test("normalizes a quote-only response and omits transaction data", () => {
  const quote = normalizeSolanaOrder({ inAmount: "10000000", outAmount: "9985000", router: "metis", feeBps: 2, transaction: null }, 10_000_000n);
  assert.equal(quote.inputAmount, "10");
  assert.equal(quote.outputAmount, "9.985");
  assert.equal(quote.router, "metis");
  assert.equal(quote.transaction, null);
  assert.equal(quote.quoteOnly, true);
});

test("rejects transaction-bearing or mismatched quote responses", () => {
  assert.throws(() => normalizeSolanaOrder({ inAmount: "10000000", outAmount: "10000000", router: "metis", transaction: "base64" }, 10_000_000n), /quote-only/);
  assert.throws(() => normalizeSolanaOrder({ inAmount: "1", outAmount: "10000000", router: "metis", transaction: null }, 10_000_000n), /did not match/);
});

function mockMintAccount() {
  const data = Buffer.alloc(82);
  data[44] = 6; // decimals
  data[45] = 1; // initialized
  return { owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", data: [data.toString("base64"), "base64"] };
}

test("reads and validates both stablecoin mint accounts from confirmed Solana mainnet", async () => {
  let call;
  const fakeFetch = async (url, init) => {
    call = { url, init };
    return { ok: true, status: 200, text: async () => JSON.stringify({ result: { context: { slot: 123 }, value: [mockMintAccount(), mockMintAccount()] } }) };
  };
  const result = await verifySolanaStablecoinMints(fakeFetch);
  assert.equal(call.url, SOLANA_RPC_URL);
  assert.equal(call.init.method, "POST");
  assert.equal(result.slot, 123);
});

test("quote helper checks mints, then calls Jupiter GET /order without a wallet", async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const text = String(url) === SOLANA_RPC_URL
      ? JSON.stringify({ result: { context: { slot: 456 }, value: [mockMintAccount(), mockMintAccount()] } })
      : JSON.stringify({ inAmount: "10000000", outAmount: "9990000", router: "dflow", transaction: null });
    return { ok: true, status: 200, text: async () => text };
  };
  const quote = await solanaQuote(10_000_000n, fakeFetch);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].init.method, undefined);
  assert.equal(new URL(calls[1].url).pathname, "/swap/v2/order");
  assert.equal(new URL(calls[1].url).searchParams.has("taker"), false);
  assert.equal(quote.outputAmount, "9.99");
  assert.equal(quote.mintRpcSlot, 456);
});
