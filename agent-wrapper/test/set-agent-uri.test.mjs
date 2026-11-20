import test from "node:test";
import assert from "node:assert/strict";
import { createAgentServer } from "../src/server.mjs";

async function withServer(fn) {
  const server = createAgentServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("serves the explicit owner-reviewed setAgentURI page and exact prepared details", async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/set-agent-uri`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /Review this update in wallet/);
    assert.match(html, /Nothing happens until you request the wallet review/);
    assert.match(html, /not an app to install/i);

    const response = await fetch(`${base}/api/concordium/set-agent-uri-info`);
    const info = await response.json();
    assert.equal(response.status, 200);
    assert.equal(info.network, "testnet");
    assert.equal(info.contract.index, 12802);
    assert.equal(info.contract.subindex, 0);
    assert.equal(info.entrypoint, "CIS-8004.setAgentURI");
    assert.equal(info.tokenId, 1308);
    assert.equal(info.tokenIdHex, "1c05000000000000");
    assert.equal(info.account, "3oVHGTC3r3yFiRprS1t6YZiMnarV96CVbGw6xDPg2FisWav27M");
    assert.equal(info.agentUri, "https://celo-agent-wrapper.onrender.com/concordium-agent-card.json");
    assert.equal(info.cardSha256, "193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b");
    assert.equal(info.parameterHex, "081c05000000000000014200000068747470733a2f2f63656c6f2d6167656e742d777261707065722e6f6e72656e6465722e636f6d2f636f6e636f726469756d2d6167656e742d636172642e6a736f6e01193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b");
    assert.deepEqual(info.parameters, {
      token_id: "1c05000000000000",
      agent_uri: { Some: [info.agentUri] },
      metadata_hash: { Some: [Array.from(Buffer.from(info.cardSha256, "hex"))] },
    });
  });
});
