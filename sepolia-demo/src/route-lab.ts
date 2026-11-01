export const CELO_CHAIN_ID = 42220;
export const TEXTILE_API = "https://api.textilecredit.com/v2";

export const TOKENS = Object.freeze({
  USDT: Object.freeze({ address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 }),
  cNGN: Object.freeze({ address: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f", decimals: 6 }),
  USDC: Object.freeze({ address: "0xceba9300f2b948710d2653dd7b07f33a8b32118c", decimals: 6 }),
  wARS: Object.freeze({ address: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D", decimals: 18 }),
  wBRL: Object.freeze({ address: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0", decimals: 18 }),
  wCOP: Object.freeze({ address: "0x8a1D45e102e886510e891d2Ec656a708991e2D76", decimals: 18 }),
  wMXN: Object.freeze({ address: "0x337E7456B420bD3481e7FA61fA9850343d610d34", decimals: 18 }),
  IDRX: Object.freeze({ address: "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22", decimals: 2 }),
  CELO: Object.freeze({ address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18 }),
  WETH: Object.freeze({ address: "0xD221812de1BD094f35587EE8E174B07B6167D9Af", decimals: 18 }),
  USAT: Object.freeze({ address: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", decimals: 6 }),
  "G$": Object.freeze({ address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", decimals: 18 }),
});

export function parseUnits(value: string, decimals: number): bigint {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Amount must be a positive decimal number (no signs or exponent notation).");
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimal places.`);
  const units = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (units <= 0n) throw new Error("Amount must be greater than zero.");
  return units;
}

export function formatUnits(value: bigint | string, decimals: number, maxFractionDigits = decimals): string {
  const units = BigInt(value);
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  let fraction = (absolute % base).toString().padStart(decimals, "0");
  fraction = fraction.slice(0, Math.max(0, Math.min(decimals, maxFractionDigits))).replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function roundTripResult(startUnits: bigint, finishUnits: bigint): { delta: bigint; roiPct: number } {
  if (startUnits <= 0n) throw new Error("Starting amount must be greater than zero.");
  const delta = finishUnits - startUnits;
  return { delta, roiPct: Number(delta) / Number(startUnits) * 100 };
}

type LevelPair = { sellToken?: string; buyToken?: string; levels?: unknown[]; minSellAmount?: string; maxSellAmount?: string };
type LevelsResponse = { data?: { pairs?: LevelPair[]; asOf?: string | null } };

export function corridorPair(levelsData: LevelsResponse, assetSymbol: keyof typeof TOKENS): { forward?: LevelPair; reverse?: LevelPair } {
  const asset = TOKENS[assetSymbol];
  const usdt = TOKENS.USDT;
  if (!asset || assetSymbol === "USDT") throw new Error(`Unsupported corridor: ${assetSymbol}`);
  const pairs = levelsData?.data?.pairs;
  if (!Array.isArray(pairs)) throw new Error("Textile returned an unexpected levels response.");
  const equal = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();
  const forward = pairs.find((p) => equal(p.sellToken, usdt.address) && equal(p.buyToken, asset.address));
  const reverse = pairs.find((p) => equal(p.sellToken, asset.address) && equal(p.buyToken, usdt.address));
  return { forward, reverse };
}
