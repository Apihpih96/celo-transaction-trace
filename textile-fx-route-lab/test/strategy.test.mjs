import test from "node:test";
import assert from "node:assert/strict";
import { TOKENS, corridorPair, formatUnits, parseUnits, roundTripResult } from "../strategy.mjs";

test("parses USDT amounts exactly in base units", () => {
  assert.equal(parseUnits("10.25", 6), 10250000n);
  assert.equal(formatUnits(10250000n, 6), "10.25");
});

test("rejects malformed, zero and excess precision amounts", () => {
  for (const bad of ["0", "-1", "1e3", "1.0000001", "NaN"]) {
    assert.throws(() => parseUnits(bad, 6));
  }
});

test("calculates indicative change with integer input values", () => {
  const result = roundTripResult(10000000n, 9996024n);
  assert.equal(result.delta, -3976n);
  assert.equal(formatUnits(result.delta, 6), "-0.003976");
  assert.ok(Math.abs(result.roiPct - (-0.03976)) < 1e-10);
});

test("maps only the listed USDT/wARS corridor", () => {
  const result = corridorPair({ data: { pairs: [
    { sellToken: TOKENS.USDT.address, buyToken: TOKENS.wARS.address, levels: [] },
    { sellToken: TOKENS.wARS.address, buyToken: TOKENS.USDT.address, levels: [] },
  ] } }, "wARS");
  assert.ok(result.forward);
  assert.ok(result.reverse);
});
