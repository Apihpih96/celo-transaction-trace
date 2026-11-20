import test from "node:test";
import assert from "node:assert/strict";
import { buildRegistrationInfo, AGENT_CARD_URL, EXPECTED_ACCOUNT } from "../src/registration.mjs";

test("CIS-8004 registration uses the corrected card SHA-256 in its parameter", () => {
  const info = buildRegistrationInfo();
  assert.equal(info.cardSha256, "193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b");
  assert.equal(info.account, EXPECTED_ACCOUNT);
  assert.equal(info.agentUri, AGENT_CARD_URL);
  assert.equal(info.network, "testnet");
  assert.equal(info.contract.index, 12802);
  assert.equal(info.contract.subindex, 0);
  assert.equal(info.entrypoint, "CIS-8004.register");
  assert.equal(info.amountMicroCcd, "0");
  assert.equal(info.maxEnergy, 30000);
  assert.ok(info.parameterHex.includes(info.cardSha256));
  assert.equal(info.parameterHex, "014200000068747470733a2f2f63656c6f2d6167656e742d777261707065722e6f6e72656e6465722e636f6d2f636f6e636f726469756d2d6167656e742d636172642e6a736f6e01193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b0000000000");
});

test("registration parameter changes when the card changes", () => {
  const first = buildRegistrationInfo({ card: Buffer.from("card A") });
  const second = buildRegistrationInfo({ card: Buffer.from("card B") });
  assert.notEqual(first.cardSha256, second.cardSha256);
  assert.notEqual(first.parameterHex, second.parameterHex);
  assert.ok(second.parameterHex.includes(second.cardSha256));
});
