import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ContractName, EntrypointName, serializeUpdateContractParameters } from "@concordium/web-sdk";

export const SET_AGENT_URI_INFO = Object.freeze({
  network: "testnet",
  genesisHash: "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796",
  account: "3oVHGTC3r3yFiRprS1t6YZiMnarV96CVbGw6xDPg2FisWav27M",
  contract: Object.freeze({ index: 12802, subindex: 0 }),
  contractName: "CIS-8004",
  entrypoint: "CIS-8004.setAgentURI",
  tokenId: 1308,
  tokenIdHex: "1c05000000000000",
  tokenAddress: "ccd:4221332d34e1694168c2a0c0b3fd0f27/cis-2:JyP9UR4v2wZp4QAadLqUB",
  agentUri: "https://celo-agent-wrapper.onrender.com/concordium-agent-card.json",
  cardSha256: "193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b",
  parameterHex: "081c05000000000000014200000068747470733a2f2f63656c6f2d6167656e742d777261707065722e6f6e72656e6465722e636f6d2f636f6e636f726469756d2d6167656e742d636172642e6a736f6e01193f481b9085081d31cd591ee25058281d7ef37921131b965ee15f1091adbb2b",
  amountMicroCcd: "0",
  maxEnergy: 30000,
});

const schemaBase64 = readFileSync(new URL("./agent_registry_schema.b64", import.meta.url), "utf8").trim();
const cardBytes = readFileSync(new URL("./concordium-agent-card.json", import.meta.url));

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function buildSetAgentUriInfo({ card = cardBytes, schema = schemaBase64 } = {}) {
  const actualHash = createHash("sha256").update(card).digest("hex");
  if (actualHash !== SET_AGENT_URI_INFO.cardSha256) {
    throw new Error("The local Agent Card does not match the prepared on-chain hash.");
  }

  const parameters = {
    token_id: SET_AGENT_URI_INFO.tokenIdHex,
    agent_uri: { Some: [SET_AGENT_URI_INFO.agentUri] },
    metadata_hash: { Some: [Array.from(Buffer.from(actualHash, "hex"))] },
  };
  const serialized = serializeUpdateContractParameters(
    ContractName.fromString(SET_AGENT_URI_INFO.contractName),
    EntrypointName.fromString("setAgentURI"),
    parameters,
    toArrayBuffer(Buffer.from(schema, "base64")),
  );
  const parameterHex = Buffer.from(serialized.buffer, serialized.byteOffset, serialized.byteLength).toString("hex");
  if (parameterHex !== SET_AGENT_URI_INFO.parameterHex) {
    throw new Error("The setAgentURI payload does not match the exact prepared transaction.");
  }

  return { ...SET_AGENT_URI_INFO, parameters, schemaBase64: schema };
}
