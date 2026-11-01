const form = document.querySelector("#quote-form");
const pair = document.querySelector("#pair");
const amount = document.querySelector("#amount");
const button = document.querySelector("#preview-button");
const loading = document.querySelector("#loading");
const errorBox = document.querySelector("#error");
const resultBox = document.querySelector("#result");
const outcome = document.querySelector(".outcome");
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

function setBusy(busy) {
  button.disabled = busy;
  button.querySelector("span:first-child").textContent = busy ? "Checking…" : "Preview route";
  loading.hidden = !busy;
  errorBox.hidden = true;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  resultBox.hidden = true;
}

function safeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("The quote response contained an invalid amount.");
  return number;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pairName = pair.value;
  const amountText = amount.value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(amountText) || Number(amountText) < 0.01 || Number(amountText) > 1000) {
    showError("Enter an amount from 0.01 to 1,000 USDT, with up to 6 decimal places.");
    return;
  }
  setBusy(true);
  resultBox.hidden = true;
  try {
    const response = await fetch(`/api/quote?pair=${encodeURIComponent(pairName)}&amount=${encodeURIComponent(amountText)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No indicative route is available for those inputs.");
    const start = safeNumber(data.amount);
    const mid = safeNumber(data.intermediate);
    const finish = safeNumber(data.returnAmount);
    const delta = safeNumber(data.delta);
    const pct = safeNumber(data.roiPct);
    document.querySelector("#result-title").textContent = `USDT ↔ ${pairName}`;
    document.querySelector("#leg-one").textContent = `${money.format(start)} USDT → ${money.format(mid)} ${pairName}`;
    document.querySelector("#leg-two").textContent = `${money.format(mid)} ${pairName} → ${money.format(finish)} USDT`;
    const sign = delta > 0 ? "+" : "";
    document.querySelector("#delta").textContent = `${sign}${money.format(delta)} USDT`;
    document.querySelector("#return-pct").textContent = `${sign}${pct.toFixed(4)}%`;
    document.querySelector("#sampled-time").textContent = `sampled ${new Date(data.sampledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    document.querySelector("#disclaimer").textContent = `${data.disclaimer} Levels timestamp: ${data.levelsAsOf ? new Date(data.levelsAsOf).toLocaleString() : "not supplied"}.`;
    outcome.classList.toggle("negative", delta < 0);
    resultBox.hidden = false;
  } catch (error) {
    showError(`${error.message} Nothing was signed or sent.`);
  } finally {
    setBusy(false);
  }
});

// Load a real read-only preview on first open; never use a fabricated sample.
form.requestSubmit();
