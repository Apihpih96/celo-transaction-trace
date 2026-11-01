import {
  concat,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import { toDataSuffix, fromDataSuffix } from '@celo/attribution-tags';
import './style.css';

const EXPECTED_OWNER = getAddress('0x465ce2143392b99d1420c0cd6d11ec9baf586ede');
const REGISTRY = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
const PROFILE_URI = 'https://raw.githubusercontent.com/Apihpih96/celo-transaction-trace/master/agent.json';
const ATTRIBUTION_CODE = 'celo_4b23bdd2081f';
const CHAIN_ID = 42220;
const RPC_URL = 'https://forno.celo.org';
const TRANSACTION_HASH = '0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6' as Hex;
const REGISTRY_ABI = [{
  type: 'function',
  name: 'register',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
}] as const;

const client = createPublicClient({ chain: celo, transport: http(RPC_URL) });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $('status');
const checkButton = $('check-receipt') as HTMLButtonElement;
const registrationStatusEl = $('registration-status');
const transactionHashEl = $('transaction-hash');
const blockEl = $('block-number');
const confirmationsEl = $('confirmations');
const feeEl = $('actual-fee');
const ownerEl = $('wallet');

$('registry').textContent = REGISTRY;
$('tag').textContent = ATTRIBUTION_CODE;
ownerEl.textContent = EXPECTED_OWNER;
const profileLink = $('profile-link') as HTMLAnchorElement;
profileLink.href = PROFILE_URI;
profileLink.textContent = PROFILE_URI;
transactionHashEl.textContent = TRANSACTION_HASH;

function setStatus(message: string, kind: 'info' | 'good' | 'error' = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function formatCelo(value: bigint) {
  return `${Number(formatEther(value)).toFixed(6)} CELO`;
}

function expectedTaggedCall(): Hex {
  const encoded = encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'register', args: [PROFILE_URI] });
  return concat([encoded, toDataSuffix(ATTRIBUTION_CODE)]);
}

async function checkReceipt() {
  checkButton.disabled = true;
  setStatus('Checking the public Celo receipt…');
  registrationStatusEl.textContent = 'Checking';
  blockEl.textContent = '—';
  confirmationsEl.textContent = '—';
  feeEl.textContent = '—';
  try {
    const [chainId, transaction, receipt, latestBlock] = await Promise.all([
      client.getChainId(),
      client.getTransaction({ hash: TRANSACTION_HASH }),
      client.getTransactionReceipt({ hash: TRANSACTION_HASH }),
      client.getBlockNumber(),
    ]);
    const decoded = fromDataSuffix(transaction.input);
    const matches = chainId === CHAIN_ID
      && transaction.from.toLowerCase() === EXPECTED_OWNER.toLowerCase()
      && transaction.to?.toLowerCase() === REGISTRY.toLowerCase()
      && transaction.value === 0n
      && transaction.input.toLowerCase() === expectedTaggedCall().toLowerCase()
      && decoded?.codes.includes(ATTRIBUTION_CODE)
      && receipt.transactionHash.toLowerCase() === TRANSACTION_HASH.toLowerCase()
      && receipt.from.toLowerCase() === EXPECTED_OWNER.toLowerCase()
      && receipt.to?.toLowerCase() === REGISTRY.toLowerCase();
    if (!matches) {
      registrationStatusEl.textContent = 'Receipt found, but transaction details do not match this registration.';
      setStatus('The public record did not match the expected owner, registry, profile and tag. Do not take further action from this page.', 'error');
      return;
    }

    const confirmations = latestBlock >= receipt.blockNumber ? latestBlock - receipt.blockNumber + 1n : 0n;
    const actualFee = receipt.gasUsed * receipt.effectiveGasPrice;
    blockEl.textContent = receipt.blockNumber.toString();
    confirmationsEl.textContent = confirmations.toString();
    feeEl.textContent = formatCelo(actualFee);
    registrationStatusEl.textContent = receipt.status === 'success' ? 'Confirmed successfully' : 'Mined but reverted';
    setStatus(receipt.status === 'success'
      ? 'Celo confirms this tagged registration. This receipt checker is read-only; no wallet or transaction action is available.'
      : 'Celo reports that this transaction reverted. This page will not resubmit it.', receipt.status === 'success' ? 'good' : 'error');
  } catch {
    registrationStatusEl.textContent = 'Could not verify right now';
    setStatus('The saved transaction hash is shown above, but Celo RPC did not provide a verifiable receipt. This is not evidence of failure; do not resubmit.', 'error');
  } finally {
    checkButton.disabled = false;
  }
}

checkButton.addEventListener('click', () => void checkReceipt());
void checkReceipt();
