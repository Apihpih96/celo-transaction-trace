import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { createMemoTransaction, sendDevnetMemo, DEVNET_RPC_URL, MEMO_PROGRAM_ID, DEFAULT_MEMO } from "../devnet-core.mjs";

const signer = new PublicKey("11111111111111111111111111111111");
const blockhash = "11111111111111111111111111111111";

test("builds a memo-only transaction for the Solana Memo Program", () => {
  const tx = createMemoTransaction({ feePayer: signer, blockhash, memo: "Route Lab proof" });
  assert.equal(tx.feePayer.toBase58(), signer.toBase58());
  assert.equal(tx.recentBlockhash, blockhash);
  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0].programId.toBase58(), MEMO_PROGRAM_ID);
  assert.equal(tx.instructions[0].data.toString("utf8"), "Route Lab proof");
  assert.equal(tx.instructions[0].keys[0].isSigner, true);
  assert.equal(tx.instructions[0].keys[0].isWritable, false);
});

test("rejects blank and overlong memo text before asking for a wallet signature", () => {
  assert.throws(() => createMemoTransaction({ feePayer: signer, blockhash, memo: "  " }), /Enter a short memo/);
  assert.throws(() => createMemoTransaction({ feePayer: signer, blockhash, memo: "💠".repeat(71) }), /280 UTF-8 bytes/);
});

test("uses devnet blockhash, wallet-signs, explicitly submits to the supplied devnet RPC, and confirms the signature", async () => {
  let submitted;
  let signedTransaction;
  let confirmed;
  const connection = {
    getLatestBlockhash: async (commitment) => {
      assert.equal(commitment, "confirmed");
      return { blockhash, lastValidBlockHeight: 77 };
    },
    sendRawTransaction: async (raw, options) => {
      submitted = { raw, options };
      return "memo-signature";
    },
    confirmTransaction: async (strategy, commitment) => {
      confirmed = { strategy, commitment };
      return { value: { err: null } };
    },
  };
  const provider = {
    publicKey: signer,
    signTransaction: async (transaction) => {
      signedTransaction = transaction;
      return { serialize: () => new Uint8Array([1, 2, 3]) };
    },
  };
  const result = await sendDevnetMemo({ provider, connection, memo: DEFAULT_MEMO });
  assert.equal(signedTransaction.instructions[0].programId.toBase58(), MEMO_PROGRAM_ID);
  assert.deepEqual(Array.from(submitted.raw), [1, 2, 3]);
  assert.equal(submitted.options.skipPreflight, false);
  assert.equal(submitted.options.preflightCommitment, "confirmed");
  assert.equal(confirmed.strategy.signature, "memo-signature");
  assert.equal(confirmed.strategy.lastValidBlockHeight, 77);
  assert.equal(confirmed.commitment, "confirmed");
  assert.equal(result.signature, "memo-signature");
  assert.equal(result.feePayer, signer.toBase58());
  assert.equal(result.confirmed, true);
  assert.equal(result.outcome, "confirmed");
  assert.equal(DEVNET_RPC_URL, "https://api.devnet.solana.com");
});

test("returns a signature but marks unclear confirmation as unknown, so the UI can prevent a duplicate", async () => {
  const connection = {
    getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 77 }),
    sendRawTransaction: async () => "memo-signature",
    confirmTransaction: async () => { throw new Error("RPC timeout"); },
  };
  const provider = { publicKey: signer, signTransaction: async () => ({ serialize: () => new Uint8Array([1]) }) };
  const result = await sendDevnetMemo({ provider, connection });
  assert.equal(result.signature, "memo-signature");
  assert.equal(result.confirmed, false);
  assert.equal(result.outcome, "unknown");
});

test("marks a lost submission response as possibly submitted and requiring inspection before retry", async () => {
  const connection = {
    getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 77 }),
    sendRawTransaction: async () => { throw new Error("RPC timeout"); },
  };
  const provider = { publicKey: signer, signTransaction: async () => ({ serialize: () => new Uint8Array([1]) }) };
  await assert.rejects(sendDevnetMemo({ provider, connection }), (error) => error.submissionStarted === true && /before retrying/.test(error.message));
});

test("does not report a confirmed status when Devnet returns a failed transaction", async () => {
  const connection = {
    getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 77 }),
    sendRawTransaction: async () => "memo-signature",
    confirmTransaction: async () => ({ value: { err: { InstructionError: [0, "Custom"] } } }),
  };
  const provider = { publicKey: signer, signTransaction: async () => ({ serialize: () => new Uint8Array([1]) }) };
  const result = await sendDevnetMemo({ provider, connection });
  assert.equal(result.signature, "memo-signature");
  assert.equal(result.confirmed, false);
  assert.equal(result.outcome, "failed");
});

test("refuses wallet providers without an explicit public key or transaction-signing support", async () => {
  await assert.rejects(sendDevnetMemo({ provider: {}, connection: {} }), /Connect a wallet first/);
  await assert.rejects(sendDevnetMemo({ provider: { publicKey: signer }, connection: { getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 1 }) } }), /does not support/);
});
