import test from "node:test";
import assert from "node:assert/strict";
import { getTestnetStatus, verifyTestnetBadge } from "../src/concordium.mjs";

function mcpFetch(responses, requests) {
  return async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    const id = JSON.parse(options.body).id;
    const value = responses[id];
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id,
      result: { content: [{ type: "text", text: JSON.stringify(value) }], isError: false },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
}

test("reads testnet contract and network status only", async () => {
  const requests = [];
  const result = await getTestnetStatus(mcpFetch({
    1: { network: "testnet", cis8004_contract: { index: 12802, subindex: 0 }, cis8_contract: { index: 12801, subindex: 0 } },
    2: { network: "testnet", latest_block_height: 123, explorer_base: "https://testnet.ccdscan.io" },
  }, requests));
  assert.equal(result.contracts.cis8004_contract.index, 12802);
  assert.equal(result.contracts.cis8_contract.index, 12801);
  assert.deepEqual(requests.map((r) => r.payload.params.arguments.network), ["testnet", "testnet"]);
  assert.ok(requests.every((r) => r.url === "https://agent-registry-mcp.concordium.com/mcp"));
});

test("checks a supplied badge on testnet and rejects malformed addresses before network access", async () => {
  const requests = [];
  const badge = "JyP9TtQC3HCNrTYR3sc2T";
  const result = await verifyTestnetBadge(badge, mcpFetch({ 3: { network: "testnet", badge_valid: true, token_address: badge } }, requests));
  assert.equal(result.badge_valid, true);
  assert.deepEqual(requests[0].payload.params.arguments, { id: badge, network: "testnet" });
  await assert.rejects(() => verifyTestnetBadge("not a badge", mcpFetch({}, requests)), /base58 format/);
  assert.equal(requests.length, 1);
});

test("does not silently accept a response for the wrong network", async () => {
  const fetchImpl = mcpFetch({
    1: { network: "mainnet" },
    2: { network: "testnet" },
  }, []);
  await assert.rejects(() => getTestnetStatus(fetchImpl), /different network/);
});
