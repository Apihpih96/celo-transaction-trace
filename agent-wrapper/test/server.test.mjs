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

test("serves the registered Concordium Agent Card without changing the legacy card", async () => {
  const { createHash } = await import("node:crypto");
  await withServer(async (base) => {
    const response = await fetch(`${base}/concordium-agent-card.json`);
    const raw = await response.text();
    const card = JSON.parse(raw);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(card.url, "https://celo-agent-wrapper.onrender.com/concordium-agent-card.json");
    assert.equal(card.capabilities.extensions[0].params.tokenAddress, "ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:JyP9UR4v2wZp4QAadLqUB");
    assert.deepEqual(card.registrations, [{ agentId: 1308, agentRegistry: "ccd:4221332d34e1694168c2a0c0b3fd0f27:12802.0" }]);
    assert.match(card.capabilities.extensions[0].params.owner.account, /^ccd:/);
    assert.equal(createHash("sha256").update(raw).digest("hex"), "193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b");
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


test("serves the guarded registration helper and its exact prepared transaction details", async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/register`);
    const pageText = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /script-src 'self' 'wasm-unsafe-eval'/);
    assert.doesNotMatch(page.headers.get("content-security-policy"), /'unsafe-eval'(?!')/);
    assert.match(pageText, /Nothing is signed automatically/);
    assert.match(pageText, /Request wallet transaction review/);
    const bundle = await fetch(`${base}/register-client.bundle.js`);
    const bundleText = await bundle.text();
    assert.equal(bundle.status, 200);
    assert.equal(bundle.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.match(bundleText, /sign_and_send_transaction/);
    const infoResponse = await fetch(`${base}/api/concordium/register-info`);
    const info = await infoResponse.json();
    assert.equal(info.network, "testnet");
    assert.equal(info.contract.index, 12802);
    assert.equal(info.account, "3oVHGTC3r3yFiRprS1t6YZiMnarV96CVbGw6xDPg2FisWav27M");
    assert.equal(info.cardSha256, "193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b");
    assert.ok(info.parameterHex.includes(info.cardSha256));
  });
});
