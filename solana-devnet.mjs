export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const EXPLORER_TX = 'https://explorer.solana.com/tx/';
export const BASE58_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

export function validateSignature(signature) {
  const value = String(signature ?? '').trim();
  return BASE58_SIGNATURE.test(value) ? value : null;
}

function exactTokenAmount(raw, decimals) {
  if (!/^\d+$/.test(String(raw)) || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) return null;
  const integer = BigInt(raw);
  if (decimals === 0) return integer.toString();
  const base = 10n ** BigInt(decimals);
  const whole = integer / base;
  const fraction = (integer % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function describeInstruction(ix, source, outerIndex, innerIndex = null) {
  const programId = typeof ix?.programId === 'string' ? ix.programId :
    (typeof ix?.program === 'string' ? ix.program : 'Unknown program');
  const parsedType = typeof ix?.parsed?.type === 'string' ? ix.parsed.type : null;
  const position = innerIndex === null ? `Instruction ${outerIndex + 1}` : `Instruction ${outerIndex + 1} · inner ${innerIndex + 1}`;
  return { position, source, programId, operation: parsedType, parsed: Boolean(parsedType) };
}

function collectInstructions(transaction) {
  const message = transaction?.transaction?.message;
  const outer = Array.isArray(message?.instructions) ? message.instructions : [];
  const innerGroups = Array.isArray(transaction?.meta?.innerInstructions) ? transaction.meta.innerInstructions : [];
  const byOuter = new Map(innerGroups.map(group => [group.index, Array.isArray(group.instructions) ? group.instructions : []]));
  const out = [];
  outer.forEach((ix, index) => {
    out.push(describeInstruction(ix, 'Top level', index));
    (byOuter.get(index) ?? []).forEach((nested, innerIndex) => out.push(describeInstruction(nested, 'Invoked by this instruction', index, innerIndex)));
  });
  return out;
}

function tokenDeltas(transaction) {
  const meta = transaction?.meta;
  const before = Array.isArray(meta?.preTokenBalances) ? meta.preTokenBalances : [];
  const after = Array.isArray(meta?.postTokenBalances) ? meta.postTokenBalances : [];
  const balances = new Map();
  function add(entry, side) {
    if (!entry || !Number.isInteger(entry.accountIndex) || typeof entry.mint !== 'string') return;
    const key = `${entry.accountIndex}:${entry.mint}`;
    const token = entry.uiTokenAmount ?? {};
    const amount = /^\d+$/.test(String(token.amount ?? '')) ? BigInt(token.amount) : null;
    if (amount === null || !Number.isInteger(token.decimals)) return;
    if (!balances.has(key)) balances.set(key, { accountIndex: entry.accountIndex, mint: entry.mint, owner: entry.owner ?? null, decimals: token.decimals, before: 0n, after: 0n });
    const current = balances.get(key);
    if (side === 'before') current.before = amount;
    else current.after = amount;
    if (!current.owner && entry.owner) current.owner = entry.owner;
  }
  before.forEach(entry => add(entry, 'before'));
  after.forEach(entry => add(entry, 'after'));
  return [...balances.values()].map(item => ({
    ...item,
    change: item.after - item.before,
    displayAmount: exactTokenAmount((item.after - item.before < 0n ? -(item.after - item.before) : item.after - item.before).toString(), item.decimals),
    rawChange: (item.after - item.before).toString(),
  })).filter(item => item.change !== 0n).sort((a, b) => a.accountIndex - b.accountIndex || a.mint.localeCompare(b.mint));
}

function lamportsToSol(value) {
  if (!Number.isSafeInteger(value) || value < 0) return null;
  const digits = String(value).padStart(10, '0');
  const whole = digits.slice(0, -9) || '0';
  const frac = digits.slice(-9).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export function summarizeTransaction(transaction, requestedSignature = '') {
  if (!transaction || typeof transaction !== 'object' || !transaction.transaction?.message || !transaction.meta) {
    throw new Error('The RPC response is missing transaction details.');
  }
  const signature = transaction.transaction.signatures?.[0] ?? requestedSignature;
  const error = transaction.meta.err;
  const instructions = collectInstructions(transaction);
  return {
    signature,
    slot: Number.isSafeInteger(transaction.slot) ? transaction.slot : null,
    status: error === null ? 'Success' : 'Failed',
    error,
    feeLamports: Number.isSafeInteger(transaction.meta.fee) ? transaction.meta.fee : null,
    feeSol: lamportsToSol(transaction.meta.fee),
    blockTime: Number.isSafeInteger(transaction.blockTime) ? transaction.blockTime : null,
    instructions,
    tokenDeltas: tokenDeltas(transaction),
    explorerUrl: `${EXPLORER_TX}${encodeURIComponent(signature)}?cluster=devnet`,
  };
}

export async function fetchTransaction(signature, fetchImpl = globalThis.fetch) {
  const valid = validateSignature(signature);
  if (!valid) throw new Error('Enter a valid base58 Solana transaction signature.');
  if (typeof fetchImpl !== 'function') throw new Error('This browser does not support network requests.');
  let response;
  try {
    response = await fetchImpl(DEVNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [valid, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }] }),
    });
  } catch {
    throw new Error('Could not reach Solana Devnet RPC. Check your connection and try again.');
  }
  if (!response.ok) throw new Error(`Solana Devnet RPC returned HTTP ${response.status}. Try again later.`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Solana Devnet RPC returned unreadable JSON.'); }
  if (payload?.error) throw new Error(`Solana Devnet could not read this transaction (${payload.error.message || 'RPC error'}).`);
  if (!payload || !Object.hasOwn(payload, 'result')) throw new Error('Solana Devnet returned an unexpected response.');
  if (payload.result === null) throw new Error('Transaction not found on Devnet. Check the signature and network.');
  return summarizeTransaction(payload.result, valid);
}
