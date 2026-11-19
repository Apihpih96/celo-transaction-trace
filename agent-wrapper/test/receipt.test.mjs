import test from "node:test";
import assert from "node:assert/strict";
import { analyzeReceipt } from "../src/receipt.mjs";

const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const addr = (hex) => `0x${"0".repeat(24)}${hex.repeat(40)}`;
const transfer = (from = "a", to = "b", value = "2a") => ({
  address: `0x${"c".repeat(40)}`,
  topics: [topic, addr(from), addr(to)],
  data: `0x${value.padStart(64, "0")}`,
});

test("decodes receipt metadata and ERC-20 transfer values without losing integer precision", () => {
  const result = analyzeReceipt({
    transactionHash: `0x${"1".repeat(64)}`,
    status: "0x1",
    blockNumber: "0x10",
    gasUsed: 21000,
    logs: [transfer("a", "b", "2000000000000001"), { topics: ["0xother"] }],
  });
  assert.equal(result.status, "success");
  assert.equal(result.blockNumber, "16");
  assert.equal(result.gasUsed, "21000");
  assert.equal(result.logCount, 2);
  assert.equal(result.erc20Transfers[0].rawValue, "2305843009213693953");
  assert.equal(result.erc20Transfers[0].token, `0x${"c".repeat(40)}`);
});

test("reports malformed Transfer logs and distinguishes failed or missing status", () => {
  const malformed = { topics: [topic, "0xbad", addr("b")], data: "0x00" };
  assert.equal(analyzeReceipt({ status: 0, logs: [malformed] }).status, "failed");
  assert.equal(analyzeReceipt({ logs: [malformed] }).status, "not_included");
  assert.equal(analyzeReceipt({ logs: [malformed] }).malformedTransferLogs, 1);
});

test("rejects non-receipt inputs", () => {
  assert.throws(() => analyzeReceipt([]), /logs array/);
  assert.throws(() => analyzeReceipt({}), /logs array/);
});
