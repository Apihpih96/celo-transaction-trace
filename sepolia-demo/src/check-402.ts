// Safe, unpaid smoke test: confirms the server offers a Sepolia x402 requirement.
// It never creates a payment authorization or calls facilitator settlement.
import "dotenv/config";

const base = process.env.SELLER_URL ?? "http://localhost:3001/decode";
const txHash = process.env.SEPOLIA_TX_HASH ?? `0x${"0".repeat(64)}`;
const response = await fetch(base, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ transactionHash: txHash }),
});

if (response.status !== 402) {
  console.error(`Expected an unpaid HTTP 402; got ${response.status}.`);
  console.error(await response.text());
  process.exit(1);
}
const requirements = response.headers.get("payment-required");
if (!requirements) {
  throw new Error("Got HTTP 402 without the PAYMENT-REQUIRED header");
}
const decoded = JSON.parse(Buffer.from(requirements, "base64").toString("utf8"));
console.log(JSON.stringify({ status: response.status, paymentRequirements: decoded }, null, 2));
if (JSON.stringify(decoded).includes("42220") && !JSON.stringify(decoded).includes("11142220")) {
  throw new Error("Unexpected mainnet chain identifier in payment requirements");
}
console.log("Unpaid 402 smoke test passed; no payment was signed or settled.");
