import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyzeReceipt } from "./receipt.mjs";
import { getTestnetStatus, verifyTestnetBadge } from "./concordium.mjs";

const MAX_BODY_BYTES = 256 * 1024;
const concordiumAgentCard = readFileSync(new URL("./concordium-agent-card.json", import.meta.url), "utf8");

function publicOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("PUBLIC_BASE_URL must use HTTP or HTTPS.");
    return url.origin;
  }
  const forwardedProto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim();
  const protocol = forwardedProto === "https" || req.socket.encrypted ? "https" : "http";
  return `${protocol}://${req.headers.host || "127.0.0.1"}`;
}

function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error("Request body exceeds 256 KiB."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }); }
}

export function createAgentServer({ fetchImpl = fetch } = {}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        return json(res, 200, { ok: true, service: "Celo Transaction Trace agent wrapper", mode: "read-only" });
      }
      if (req.method === "GET" && url.pathname === "/agent-card.json") {
        const origin = publicOrigin(req);
        return json(res, 200, {
          type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
          name: "Celo Transaction Trace Agent Wrapper (prototype)",
          description: "A read-only prototype service that analyzes supplied transaction receipt JSON and checks Concordium testnet registry badges. This prototype is not registered on Concordium.",
          services: [
            { name: "receipt-analysis", endpoint: `${origin}/api/analyze-receipt`, description: "POST supplied receipt JSON for offline parsing; no receipt lookup or signing." },
            { name: "concordium-testnet-status", endpoint: `${origin}/api/concordium/testnet`, network: "ccd:testnet", description: "Read testnet registry contract and node/indexer status from Concordium's hosted MCP." },
            { name: "concordium-testnet-badge-check", endpoint: `${origin}/api/concordium/badges/{token_address}`, network: "ccd:testnet", description: "Read-only verification of a supplied Concordium testnet agent badge." },
          ],
          x402Support: false,
          active: true,
          registrations: [],
        });
      }
      if (req.method === "GET" && url.pathname === "/concordium-agent-card.json") {
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        return res.end(concordiumAgentCard);
      }
      if (req.method === "POST" && url.pathname === "/api/analyze-receipt") {
        const body = await readJson(req);
        const receipt = body && typeof body === "object" && !Array.isArray(body) && "receipt" in body ? body.receipt : body;
        return json(res, 200, { analysis: analyzeReceipt(receipt) });
      }
      if (req.method === "GET" && url.pathname === "/api/concordium/testnet") {
        return json(res, 200, await getTestnetStatus(fetchImpl));
      }
      const badgeMatch = req.method === "GET" && url.pathname.match(/^\/api\/concordium\/badges\/([^/]+)$/);
      if (badgeMatch) {
        let tokenAddress;
        try { tokenAddress = decodeURIComponent(badgeMatch[1]); }
        catch { return json(res, 400, { error: "Malformed token address." }); }
        return json(res, 200, { verification: await verifyTestnetBadge(tokenAddress, fetchImpl) });
      }
      return json(res, 404, { error: "Not found." });
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      return json(res, status, { error: error instanceof Error ? error.message : "Request failed." });
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 4174);
  const host = process.env.HOST ?? "127.0.0.1";
  createAgentServer().listen(port, host, () => console.log(`Read-only agent wrapper: http://${host}:${port}`));
}
