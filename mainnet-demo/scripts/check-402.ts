// This sends a request without a payment header; it cannot sign or settle a payment.
import "dotenv/config";

const url = process.env.MAINNET_DEMO_URL ?? "http://localhost:3002/decode";
const response = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ transactionHash: `0x${"0".repeat(64)}` }),
});
if (response.status !== 402) {
  console.error(`Expected an unpaid HTTP 402; got ${response.status}.`);
  console.error(await response.text());
  process.exit(1);
}
const header = response.headers.get("payment-required");
if (!header) throw new Error("HTTP 402 lacked the PAYMENT-REQUIRED header.");
const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
  accepts?: Array<{ scheme?: string; network?: string; asset?: string; amount?: string; payTo?: string; extra?: { name?: string; version?: string } }>;
};
const requirement = decoded.accepts?.find((item) => item.network === "eip155:42220");
if (!requirement || requirement.scheme !== "exact" || requirement.asset?.toLowerCase() !== "0xd2ab3c9a02dbbab236bfec45d1d755df4267f771" || !requirement.amount || !/^0x[0-9a-fA-F]{40}$/.test(requirement.payTo ?? "") || requirement.extra?.name !== "Tether America USD" || requirement.extra?.version !== "1") {
  throw new Error(`Unexpected mainnet USA₮ payment terms: ${JSON.stringify(decoded)}`);
}
console.log(JSON.stringify({ status: response.status, requirement }, null, 2));
console.log("Unpaid mainnet 402 check passed; no payment was signed or settled.");
