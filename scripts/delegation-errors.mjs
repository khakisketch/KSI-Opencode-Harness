// Test-only classification of Native delegation-ceiling responses, not an
// application permission guard. Never accept a generic failed tool as depth proof.
export function isDelegationCeilingError(message, { depth, toolAdvertised }) {
  if (typeof message !== 'string' || !Number.isInteger(depth) || depth < 0
    || typeof toolAdvertised !== 'boolean') return false;
  if (toolAdvertised) {
    const head = `Subagent depth limit reached (${depth})`;
    return message === head || message === `${head}.`
      || message === `${head}. Increase "experimental.subagent_depth" to allow nested subagents.`;
  }
  // A removed-tool rejection must name the subagent tool explicitly. Session,
  // service, permission and transport failures are not evidence of this guard.
  return /^(?:Unknown tool: ["']?subagent["']?|(?:Tool ["']?subagent["']?) (?:not found|is not available)|No such tool: ["']?subagent["']?)\.?$/i.test(message);
}
