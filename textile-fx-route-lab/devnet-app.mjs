import { createDevnetConnection, sendDevnetMemo, DEFAULT_MEMO } from "./devnet-core.mjs";

const $ = (id) => document.getElementById(id);
const connectButton = $("connect-wallet");
const sendButton = $("record-proof");
const walletStatus = $("wallet-status");
const balance = $("wallet-balance");
const message = $("status-message");
const result = $("transaction-result");
const memoField = $("memo-text");
const transactionNote = $("transaction-note");
let provider = null;
const connection = createDevnetConnection();
let activePublicKey = null;
let submissionLocked = false;

function showStatus(text, kind = "info") {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = !text;
}

function findWallet() {
  return window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
}

async function updateBalance(publicKey) {
  const lamports = await connection.getBalance(publicKey, "confirmed");
  balance.textContent = `${(lamports / 1_000_000_000).toFixed(4)} devnet SOL`;
}

function showTransaction(signature, note) {
  const link = new URL(`https://explorer.solana.com/tx/${encodeURIComponent(signature)}`);
  link.searchParams.set("cluster", "devnet");
  const anchor = $("transaction-link");
  anchor.href = link.toString();
  anchor.textContent = `${signature.slice(0, 10)}…${signature.slice(-8)}`;
  transactionNote.textContent = note;
  result.hidden = false;
}

connectButton.addEventListener("click", async () => {
  provider = findWallet();
  if (!provider) {
    showStatus("Phantom wasn’t found. Install Phantom, switch its network to Devnet, then reconnect.", "error");
    return;
  }
  connectButton.disabled = true;
  showStatus("Waiting for your wallet connection…");
  try {
    const response = await provider.connect();
    activePublicKey = response?.publicKey ?? provider.publicKey;
    if (!activePublicKey) throw new Error("The wallet did not provide a public address.");
    walletStatus.textContent = activePublicKey.toString();
    await updateBalance(activePublicKey);
    sendButton.disabled = submissionLocked;
    showStatus("Connected to this demo. Make sure Phantom itself is set to Devnet.", "success");
  } catch (error) {
    activePublicKey = null;
    sendButton.disabled = true;
    showStatus(error?.message ?? "Wallet connection was not completed.", "error");
  } finally {
    connectButton.disabled = false;
  }
});

sendButton.addEventListener("click", async () => {
  if (!provider || !activePublicKey) {
    showStatus("Connect your wallet first.", "error");
    return;
  }
  if (submissionLocked) {
    showStatus("This page has already requested a Devnet submission. Check the wallet or Explorer before starting another.", "error");
    return;
  }
  sendButton.disabled = true;
  result.hidden = true;
  showStatus("Review and sign the memo transaction in Phantom. This page submits it to the Devnet RPC only.");
  try {
    const submitted = await sendDevnetMemo({
      provider,
      connection,
      memo: memoField.value || DEFAULT_MEMO,
    });
    submissionLocked = true;
    showTransaction(submitted.signature,
      submitted.confirmed ? "Confirmed on Devnet. No tokens were transferred." : "Not confirmed. Check this signature in Explorer before retrying; even a failed transaction may use a network fee.");
    if (submitted.confirmed) {
      try { await updateBalance(activePublicKey); } catch { /* The transaction result remains useful if the balance read fails. */ }
      showStatus("Devnet confirmed the memo transaction. No tokens were transferred.", "success");
    } else if (submitted.outcome === "failed") {
      showStatus("Devnet returned a failed transaction. Check its Explorer record before doing anything else.", "error");
    } else {
      showStatus("The transaction was submitted, but confirmation is unclear. Check Explorer before retrying.", "error");
    }
  } catch (error) {
    if (error?.submissionStarted) {
      submissionLocked = true;
      showStatus("The signed transaction may have been submitted, but the RPC response was unclear. Check your wallet’s Devnet activity before retrying.", "error");
    } else {
      showStatus(error?.message ?? "The Devnet memo transaction was not confirmed.", "error");
    }
  } finally {
    sendButton.disabled = !activePublicKey || submissionLocked;
  }
});

provider = findWallet();
if (!provider) walletStatus.textContent = "No wallet connected";
