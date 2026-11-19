const MCP_URL = "https://agent-registry-mcp.concordium.com/mcp";

async function callTool(fetchImpl, name, args, id) {
  const response = await fetchImpl(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Concordium MCP returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`Concordium MCP HTTP ${response.status}.`);
  if (payload.error) throw new Error(payload.error.message || "Concordium MCP request failed.");
  const result = payload.result;
  if (!result || result.isError) throw new Error("Concordium MCP tool failed.");
  const content = result.content?.find((item) => item.type === "text")?.text;
  if (typeof content !== "string") return result.structuredContent ?? result;
  try { return JSON.parse(content); } catch { throw new Error("Concordium MCP returned an unreadable tool result."); }
}

export async function getTestnetStatus(fetchImpl = fetch) {
  const [contracts, status] = await Promise.all([
    callTool(fetchImpl, "contract_info", { network: "testnet" }, 1),
    callTool(fetchImpl, "network_status", { network: "testnet" }, 2),
  ]);
  if (contracts.network !== "testnet" || status.network !== "testnet") throw new Error("Concordium returned a different network than requested.");
  return { network: "testnet", contracts, status };
}

export async function verifyTestnetBadge(tokenAddress, fetchImpl = fetch) {
  if (typeof tokenAddress !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{8,64}$/.test(tokenAddress)) {
    throw Object.assign(new TypeError("Provide a Concordium CIS-2 token address in base58 format."), { statusCode: 400 });
  }
  const result = await callTool(fetchImpl, "check_badge", { id: tokenAddress, network: "testnet" }, 3);
  if (result.network !== "testnet") throw new Error("Concordium returned a different network than requested.");
  return result;
}
