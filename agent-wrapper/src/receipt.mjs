const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ADDRESS_TOPIC = /^0x0{24}[0-9a-f]{40}$/i;
const UINT = /^(?:0x[0-9a-f]+|[0-9]+)$/i;
const HASH = /^0x[0-9a-f]{64}$/i;

function decimal(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") return null;
  const text = String(value);
  if (!UINT.test(text)) return text;
  try { return BigInt(text).toString(10); } catch { return text; }
}

/** Decode only the supplied receipt JSON; this function never fetches a transaction. */
export function analyzeReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || !Array.isArray(receipt.logs)) {
    throw Object.assign(new TypeError("Expected a receipt object with a logs array."), { statusCode: 400 });
  }

  const transfers = [];
  let malformedTransferLogs = 0;
  for (const log of receipt.logs) {
    if (!log || !Array.isArray(log.topics) || typeof log.topics[0] !== "string" || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    const [fromTopic, toTopic] = [log.topics[1], log.topics[2]];
    if (typeof fromTopic !== "string" || !ADDRESS_TOPIC.test(fromTopic) ||
        typeof toTopic !== "string" || !ADDRESS_TOPIC.test(toTopic) ||
        typeof log.data !== "string" || !/^0x[0-9a-f]{64}$/i.test(log.data)) {
      malformedTransferLogs++;
      continue;
    }
    transfers.push({
      token: typeof log.address === "string" && /^0x[0-9a-f]{40}$/i.test(log.address) ? log.address : null,
      from: `0x${fromTopic.slice(-40)}`,
      to: `0x${toTopic.slice(-40)}`,
      rawValue: BigInt(log.data).toString(10),
    });
  }

  const rawStatus = receipt.status;
  const status = rawStatus == null ? "not_included" :
    ["0x1", "1"].includes(String(rawStatus).toLowerCase()) ? "success" :
    ["0x0", "0"].includes(String(rawStatus).toLowerCase()) ? "failed" : "unrecognized";

  return {
    transactionHash: typeof receipt.transactionHash === "string" && HASH.test(receipt.transactionHash) ? receipt.transactionHash : null,
    status,
    rawStatus: rawStatus == null ? null : String(rawStatus),
    blockNumber: decimal(receipt.blockNumber),
    gasUsed: decimal(receipt.gasUsed),
    logCount: receipt.logs.length,
    erc20Transfers: transfers,
    malformedTransferLogs,
    note: "Transfer values are raw token units; token decimals and transaction intent are not inferred.",
  };
}
