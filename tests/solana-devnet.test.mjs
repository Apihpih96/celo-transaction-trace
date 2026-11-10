import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTransaction, summarizeTransaction, validateSignature } from '../solana-devnet.mjs';

const signature = '5M42QzPrW4DUVsG627TDgBFKNfWPCA86FzP2mbuGEckNMWGbEbBtabi368Pfte2y6J5xL3BhHiNp7p5iTZ2qXWMW';
const parsed = {
  slot: 42,
  blockTime: 1700000000,
  transaction: { signatures: [signature], message: { instructions: [
    { program: 'system', programId: '11111111111111111111111111111111', parsed: { type: 'transfer' } },
    { programId: 'UnknownProgram111111111111111111111111111111', accounts: [], data: 'abc' },
  ] } },
  meta: {
    err: null,
    fee: 5000,
    innerInstructions: [{ index: 0, instructions: [{ program: 'spl-token', programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', parsed: { type: 'transfer' } }] }],
    preTokenBalances: [{ accountIndex: 1, mint: 'Mint111111111111111111111111111111111111111', owner: 'Owner1111111111111111111111111111111111111', uiTokenAmount: { amount: '2500', decimals: 2 } }],
    postTokenBalances: [{ accountIndex: 1, mint: 'Mint111111111111111111111111111111111111111', owner: 'Owner1111111111111111111111111111111111111', uiTokenAmount: { amount: '1750', decimals: 2 } }, { accountIndex: 3, mint: 'Mint111111111111111111111111111111111111111', owner: 'Other1111111111111111111111111111111111111', uiTokenAmount: { amount: '750', decimals: 2 } }],
  },
};

test('validates base58 signatures and rejects ambiguous characters', () => {
  assert.equal(validateSignature(` ${signature} `), signature);
  assert.equal(validateSignature('0'.repeat(88)), null);
  assert.equal(validateSignature('too short'), null);
});

test('summarizes fee, top-level and inner program calls, and exact token deltas', () => {
  const summary = summarizeTransaction(parsed, signature);
  assert.equal(summary.feeLamports, 5000);
  assert.equal(summary.feeSol, '0.000005');
  assert.equal(summary.instructions.length, 3);
  assert.equal(summary.instructions[1].programId, 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  assert.deepEqual(summary.tokenDeltas.map(item => [item.accountIndex, item.rawChange, item.displayAmount]), [[1, '-750', '7.5'], [3, '750', '7.5']]);
  assert.match(summary.explorerUrl, /cluster=devnet$/);
});

test('fetches only confirmed Devnet getTransaction and explains missing result', async () => {
  let request;
  const missing = await fetchTransaction(signature, async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ result: null }) };
  }).catch(error => error);
  assert.equal(request.url, 'https://api.devnet.solana.com');
  assert.equal(request.body.method, 'getTransaction');
  assert.equal(request.body.params[1].commitment, 'confirmed');
  assert.equal(missing.message, 'Transaction not found on Devnet. Check the signature and network.');
});
