# KSI native execution workflow

## Native roles, delegated execution

Plan supports understanding the project, comparing alternatives, analyzing risks and preparing consequential decisions without implementing ordinary product files. It is not a required stage for every edit or a substitute for an independent reviewer. Build can investigate and plan as part of execution, implement directly, delegate bounded work when authorized and useful, and reconcile the final result. Preserve both native system prompts.

The optional [autonomous local execution policy](../examples/autonomous-development.md) delegates the agreed outcome through implementation, bounded helpers, integration, verification and task-owned local commits. Merge it into the appropriate global/project `AGENTS.md` only after adopting it; package installation does not apply it. This is operating guidance, not permission enforcement or a new runtime.

Do not ask "should I continue?" between authorized tasks. Report meaningful progress and continue. Resolve reversible implementation details inside the agreed contracts; record significant assumptions. Reopen a decision only when material scope, target, effects or risk change, not because a file, test cycle or plan task ended.

## Technical completion and human acceptance

Technical completion requires the agreed implementation/integration and actual verification evidence, plus scoped local commits when allowed by the adopted policy. Report failing/unrun checks honestly. Human product acceptance and external delivery are distinct states: tests do not establish user satisfaction, and pending acceptance does not block remaining authorized engineering work. Technical completion does not authorize a new milestone or unrelated backlog work.

Material product, visual, and interaction design belongs to Local Codex through [the design integration contract](integrations/opendesign.md). Build owns production integration and small changes within approved patterns. Direction approval remains a real decision, not routine progress confirmation. ui-ux-pro-max can inform focused review but does not create a competing design direction.

## Local commits and external delivery

After adoption, coherent verified task-owned local commits are routine delegated work unless the user or repository forbids them. Inspect the index/diff and preserve unrelated user work, secrets and checkpoints. This does not permit history rewriting, force pushes or destructive cleanup. A helper's role alone does not grant Git or publication authority; Build owns completion.

Push, publish and deploy require explicit authorization for the target and relevant effects, including deployment triggered by a push. Authorization may be granted at task start and reused through delivery. Do not ask again unless the target, effects or risk materially change. Native tool approvals, authentication and browser approvals are still required when presented; policy is not a bypass.

## When to return to the user

- The agreed technical outcome is achieved: report changes, checks, commits, delivery and remaining acceptance.
- A material product/data/architecture/design or scope decision is missing, or agreed cost/risk substantially increases.
- A new unapproved external effect or a destructive/security-sensitive action is required.
- A genuine access/information/environment blocker cannot be resolved within scope, or execution budget is exhausted: preserve resumable state and report partial work.

Recoverable failures and intermediate task completion are not stop conditions. Continue independent authorized work if another part is blocked and doing so is safe.

## Delegation and continuity

Parallel work is conditional, not the default. Superpowers' parallel-agent guidance fits independent discovery, review, or bounded implementation with stable interfaces. Read-only helpers can run together; concurrent writers need disjoint ownership and separate worktrees. No additional KSI parallel coordinator role is needed. The Primary that accepts delegated work reconciles results and owns the final claim.

OpenCode V2 keeps its own Build, Plan, and Explore prompts. Three installed `agents/*.md` files define only the additional roles. KSI's installer does not set models, variants, or steps. Existing positive step budgets stay in JSONC or other user-owned configuration; absent values use OpenCode defaults. The default Developer cannot call Test Runner. The explicit `--developer-test-runner` variant changes that permission and prompt, but no runtime plugin exists to limit helper count or pause writes while it runs. Treat helper output as author feedback, not independent acceptance.

There are no KSI slash commands: ask Build to reconcile or complete work and ask Reviewer to examine a change when needed. For continuity, read the project's `AGENTS.md`, `.opencode/working-state.md`, product-state, ledger, and current Git state when relevant; the installer no longer injects these automatically. Use ordinary authorized tools for repository evidence. Six former `ksi_*` evidence tools, automatic archival, and runtime task-contract guards are unavailable. Do not claim they ran. Authority comes from the user/adopted operating policy, not a role or passing test.

Local autonomy is not perpetual background execution. Native session goals, when available, are separate and require an explicit request; do not infer or auto-create/resume goals from ordinary development tasks. Continue only an actually active goal within its native mode and budgets. Tool approval, step limits, context and connectivity can still stop execution; documentation and package tests cannot guarantee long-running model behavior.
