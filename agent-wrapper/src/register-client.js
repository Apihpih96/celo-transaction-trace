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
import { setWalletConnectionControls } from "./registration-ui.mjs";
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
const txResult = $("tx-result");
let connector;
let connection;
let info;

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

async function getVerifiedInfo() {
  const response = await fetch("/api/concordium/register-info", { cache: "no-store" });
  if (!response.ok) throw new Error("Registration details are unavailable.");
  const latestInfo = await response.json();

  const cardResponse = await fetch(latestInfo.agentUri, { cache: "no-store" });
  if (!cardResponse.ok) throw new Error("The live agent card could not be read.");
  const cardBytes = new Uint8Array(await cardResponse.arrayBuffer());
  const actualHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", cardBytes)));
  if (actualHash !== latestInfo.cardSha256) throw new Error("The live card has changed. No wallet request will be made.");

  const cardHashBytes = Array.from(actualHash.match(/.{2}/g), (part) => Number.parseInt(part, 16));
  const parameters = {
    agent_uri: { Some: [latestInfo.agentUri] },
    external_reference: { None: [] },
    initial_metadata: [],
    metadata_hash: { Some: [cardHashBytes] },
  };
  const schema = moduleSchemaFromBase64(latestInfo.schemaBase64);
  const serialized = serializeUpdateContractParameters(
    ContractName.fromString("CIS-8004"),
    EntrypointName.fromString("register"),
    parameters,
    toArrayBuffer(schema.value),
  );
  const actualParameter = hex(new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength));
  if (actualParameter !== latestInfo.parameterHex) throw new Error("The prepared contract payload does not match the verified card hash. No wallet request will be made.");
  return latestInfo;
}

async function verifyPreparedData() {
  info = await getVerifiedInfo();
  $("account").textContent = info.account;
  $("card-url").textContent = info.agentUri;
  $("card-hash").textContent = info.cardSha256;
  connectButton.disabled = false;
  setStatus("Live card and transaction payload match. Connect the Testnet wallet to continue.", "ok");
}

async function connectWallet() {
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
      onAccountChanged() {},
      onChainChanged() {},
      onConnected() {},
      onDisconnected() {},
    };
    connector = await WalletConnectConnector.create({
      projectId,
      metadata: {
        name: "Celo Transaction Trace",
        description: "One owner-initiated Concordium Testnet agent registration.",
        url: window.location.origin,
        icons: [],
      },
    }, delegate, TESTNET, namespace, modalConfig);
    connection = await connector.connect();
    if (!connection) throw new Error("Wallet connection was cancelled.");
    if (connection.chainId !== "ccd:testnet") throw new Error("Wrong network. Connect a Concordium Testnet account; no transaction was requested.");
    const account = connection.getConnectedAccount();
    if (account !== info.account) throw new Error("Wrong account connected. No transaction was requested; disconnect and choose the account shown above.");
    setWalletConnectionControls(requestButton, disconnectButton, true);
    setStatus("Correct Testnet account connected. Review the details above, then request the wallet review.", "ok");
  } catch (error) {
    connection = undefined;
    connector = undefined;
    setStatus(error instanceof Error ? error.message : "Wallet connection failed.", "bad");
    connectButton.disabled = false;
  }
}

async function requestWalletReview() {
  if (!connection || !info) return;
  requestButton.disabled = true;
  setStatus("Rechecking the live card and Testnet wallet…");
  try {
    info = await getVerifiedInfo();
    if (connection.chainId !== "ccd:testnet") throw new Error("The wallet is no longer connected to Concordium Testnet. No transaction was requested.");
    if (connection.getConnectedAccount() !== info.account) throw new Error("The connected account changed. No transaction was requested; reconnect the expected account.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not recheck registration details.", "bad");
    requestButton.disabled = false;
    return;
  }
  setStatus("Waiting for your wallet’s review and decision…");
  const cardHashBytes = Array.from(info.cardSha256.match(/.{2}/g), (part) => Number.parseInt(part, 16));
  const parameters = {
    agent_uri: { Some: [info.agentUri] },
    external_reference: { None: [] },
    initial_metadata: [],
    metadata_hash: { Some: [cardHashBytes] },
  };
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
      { parameters, schema: moduleSchemaFromBase64(info.schemaBase64) },
    );
    txResult.textContent = `Submitted testnet transaction: ${transactionHash}`;
    txResult.classList.remove("hidden");
    setStatus("The wallet returned a transaction hash. Check the Testnet explorer before claiming registration is complete.", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The wallet request ended.";
    if (/reject|declin|cancel/i.test(message)) {
      setStatus("The wallet request was declined; no transaction hash was returned.", "bad");
      requestButton.disabled = false;
    } else {
      setStatus("The wallet request ended without a transaction hash. Check the registry before trying again.", "bad");
      requestButton.disabled = true;
    }
  }
}

async function disconnectWallet() {
  requestButton.disabled = true;
  try { await connection?.disconnect(); } catch {}
  connection = undefined;
  connector = undefined;
  setWalletConnectionControls(requestButton, disconnectButton, false);
  connectButton.disabled = false;
  setStatus("Wallet disconnected. No transaction was requested.");
}

connectButton.addEventListener("click", connectWallet);
requestButton.addEventListener("click", requestWalletReview);
disconnectButton.addEventListener("click", disconnectWallet);
verifyPreparedData().catch((error) => setStatus(error instanceof Error ? error.message : "Could not verify registration data.", "bad"));
