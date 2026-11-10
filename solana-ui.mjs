import { fetchTransaction, validateSignature } from './solana-devnet.mjs';

const SAMPLE_SIGNATURE = '5M42QzPrW4DUVsG627TDgBFKNfWPCA86FzP2mbuGEckNMWGbEbBtabi368Pfte2y6J5xL3BhHiNp7p5iTZ2qXWMW';
const $ = id => document.getElementById(id);
const signatureInput = $('solSignature');
const status = $('solStatus');
const output = $('solOutput');
const analyzeButton = $('analyzeSol');
signatureInput.value = SAMPLE_SIGNATURE;
status.textContent = 'A public Devnet transaction is prefilled as an example. Click Explain transaction to fetch it.';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}
function code(value) { return el('code', '', value); }
function render(summary) {
  output.replaceChildren();
  const top = el('div', 'sol-output-head');
  top.append(el('h3', '', 'Transaction summary'));
  const explorer = el('a', 'sol-explorer', 'Open on Solana Explorer ↗');
  explorer.href = summary.explorerUrl;
  explorer.target = '_blank'; explorer.rel = 'noopener noreferrer';
  top.append(explorer); output.append(top);

  const grid = el('dl', 'sol-metrics');
  for (const [name, value] of [
    ['Result', summary.status], ['Slot', summary.slot === null ? 'Not reported' : summary.slot.toLocaleString('en-US')],
    ['Network fee', summary.feeLamports === null ? 'Not reported' : `${summary.feeSol ?? '—'} SOL (${summary.feeLamports.toLocaleString('en-US')} lamports)`],
    ['Program calls', String(summary.instructions.length)],
  ]) {
    const group = document.createElement('div');
    group.append(el('dt', '', name), el('dd', '', value)); grid.append(group);
  }
  output.append(grid);
  if (summary.error !== null) output.append(el('p', 'sol-warning', `Transaction error: ${JSON.stringify(summary.error)}`));

  const programs = el('section', 'sol-subsection');
  programs.append(el('h4', '', `Program calls (${summary.instructions.length})`));
  if (!summary.instructions.length) programs.append(el('p', 'sol-muted', 'No instructions were returned.'));
  const list = el('ol', 'sol-list');
  summary.instructions.forEach(item => {
    const row = document.createElement('li');
    const heading = el('strong', '', `${item.position}${item.operation ? ` · ${item.operation}` : ''}`);
    const source = el('span', 'sol-muted', item.source);
    row.append(heading, source, code(item.programId)); list.append(row);
  });
  if (summary.instructions.length) programs.append(list);
  output.append(programs);

  const tokens = el('section', 'sol-subsection');
  tokens.append(el('h4', '', `Token balance changes (${summary.tokenDeltas.length})`));
  tokens.append(el('p', 'sol-muted', 'Net changes from the transaction’s token balance snapshots; values use each mint’s on-chain decimals.'));
  if (!summary.tokenDeltas.length) tokens.append(el('p', 'sol-muted', 'No token balance changes were reported.'));
  const tokenList = el('ul', 'sol-list sol-token-list');
  summary.tokenDeltas.forEach(item => {
    const row = document.createElement('li');
    const sign = item.change > 0n ? '+' : '−';
    row.append(el('strong', 'sol-delta', `${sign}${item.displayAmount} tokens`));
    if (item.owner) row.append(el('span', 'sol-muted', `Owner · ${item.owner}`));
    row.append(el('span', 'sol-muted', `Token account #${item.accountIndex} · ${item.decimals} decimals`));
    row.append(code(`Mint ${item.mint}`));
    row.append(code(`Raw change ${item.rawChange}`));
    tokenList.append(row);
  });
  if (summary.tokenDeltas.length) tokens.append(tokenList);
  output.append(tokens);
  output.hidden = false;
}

$('loadSolSample').addEventListener('click', () => {
  signatureInput.value = SAMPLE_SIGNATURE;
  status.className = 'sol-status';
  status.textContent = 'Public Devnet sample loaded. Analyze it to retrieve the current transaction details.';
  output.hidden = true; output.replaceChildren();
});

$('solForm').addEventListener('submit', async event => {
  event.preventDefault();
  const signature = validateSignature(signatureInput.value);
  if (!signature) {
    status.className = 'sol-status error';
    status.textContent = 'Enter a valid base58 Solana transaction signature.';
    return;
  }
  analyzeButton.disabled = true;
  analyzeButton.textContent = 'Reading Devnet…';
  status.className = 'sol-status';
  status.textContent = 'Fetching the confirmed transaction from the public Solana Devnet RPC…';
  output.hidden = true; output.replaceChildren();
  try {
    const summary = await fetchTransaction(signature);
    render(summary);
    status.textContent = 'Read-only Devnet lookup complete.';
  } catch (error) {
    status.className = 'sol-status error';
    status.textContent = error instanceof Error ? error.message : 'Could not read this transaction.';
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = 'Explain transaction';
  }
});
