import "dotenv/config";

import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Address } from "viem";

// Intentionally fixed to Celo Sepolia; this demo has no mainnet switch.
export const NETWORK = "testnet" as const;
export const CAIP2: `eip155:${string}` = "eip155:11142220";
export const RPC_URL = "https://forno.celo-sepolia.celo-testnet.org";
export const EXPLORER_URL = "https://celo-sepolia.blockscout.com";
export const USDC = "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as Address;
export const PRICE = process.env.X402_PRICE ?? "10000"; // 0.01 test USDC (6 decimals)
export const PAY_TO = process.env.X402_PAY_TO;

export const facilitator = new HTTPFacilitatorClient({
  url: "https://api.x402.sepolia.celo.org",
  createAuthHeaders: async () => {
    const headers = { "X-API-Key": process.env.X402_API_KEY ?? "" };
    return { verify: headers, settle: headers, supported: headers };
  },
});
