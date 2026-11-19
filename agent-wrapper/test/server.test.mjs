import test from "node:test";
import assert from "node:assert/strict";
import { createAgentServer } from "../src/server.mjs";

async function withServer(fn, fetchImpl) {
  const server = createAgentServer({ fetchImpl });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("serves a local card that explicitly has no Concordium registration", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/agent-card.json`);
    const card = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(card.registrations, []);
    assert.match(card.description, /not registered on Concordium/);
    assert.equal(card.services.length, 3);
  });
});

test("serves the prepared pre-mint Concordium Agent Card without changing the legacy card", async () => {
  const { createHash } = await import("node:crypto");
  await withServer(async (base) => {
    const response = await fetch(`${base}/concordium-agent-card.json`);
    const raw = await response.text();
    const card = JSON.parse(raw);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(card.url, "https://celo-agent-wrapper.onrender.com/concordium-agent-card.json");
    assert.equal(card.capabilities.extensions[0].params.tokenAddress, null);
    assert.match(card.capabilities.extensions[0].params.owner.account, /^ccd:/);
    assert.equal(createHash("sha256").update(raw).digest("hex"), "4f15abfc8a6e0e015a816a350eeb7559af27797a7865ee5797c2c8a5e7cbb8dd");
    const legacy = await (await fetch(`${base}/agent-card.json`)).json();
    assert.deepEqual(legacy.registrations, []);
  });
});

test("runs HTTP receipt analysis and exposes the read-only testnet status/check routes", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const { id, params } = JSON.parse(options.body);
    calls.push(params);
    const value = params.name === "contract_info"
      ? { network: "testnet", cis8004_contract: { index: 12802, subindex: 0 }, cis8_contract: { index: 12801, subindex: 0 } }
      : params.name === "network_status"
        ? { network: "testnet", latest_block_height: 900 }
        : { network: "testnet", badge_valid: false, issues: [{ field: "card_fetch" }] };
    return new Response(JSON.stringify({ id, result: { content: [{ type: "text", text: JSON.stringify(value) }], isError: false } }));
  };
  await withServer(async (base) => {
    const receipt = await fetch(`${base}/api/analyze-receipt`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ receipt: { status: 1, logs: [] } }),
    });
    assert.equal((await receipt.json()).analysis.status, "success");
    const status = await fetch(`${base}/api/concordium/testnet`);
    assert.equal((await status.json()).contracts.cis8004_contract.index, 12802);
    const check = await fetch(`${base}/api/concordium/badges/JyP9TtQC3HCNrTYR3sc2T`);
    assert.equal((await check.json()).verification.badge_valid, false);
    assert.deepEqual(calls.map((call) => call.arguments.network), ["testnet", "testnet", "testnet"]);
  }, fetchImpl);
});

test("validates receipt bodies and bounds request size", async () => {
  await withServer(async (base) => {
    const bad = await fetch(`${base}/api/analyze-receipt`, { method: "POST", body: "nope" });
    assert.equal(bad.status, 400);
    const huge = await fetch(`${base}/api/analyze-receipt`, { method: "POST", body: JSON.stringify({ data: "x".repeat(270_000) }) });
    assert.equal(huge.status, 413);
  });
});
