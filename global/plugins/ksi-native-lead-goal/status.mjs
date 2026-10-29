// Read-only, foreground-only status propagation. This deliberately does not arm goals.
export async function annotate(event, { getSession, getGoal }) {
  if (event.tool !== 'subagent' || event.status !== 'completed' || event.agent !== 'build') return;
  const input = event.input;
  if (!input || input.agent !== 'lead' || input.background === true) return;
  const result = event.result;
  const child = result?.metadata?.sessionID;
  if (result?.metadata?.status !== 'completed' || typeof child !== 'string' || !(typeof result.content === 'string' || Array.isArray(result.content))) return;
  if (input.sessionID && input.sessionID !== child) return;
  let line = 'Native child Goal snapshot: unknown (status unavailable).';
  try {
    const session = await getSession(child);
    if (session?.parentID !== event.sessionID || session?.agent !== 'lead') return;
    const goal = await getGoal(child);
    if (goal === null) line = 'Native child Goal snapshot: not set.';
    else if (goal && ['active', 'paused', 'complete'].includes(goal.status) && (goal.reason === undefined || typeof goal.reason === 'string')) {
      const reason = goal.reason === undefined ? 'no reason supplied' : JSON.stringify(goal.reason.slice(0, 300)) + (goal.reason.length > 300 ? ' (truncated)' : '');
      line = `Native child Goal snapshot: ${goal.status}; untrusted reason: ${reason}.`;
    }
  } catch { /* Unknown is not equivalent to absent or complete. */ }
  const note = `${line} Native Goal status is not task verification.`;
  const content = typeof result.content === 'string' ? `${result.content}\n\n${note}` : [...result.content, { type: 'text', text: note }];
  event.result = { ...result, content };
}
