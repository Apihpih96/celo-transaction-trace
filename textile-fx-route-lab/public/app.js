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
  // Clear the previous error when a new request starts, not when it finishes.
  if (busy) errorBox.hidden = true;
}

function showError(message) {
  const text = String(message || "Something went wrong.").trim();
  errorBox.textContent = /[.!?]$/.test(text) ? text : `${text}.`;
  errorBox.hidden = false;
  resultBox.hidden = true;
}

function safeNumber(value) {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && value.trim() === "")) {
    throw new Error("The quote response contained an invalid amount.");
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("The quote response contained an invalid amount.");
  return number;
}

let initialRetryLeft = 0;

function isNetworkError(error) {
  return error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(error && error.message));
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The quote service returned an unexpected response (HTTP ${response.status}). Please try again shortly`);
  }
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
    const data = typeof response.text === "function" ? await readJson(response) : await response.json();
    if (!response.ok) throw new Error(data.error || "No indicative route is available for those inputs.");
    const start = safeNumber(data.amount);
    const mid = safeNumber(data.intermediate);
    const finish = safeNumber(data.returnAmount);
    const delta = safeNumber(data.delta);
    const pct = data.roiPct == null ? null : safeNumber(data.roiPct);
    document.querySelector("#result-title").textContent = `USDT ↔ ${pairName}`;
    document.querySelector("#leg-one").textContent = `${money.format(start)} USDT → ${money.format(mid)} ${pairName}`;
    document.querySelector("#leg-two").textContent = `${money.format(mid)} ${pairName} → ${money.format(finish)} USDT`;
    const sign = delta > 0 ? "+" : "";
    document.querySelector("#delta").textContent = `${sign}${money.format(delta)} USDT`;
    document.querySelector("#return-pct").textContent = pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(4)}%`;
    document.querySelector("#sampled-time").textContent = `sampled ${new Date(data.sampledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    document.querySelector("#disclaimer").textContent = `${data.disclaimer} Levels timestamp: ${data.levelsAsOf ? new Date(data.levelsAsOf).toLocaleString() : "not supplied"}.`;
    outcome.classList.toggle("negative", delta < 0);
    resultBox.hidden = false;
    initialRetryLeft = 0;
  } catch (error) {
    if (isNetworkError(error) && initialRetryLeft > 0 && typeof setTimeout === "function") {
      // The free host can be waking up on first open: retry the first load once quietly.
      initialRetryLeft -= 1;
      setTimeout(() => form.requestSubmit(), 4000);
      return;
    }
    const message = isNetworkError(error)
      ? "Couldn't reach the quote service. It may be waking up; press Preview route again in a moment"
      : error.message;
    showError(`${String(message).replace(/[.!?]?\s*$/, ".")} Nothing was signed or sent.`);
  } finally {
    setBusy(false);
  }
});

// Load a real read-only preview on first open; never use a fabricated sample.
initialRetryLeft = 1;
form.requestSubmit();


// Separate Solana quote-only path. It makes one request only when the user asks.
const solanaForm = document.querySelector("#solana-form");
const solanaAmount = document.querySelector("#solana-amount");
const solanaButton = document.querySelector("#solana-button");
const solanaLoading = document.querySelector("#solana-loading");
const solanaError = document.querySelector("#solana-error");
const solanaResult = document.querySelector("#solana-result");

solanaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amountText = solanaAmount.value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(amountText) || Number(amountText) < 0.01 || Number(amountText) > 1000) {
    solanaError.textContent = "Enter an amount from 0.01 to 1,000 USDC, with up to 6 decimal places.";
    solanaError.hidden = false;
    solanaResult.hidden = true;
    return;
  }
  solanaButton.disabled = true;
  solanaButton.querySelector("span:first-child").textContent = "Checking…";
  solanaLoading.hidden = false;
  solanaError.hidden = true;
  solanaResult.hidden = true;
  try {
    const response = await fetch(`/api/solana-quote?amount=${encodeURIComponent(amountText)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Jupiter quote unavailable.");
    if (data.transaction !== null || data.quoteOnly !== true) throw new Error("The response was not quote-only; no transaction was used.");
    document.querySelector("#solana-result-title").textContent = `${money.format(safeNumber(data.inputAmount))} USDC → ${money.format(safeNumber(data.outputAmount))} USDT`;
    document.querySelector("#solana-router").textContent = data.router;
    document.querySelector("#solana-fee").textContent = data.feeBps === null ? "Not supplied" : `${data.feeBps} bps`;
    document.querySelector("#solana-impact").textContent = data.priceImpactPct === null ? "Not supplied" : `${data.priceImpactPct}%`;
    document.querySelector("#solana-slot").textContent = String(data.mintRpcSlot);
    document.querySelector("#solana-sampled-time").textContent = `sampled ${new Date(data.sampledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    document.querySelector("#solana-disclaimer").textContent = data.disclaimer;
    solanaResult.hidden = false;
  } catch (error) {
    solanaError.textContent = `${error.message} Nothing was signed or sent.`;
    solanaError.hidden = false;
  } finally {
    solanaLoading.hidden = true;
    solanaButton.disabled = false;
    solanaButton.querySelector("span:first-child").textContent = "Fetch quote";
  }
});
