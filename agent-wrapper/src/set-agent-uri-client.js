import {
  CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
  CONCORDIUM_WALLET_TESTNET,
  createWalletConnectModalConfig,
  TESTNET,
  WalletConnectConnector,
  WalletConnectEvent,
  WalletConnectMethod,
  moduleSchemaFromBase64,
} from "@concordium/wallet-connectors";
import {
  AccountTransactionType,
  CcdAmount,
  ContractName,
  EntrypointName,
  ReceiveName,
  serializeUpdateContractParameters,
} from "@concordium/web-sdk";

const $ = (id) => document.getElementById(id);
const statusNode = $("status");
const connectButton = $("connect");
const requestButton = $("request");
const disconnectButton = $("disconnect");
const confirmBox = $("confirm");
const confirmWrap = $("confirm-wrap");
const txResult = $("tx-result");
let connector;
let connection;
let info;
let dataVerified = false;

function setStatus(text, kind = "") {
  statusNode.textContent = text;
  statusNode.className = `status ${kind}`;
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function walletMatchesPreparedUpdate() {
  if (!connection || !dataVerified || !info) return false;
  try {
    return connection.chainId === "ccd:testnet" && connection.getConnectedAccount() === info.account;
  } catch {
    return false;
  }
}

function updateButtonState() {
  requestButton.disabled = !walletMatchesPreparedUpdate() || !confirmBox.checked;
}

function renderInfo(value) {
  $("network").textContent = "Concordium Testnet (ccd:testnet)";
  $("account").textContent = value.account;
  $("contract").textContent = `${value.contract.index}.${value.contract.subindex} · ${value.contractName}`;
  $("entrypoint").textContent = value.entrypoint;
  $("token").textContent = `Agent token ${value.tokenId} · ${value.tokenAddress}`;
  $("card-url").textContent = value.agentUri;
  $("card-hash").textContent = value.cardSha256;
  $("energy").textContent = value.maxEnergy.toLocaleString("en-US");
}

async function verifyPreparedUpdate() {
  const response = await fetch("/api/concordium/set-agent-uri-info", { cache: "no-store" });
  if (!response.ok) throw new Error("The prepared update details are unavailable.");
  const value = await response.json();
  if (value.network !== "testnet" || value.contract?.index !== 12802 || value.contract?.subindex !== 0 || value.entrypoint !== "CIS-8004.setAgentURI" || value.tokenId !== 1308) {
    throw new Error("The prepared transaction details differ from the expected Testnet token update. No wallet request will be made.");
  }

  const schema = moduleSchemaFromBase64(value.schemaBase64);
  const serialized = serializeUpdateContractParameters(
    ContractName.fromString(value.contractName),
    EntrypointName.fromString("setAgentURI"),
    value.parameters,
    toArrayBuffer(schema.value),
  );
  const actualParameterHex = hex(new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength));
  if (actualParameterHex !== value.parameterHex) throw new Error("The update payload does not match the prepared transaction. No wallet request will be made.");

  const cardResponse = await fetch(value.agentUri, { cache: "no-store" });
  if (!cardResponse.ok) throw new Error("The live Agent Card could not be read. No wallet request will be made.");
  const cardBytes = new Uint8Array(await cardResponse.arrayBuffer());
  const actualHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", cardBytes)));
  if (actualHash !== value.cardSha256) throw new Error("The live card hash differs from the prepared update. No wallet request will be made.");
  const expectedHashBytes = Array.from(actualHash.match(/.{2}/g), (part) => Number.parseInt(part, 16));
  const expectedHashInParams = value.parameters.metadata_hash?.Some?.[0];
  if (!Array.isArray(expectedHashInParams) || hex(expectedHashInParams) !== hex(expectedHashBytes)) {
    throw new Error("The payload’s card hash differs from the live card. No wallet request will be made.");
  }
  return value;
}

async function loadPreparedUpdate() {
  try {
    info = await verifyPreparedUpdate();
    renderInfo(info);
    dataVerified = true;
    connectButton.disabled = false;
    setStatus("Card bytes and prepared update match. Connect the Testnet wallet when you’re ready.", "ok");
  } catch (error) {
    dataVerified = false;
    setStatus(error instanceof Error ? error.message : "Could not verify the prepared update.", "bad");
  }
  updateButtonState();
}

async function connectWallet() {
  if (!dataVerified) return;
  connectButton.disabled = true;
  setStatus("Opening the Concordium Wallet connection…");
  try {
    const projectId = info.walletConnectProjectId || CONCORDIUM_WALLET_CONNECT_PROJECT_ID;
    const modalConfig = createWalletConnectModalConfig(TESTNET, [CONCORDIUM_WALLET_TESTNET]);
    modalConfig.projectId = projectId;
    const namespace = {
      methods: [WalletConnectMethod.SignAndSendTransaction],
      events: [WalletConnectEvent.AccountsChanged, WalletConnectEvent.ChainChanged],
    };
    const delegate = {
      onAccountChanged() {
        updateButtonState();
        if (!walletMatchesPreparedUpdate()) setStatus("Wallet account changed. Reconnect the listed owner account before requesting review.", "bad");
      },
      onChainChanged() {
        updateButtonState();
        if (!walletMatchesPreparedUpdate()) setStatus("Wallet network changed. Reconnect to Concordium Testnet before requesting review.", "bad");
      },
      onConnected() {},
      onDisconnected() { connection = undefined; connector = undefined; setWalletConnectionControls(false); },
    };
    connector = await WalletConnectConnector.create({
      projectId,
      metadata: {
        name: "Celo Transaction Trace",
        description: "Owner-reviewed update to Concordium agent token 1308.",
        url: window.location.origin,
        icons: [],
      },
    }, delegate, TESTNET, namespace, modalConfig);
    connection = await connector.connect();
    if (!connection) throw new Error("Wallet connection was cancelled.");
    if (connection.chainId !== "ccd:testnet") throw new Error("Wrong network. Connect to Concordium Testnet; no transaction was requested.");
    if (connection.getConnectedAccount() !== info.account) throw new Error("Wrong account connected. No transaction was requested; reconnect the listed owner account.");
    connectButton.classList.add("hidden");
    requestButton.classList.remove("hidden");
    disconnectButton.classList.remove("hidden");
    confirmWrap.classList.remove("hidden");
    setStatus("Correct Testnet account connected. Check the details, then tick the box and request wallet review.", "ok");
  } catch (error) {
    connection = undefined;
    connector = undefined;
    connectButton.disabled = false;
    setStatus(error instanceof Error ? error.message : "Wallet connection failed.", "bad");
  }
  updateButtonState();
}

async function requestWalletReview() {
  if (!connection || !dataVerified || !confirmBox.checked) return;
  requestButton.disabled = true;
  txResult.classList.add("hidden");
  setStatus("Rechecking the live card, payload and wallet before requesting review…");
  try {
    info = await verifyPreparedUpdate();
    if (connection.chainId !== "ccd:testnet") throw new Error("The wallet is no longer on Concordium Testnet. No transaction was requested.");
    if (connection.getConnectedAccount() !== info.account) throw new Error("The connected account changed. No transaction was requested; reconnect the listed owner account.");
  } catch (error) {
    dataVerified = false;
    updateButtonState();
    setStatus(error instanceof Error ? error.message : "Could not recheck the update.", "bad");
    return;
  }

  setStatus("Your wallet is showing the transaction for your review. It submits only if you approve it there.");
  try {
    const transactionHash = await connection.signAndSendTransaction(
      info.account,
      AccountTransactionType.Update,
      {
        amount: CcdAmount.zero(),
        address: { index: BigInt(info.contract.index), subindex: BigInt(info.contract.subindex) },
        receiveName: ReceiveName.fromString(info.entrypoint),
        maxContractExecutionEnergy: BigInt(info.maxEnergy),
      },
      { parameters: info.parameters, schema: moduleSchemaFromBase64(info.schemaBase64) },
    );
    txResult.textContent = `Wallet returned transaction hash: ${transactionHash}. Check Testnet confirmation before assuming the update is complete.`;
    txResult.classList.remove("hidden");
    setStatus("Submitted by your wallet. Verify the transaction on Testnet before trying anything again.", "ok");
    requestButton.disabled = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The wallet request ended.";
    if (/reject|declin|cancel/i.test(message)) {
      setStatus("Wallet review was declined or cancelled; nothing was submitted.", "bad");
      requestButton.disabled = false;
    } else {
      setStatus("The wallet ended without returning a transaction hash. Check token 1308 on Testnet before trying again.", "bad");
      requestButton.disabled = true;
    }
  }
}

function setWalletConnectionControls(connected) {
  requestButton.disabled = !connected || !walletMatchesPreparedUpdate() || !confirmBox.checked;
  requestButton.classList.toggle("hidden", !connected);
  disconnectButton.classList.toggle("hidden", !connected);
  connectButton.classList.toggle("hidden", connected);
  confirmWrap.classList.toggle("hidden", !connected);
  if (!connected) connectButton.disabled = false;
}

async function disconnectWallet() {
  try { await connection?.disconnect(); } catch {}
  connection = undefined;
  connector = undefined;
  confirmBox.checked = false;
  setWalletConnectionControls(false);
  setStatus("Wallet disconnected. No transaction was requested.");
}

connectButton.addEventListener("click", connectWallet);
requestButton.addEventListener("click", requestWalletReview);
disconnectButton.addEventListener("click", disconnectWallet);
confirmBox.addEventListener("change", updateButtonState);
loadPreparedUpdate();
