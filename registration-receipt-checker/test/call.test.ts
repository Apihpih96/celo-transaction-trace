import assert from 'node:assert/strict';
import { concat, decodeFunctionData, encodeFunctionData, getAddress } from 'viem';
import { toDataSuffix, fromDataSuffix } from '@celo/attribution-tags';

const registry = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
const profile = 'https://raw.githubusercontent.com/Apihpih96/celo-transaction-trace/master/agent.json';
const tag = 'celo_4b23bdd2081f';
const abi = [{
  type: 'function', name: 'register', stateMutability: 'nonpayable',
  inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }],
}] as const;
const calldata = encodeFunctionData({ abi, functionName: 'register', args: [profile] });
const suffix = toDataSuffix(tag);
const tagged = concat([calldata, suffix]);
const decoded = decodeFunctionData({ abi, data: calldata });
const decodedSuffix = fromDataSuffix(tagged);
assert.equal(registry, '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
assert.equal(decoded.functionName, 'register');
assert.deepEqual(decoded.args, [profile]);
assert.ok(tagged.startsWith(calldata));
assert.ok(decodedSuffix?.codes.includes(tag));
assert.equal(typeof suffix, 'string');
console.log(JSON.stringify({ registry, functionName: decoded.functionName, agentURI: decoded.args[0], suffix, verifiedTags: decodedSuffix?.codes } satisfies Record<string, unknown>, null, 2));
