import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const DEVNET_RPC_URL = "https://api.devnet.solana.com";
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const DEFAULT_MEMO = "Route Lab devnet proof";

export function createMemoTransaction({ feePayer, blockhash, memo = DEFAULT_MEMO }) {
  const memoBytes = Buffer.from(memo, "utf8");
  if (!memo.trim()) throw new Error("Enter a short memo before requesting a signature.");
  if (memoBytes.length > 280) throw new Error("Memo must be 280 UTF-8 bytes or fewer.");
  const payer = new PublicKey(feePayer);
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  transaction.add(new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: memoBytes,
  }));
  return transaction;
}

export function createDevnetConnection() {
  return new Connection(DEVNET_RPC_URL, "confirmed");
}

export async function sendDevnetMemo({ provider, connection, memo = DEFAULT_MEMO }) {
  if (!provider?.publicKey) throw new Error("Connect a wallet first.");
  if (typeof provider.signTransaction !== "function") {
    throw new Error("This wallet does not support transaction signing in this browser.");
  }
  const feePayer = provider.publicKey;
  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = createMemoTransaction({
    feePayer,
    blockhash: latest.blockhash,
    memo,
  });
  const signed = await provider.signTransaction(transaction);
  if (!signed || typeof signed.serialize !== "function") {
    throw new Error("Wallet did not return a signed transaction.");
  }

  // Submit through the pinned Devnet RPC, never the wallet's currently selected cluster.
  let signature;
  try {
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch (cause) {
    const error = new Error("The signed transaction may have been submitted, but the RPC response was unclear. Check your wallet’s Devnet activity before retrying.");
    error.submissionStarted = true;
    error.cause = cause;
    throw error;
  }

  try {
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    }, "confirmed");
    if (confirmation?.value?.err) {
      return { signature, feePayer: feePayer.toString(), memo, confirmed: false, outcome: "failed" };
    }
    if (confirmation?.value?.err !== null) {
      return { signature, feePayer: feePayer.toString(), memo, confirmed: false, outcome: "unknown" };
    }
    return { signature, feePayer: feePayer.toString(), memo, confirmed: true, outcome: "confirmed" };
  } catch {
    return { signature, feePayer: feePayer.toString(), memo, confirmed: false, outcome: "unknown" };
  }
}
