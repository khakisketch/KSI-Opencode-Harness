import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDelegationCeilingError } from '../scripts/delegation-errors.mjs';

const advertised = { depth: 3, toolAdvertised: true };
const omitted = { depth: 3, toolAdvertised: false };

describe('Native delegation ceiling evidence (pure classification, no runtime)', () => {
  it('accepts the exact observed ceiling response including its guidance', () => {
    for (const message of [
      'Subagent depth limit reached (3)',
      'Subagent depth limit reached (3).',
      'Subagent depth limit reached (3). Increase "experimental.subagent_depth" to allow nested subagents.',
    ]) assert.equal(isDelegationCeilingError(message, advertised), true);
  });
  it('rejects a different limit and arbitrary suffixes', () => {
    for (const message of [
      'Subagent depth limit reached (2)',
      'Subagent depth limit reached (3). Service not available',
      'Permission denied: subagent_depth',
      'Could not evaluate nesting',
    ]) assert.equal(isDelegationCeilingError(message, advertised), false);
  });
  it('requires explicit subagent-tool identity for catalog-omitted errors', () => {
    for (const message of ['Unknown tool: subagent', 'Tool "subagent" not found', 'Tool subagent is not available', 'No such tool: subagent']) {
      assert.equal(isDelegationCeilingError(message, omitted), true);
    }
  });
  it('accepts the Native-observed removed-tool head naming subagent explicitly', () => {
    // Observed in the isolated five-profile fixture (2026-10-26): a depth-3
    // leaf forced subagent attempt ends in this rejection. Identity stays
    // explicit; trailing guidance sentences do not weaken the match.
    assert.equal(isDelegationCeilingError('No tool named "subagent" is currently available. Please use a tool from the available tool list.', omitted), true);
    assert.equal(isDelegationCeilingError('No tool named "subagent" is currently available.', omitted), true);
    assert.equal(isDelegationCeilingError('No tool named "shell" is currently available. Please use a tool from the available tool list.', omitted), false);
  });
  it('never treats session, service, network or permission failures as removal', () => {
    for (const message of ['Session not found', 'Service not available', 'Unknown tool: shell', 'Connection reset', 'Permission denied: subagent', 'subagent not available because service disconnected']) {
      assert.equal(isDelegationCeilingError(message, omitted), false);
    }
  });
  it('does not accept removed-tool errors while the tool is advertised', () => {
    assert.equal(isDelegationCeilingError('Tool "subagent" not found', advertised), false);
  });
  it('does not accept depth errors as proof of catalog removal', () => {
    assert.equal(isDelegationCeilingError('Subagent depth limit reached (3)', omitted), false);
  });
  it('fails closed on invalid input and unspecified catalog state', () => {
    for (const message of [undefined, null, {}, 3]) assert.equal(isDelegationCeilingError(message, advertised), false);
    for (const config of [{}, { depth: 3 }, { depth: -1, toolAdvertised: true }, { depth: 3.1, toolAdvertised: true }]) {
      assert.equal(isDelegationCeilingError('Subagent depth limit reached (3)', config), false);
    }
  });
});
