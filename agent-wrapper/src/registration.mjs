import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ContractName, EntrypointName, serializeUpdateContractParameters } from "@concordium/web-sdk";

export const TESTNET_GENESIS_HASH = "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796";
export const EXPECTED_ACCOUNT = "3oVHGTC3r3yFiRprS1t6YZiMnarV96CVbGw6xDPg2FisWav27M";
export const AGENT_CARD_URL = "https://celo-agent-wrapper.onrender.com/concordium-agent-card.json";
export const REGISTRY = Object.freeze({ index: 12802, subindex: 0 });
export const WALLETCONNECT_PROJECT_ID = "76a1518324cb4b4086ec786f75cebab0";
export const ENTRYPOINT = "CIS-8004.register";
export const MAX_ENERGY = 30000;

const schemaBase64 = readFileSync(new URL("./agent_registry_schema.b64", import.meta.url), "utf8").trim();
const cardBytes = readFileSync(new URL("./concordium-agent-card.json", import.meta.url));

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function buildRegistrationInfo({ card = cardBytes, schema = schemaBase64 } = {}) {
  const cardSha256 = createHash("sha256").update(card).digest("hex");
  const parameters = {
    agent_uri: { Some: [AGENT_CARD_URL] },
    external_reference: { None: [] },
    initial_metadata: [],
    metadata_hash: { Some: [Array.from(Buffer.from(cardSha256, "hex"))] },
  };
  const schemaBuffer = Buffer.from(schema, "base64");
  const message = serializeUpdateContractParameters(
    ContractName.fromString("CIS-8004"),
    EntrypointName.fromString("register"),
    parameters,
    toArrayBuffer(schemaBuffer),
  );
  const parameterHex = Buffer.from(message.buffer, message.byteOffset, message.byteLength).toString("hex");
  return {
    ready: true,
    network: "testnet",
    genesisHash: TESTNET_GENESIS_HASH,
    account: EXPECTED_ACCOUNT,
    contract: REGISTRY,
    entrypoint: ENTRYPOINT,
    amountMicroCcd: "0",
    maxEnergy: MAX_ENERGY,
    agentUri: AGENT_CARD_URL,
    cardSha256,
    parameterHex,
    schemaBase64: schema,
    parameters,
  };
}
