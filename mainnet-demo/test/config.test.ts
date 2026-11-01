import assert from "node:assert/strict";
import test from "node:test";
import { FACILITATOR_URL, NETWORK, RPC_URL, USAT, USAT_NAME, USAT_VERSION, readConfig } from "../src/config.js";

const valid = { X402_PAY_TO: `0x${"1".repeat(40)}`, X402_PRICE_USAT: "10000" };

test("mainnet USA₮ constants are the documented payment rail", () => {
  assert.equal(NETWORK, "eip155:42220");
  assert.equal(FACILITATOR_URL, "https://api.x402.celo.org");
  assert.equal(RPC_URL, "https://forno.celo.org");
  assert.equal(USAT.toLowerCase(), "0xd2ab3c9a02dbbab236bfec45d1d755df4267f771");
  assert.equal(USAT_NAME, "Tether America USD");
  assert.equal(USAT_VERSION, "1");
});

test("settlement is disabled by default; price and seller address are explicit", () => {
  assert.deepEqual(readConfig(valid), { payTo: valid.X402_PAY_TO, price: "10000", settlementEnabled: false, apiKey: "" });
});

test("missing or malformed mainnet parameters fail closed", () => {
  assert.throws(() => readConfig({ X402_PRICE_USAT: "10000" }), /X402_PAY_TO/);
  assert.throws(() => readConfig({ ...valid, X402_PAY_TO: "0x123" }), /X402_PAY_TO/);
  assert.throws(() => readConfig({ ...valid, X402_PRICE_USAT: "0.01" }), /raw USA₮ units/);
  assert.throws(() => readConfig({ ...valid, X402_ENABLE_SETTLEMENT: "yes" }), /exactly true or false/);
});

test("enabling settlement requires a server-side facilitator key", () => {
  assert.throws(() => readConfig({ ...valid, X402_ENABLE_SETTLEMENT: "true" }), /X402_API_KEY is missing/);
  assert.equal(readConfig({ ...valid, X402_ENABLE_SETTLEMENT: "true", X402_API_KEY: "server-secret" }).settlementEnabled, true);
});
