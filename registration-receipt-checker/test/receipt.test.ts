import assert from 'node:assert/strict';
import { concat, createPublicClient, encodeFunctionData, getAddress, http } from 'viem';
import { celo } from 'viem/chains';
import { fromDataSuffix, toDataSuffix } from '@celo/attribution-tags';

const hash = '0x8710ecd6854c8c5163dd8ffee0318bd77fe5a997eb4b37e1dd8a3650077312b6';
const owner = getAddress('0x465ce2143392b99d1420c0cd6d11ec9baf586ede');
const registry = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
const uri = 'https://raw.githubusercontent.com/Apihpih96/celo-transaction-trace/master/agent.json';
const tag = 'celo_4b23bdd2081f';
const abi = [{ type: 'function', name: 'register', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }] }] as const;
const expectedData = concat([encodeFunctionData({ abi, functionName: 'register', args: [uri] }), toDataSuffix(tag)]);
const client = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });

const [chainId, tx, receipt] = await Promise.all([
  client.getChainId(),
  client.getTransaction({ hash }),
  client.getTransactionReceipt({ hash }),
]);
assert.equal(chainId, 42220);
assert.equal(tx.from.toLowerCase(), owner.toLowerCase());
assert.equal(tx.to?.toLowerCase(), registry.toLowerCase());
assert.equal(tx.value, 0n);
assert.equal(tx.input.toLowerCase(), expectedData.toLowerCase());
assert.ok(fromDataSuffix(tx.input)?.codes.includes(tag));
assert.equal(receipt.transactionHash.toLowerCase(), hash.toLowerCase());
assert.equal(receipt.status, 'success');
console.log(JSON.stringify({ chainId, hash: receipt.transactionHash, status: receipt.status, block: receipt.blockNumber.toString(), owner: tx.from, registry: tx.to, value: tx.value.toString(), tag, gasUsed: receipt.gasUsed.toString() }, null, 2));
