import type { Address } from "viem";

export const NETWORK = "eip155:42220" as const;
export const NETWORK_NAME = "Celo Mainnet" as const;
export const FACILITATOR_URL = "https://api.x402.celo.org" as const;
export const RPC_URL = "https://forno.celo.org" as const;
export const EXPLORER_URL = "https://celoscan.io" as const;
export const USAT = "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771" as Address;
export const USAT_NAME = "Tether America USD" as const;
export const USAT_VERSION = "1" as const;

export type MainnetConfig = {
  payTo: Address;
  price: string;
  settlementEnabled: boolean;
  apiKey: string;
};

export function readConfig(env: Record<string, string | undefined>): MainnetConfig {
  const payTo = env.X402_PAY_TO?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    throw new Error("Set X402_PAY_TO to the intended Celo Mainnet seller address.");
  }
  const price = env.X402_PRICE_USAT?.trim() ?? "";
  if (!/^[1-9][0-9]*$/.test(price)) {
    throw new Error("Set X402_PRICE_USAT to a positive integer of raw USA₮ units (6 decimals).");
  }
  const rawEnabled = env.X402_ENABLE_SETTLEMENT?.trim().toLowerCase();
  if (rawEnabled && rawEnabled !== "true" && rawEnabled !== "false") {
    throw new Error("X402_ENABLE_SETTLEMENT must be exactly true or false.");
  }
  const settlementEnabled = rawEnabled === "true";
  const apiKey = env.X402_API_KEY?.trim() ?? "";
  if (settlementEnabled && !apiKey) {
    throw new Error("Settlement is enabled but X402_API_KEY is missing; keep settlement disabled until configured.");
  }
  return { payTo: payTo as Address, price, settlementEnabled, apiKey };
}
