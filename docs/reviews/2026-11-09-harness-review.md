# KSI OpenCode Harness — External Review Brief

- Date: 2026-11-09
- Repository: <https://github.com/khakisketch/KSI-Opencode-Harness>
- Raw review URL after merge: <https://raw.githubusercontent.com/khakisketch/KSI-Opencode-Harness/main/docs/reviews/2026-11-09-harness-review.md>
- Review target: `main` at the merge commit of this PR (base `725a666`, PR #12 merged), including the evidence-grounded Plan and depth-2 single-edge changes
- Scope: the portable harness, its installed configuration, and the evidence behind the current claims. Machine-local model pins and the Site Intelligence product repository are called out separately.

This brief is intentionally self-contained so an external reviewer can evaluate the design without reading the surrounding Korean documentation first.

> **Post-review cleanup (2026-11-09):** the unused `/oc` PR-review workflow and Serena MCP were removed after this review because they added CI-secret, process and tool surface without demonstrated use. The state below is preserved for traceability.

## 1. What the harness is

A portable, Native-first OpenCode harness for product development. It deliberately has **four roles, delegation depth 2 with a single Plan→Explore edge, no workflow engine, and no mandatory review gates**. Build is the sole development owner; Plan, General and Explore support it. Beads owns durable task state; Sleev is an optional context gateway; project canon owns product truth.

The design goal is not "more agents" or "more instructions". The goal is a short operating contract plus a real product loop: understand the task, decide, implement, run the product, inspect the rendered result, correct, and report verified behavior.

## 2. Fixed constraints

These constraints come from the project owner and bound any review recommendation:

1. Roles are Build / Plan / General / Explore. No Design agent.
2. Delegation depth is 2, but the only second-level edge is Plan→Explore. General and Explore are leaves; Build is the only root.
3. Build owns the goal, implementation, integration and final quality.
4. Do not add agents, a workflow engine, mandatory review gates, or global skill installs.
5. Optional read-only review and observation are allowed; they are not gates.
6. Judge the harness by real product execution and user-task success, not document or skill counts.
7. AI PR review runs only when a PR comment contains `/oc`; `share: false`; it may comment but must not edit code, push, approve or merge.
8. Jev is an optional decisions API. There is no automatic routing and no fixed call threshold.
9. Do not change real product repositories, global services, credentials or permissions without approval.
10. Session Observer is removed; Native session lookup, resume, restart and compaction replace it.

## 3. Current architecture

| Component | Responsibility | Explicit non-responsibility |
|---|---|---|
| **Build** | Goal interpretation, context, implementation, delegation, integration, verification, correction | Does not delegate final ownership |
| **Plan** | Advisory design partner for consequential or uncertain work: alternatives, causes, risks, work plan. May call Explore for missing evidence | Cannot implement, approve or own the task; cannot call General or another Plan; not a gate |
| **General** | Bounded, self-contained execution with changed behavior, checks and risks returned | Does not own integration or final quality; calls no subagents |
| **Explore** | Read-only investigation of code, docs and external material | Does not implement; calls no subagents |
| **Beads** | Multi-step task state, dependencies, resume | Not a workflow gate; not product canon |
| **Sleev** | Optional context optimization between OpenCode and a provider | Does not replace Beads, canon or session state |
| **Native tools + skills + MCP** | Git, worktrees, browser, Playwright, tests, Context7, Mobbin, design skills | Skills are loaded only when their trigger matches |

Plan may use Explore for missing evidence. Build consults Plan before implementation, when constraints change, or after verification reveals a problem. The consultation is never a mandatory gate. General and Explore cannot spawn subagents.

## 4. What changed, and why

### 4.1 Roles and process

| Before | Now | Reason |
|---|---|---|
| Five roles including Design | Four roles; Design retired | A/B showed optional Design was called 0/2 times; a forced call slightly improved IA but doubled task time. UI judgment stays with Build and real rendered checks. |
| Session Observer agent | Removed; Native session state | Observer duplicated Native lookup/resume/restart/compaction and added a permanent agent surface. |
| Lead Goal layer | Removed | Build owns the goal; the extra layer added routing without measured value. |
| `ksi-visual-workflow` plugin | Retired | It encoded a workflow the harness no longer wants. |
| `ai-memory` | Retired | Duplicated project canon and task state. |
| Automatic AI PR review | On-demand `/oc` PR comment | The action supports only `issue_comment` and `pull_request_review_comment`; automatic review was not reliably triggered. Review comments only, no edits/push/approve/merge. |

### 4.2 Instructions and context

| Before | Now | Reduction |
|---|---|---|
| `global/AGENTS.md`: 1,664 words, 13 long principles | 359 words, 31 lines, single operating contract | -78% words |
| Project `AGENTS.md`: 813 words / 155 lines, dominated by a generated Beads block | 241 words / 40 lines, a map plus a three-line Beads pointer | -70% words |
| Beads usage duplicated in every project file | `bd prime` is the detail source | Removes one source of drift |
| Native features re-explained in instructions | Native behavior is referenced, not restated | Less prompt weight |
| UI pattern catalog in global instructions | Structure decision from the user's task; design skills when relevant | Avoids prescribing patterns blindly |

The current global instruction set covers only: own the goal and frame open problems; read the project map and canon; keep task plans disposable; use Plan as an advisor; delegate bounded independent work; load the narrowest skill; Jev is optional; assess UI against the real task; verify actual behavior; use existing task state; preserve contracts and permissions; honor analysis-only and stop instructions; report verified outcomes honestly.

### 4.3 Skills and tooling

| Item | Current state |
|---|---|
| External skill library | Anthropic Engineering + Design, 17 skills, pinned at commit `e050c2ec856373787143d7057663a6ebd1277df3`, installed per project, no plugin manifest or MCP |
| Impeccable | One canonical copy under the OpenCode config skills directory; duplicate removed |
| Oil UI | Project-local optional skill for new-screen direction; not globally installed; no controlled comparison against Impeccable yet |
| Context7 | Plugin path, not a duplicate MCP server |
| Mobbin | Optional reference MCP |
| Model routing | No automatic router. Plan uses a stronger machine-local model; Explore uses a lower-cost model; Build and General inherit the session model |
| Jev | Optional decisions API, no automatic call threshold; one Beads issue remains for a CI direct-vs-delegated check |

## 5. Current operating loop

1. Build reads the project map and only the canon relevant to the task.
2. If direction, architecture, data contracts or UI structure are genuinely open, Build asks Plan for alternatives, risks and a work plan.
3. Multi-step work is tracked in Beads; simple edits need no issue.
4. Build implements directly or delegates a bounded independent task to General/Explore. Parallel file-touching workers use worktrees.
5. Build verifies actual behavior: run the product, tests, browser interaction, logs or visual evidence. Deterministic checks are evidence, not product acceptance.
6. Only durable decisions are promoted to the owning canon; task plans stay disposable.
7. Delivery goes through the project's PR/CI path. AI review is requested only with `/oc`.

## 6. Verification evidence

Run from the repository root:

```bash
node scripts/verify-harness.mjs --all
```

Latest local result (2026-11-09):

- 7/7 checks passed
- Offline: 1/1
- Native delegation: 4/4 (242/242 assertions). Chain C proves real Build→Plan→Explore nesting; Explore reads the scope and its bytes return through Plan to Build.
- Installed roles and inventory: 2/2
- Permission probes: Plan→Explore allow, Plan→General deny, General/Explore→Plan/General/Explore deny
- Installed `AGENTS.md` byte-identical to the portable source
- Plan skill permission probes: `diagnosing-bugs`, `evolving-apis-and-schemas`, `reviewing-security` all allowed
- Real root Plan probe: read the repository, cited files/lines, separated verified facts from assumptions and missing evidence, and found a missing installed-vs-source parity check. `tests/plan-parity.test.mjs` now covers description, mode, depth and subagent policy; machine-local model pins and non-subagent tool denies are allowed.
- Design delivery contract added (`docs/design-work.md`); `/oc` now requires an owner/member/collaborator author. `be-ambitious` is installed project-locally in the harness (pinned commit `dc116a3`, SHA-256 `b180b9…`), but has not been benchmarked on a product task.
- GitHub CI on `main`: success after PR #11

What this proves: instruction structure, role configuration, delegation mechanics including the single depth-2 Plan→Explore edge, installed/source parity and permission effects. It also records one observed evidence-grounded Plan session, not a general planning-quality benchmark.

What it does **not** prove: general real-model design or planning quality, product acceptance, controlled comparison against Codex/Claude Code, or Sleev's optimization benefit.

## 7. Machine-local state versus portable source

The portable source is `global/AGENTS.md` and `global/opencode.jsonc`. It is model-agnostic.

This Mac's installed configuration adds:

- Plan: `opencode-go/muse-spark-1.3-contributor#xhigh`
- Explore: `opencode-go/deepseek-v4.1-flash#high`
- Build and General: inherit the session model
- Sleev: `opencode-go` routed through `http://127.0.0.1:17321`
- Sleev probe: `opencode run --model opencode-go/deepseek-v4.1-flash` returned `SLEEV-OK`
- Sleev gateway: healthy; configuration is backed up; `sleev harness opencode disable --all` reverts the route

Sleev is **not** in the portable source. Its quality, token and cost benefit has not been re-measured after re-enabling; only the routing path is verified.

## 8. Real-product validation status

Target: the Site Intelligence two-epoch spatial comparison screen.

Completed:

- Located the real product repository and its local run path (`npm run dev:local`).
- Confirmed Playwright configuration, four viewport projects, seeded OIDC stack and existing analysis E2E evidence.
- Added a one-command entry point: `npm run test:e2e:analysis`.
- Fixed Playwright collecting Vitest `.test.ts` files under `analysis-e2e/` by pinning `testMatch` to `**/*.spec.ts`.
- Fixed a macOS `/var` versus `/private/var` runtime-root mismatch with `realpathSync(tmpdir())`.

Current blocker:

- The core fixture uses Linux-only `SO_PEERCRED` socket credentials. On macOS it fails with `inspection socket identity differs`. Config loading, test selection and fixture initialization are reached; the full analysis round-trip requires Linux/CI.

The product repository also contains concurrent, unrelated work on a previous-result comparison feature. Those files are not part of this harness review and were not modified or committed by the harness work.

## 9. Known limitations and open issues

1. **AI PR review is not executable yet.** No `OPENCODE_API_KEY` secret is configured in the repository, so a `/oc` comment cannot run the review workflow. The workflow shape is correct; the secret is missing.
2. **Sleev benefit is unmeasured.** Routing works; context quality, token use and cost are not re-measured.
3. **Oil UI versus Impeccable is unmeasured.** The overlap is narrowed by documentation (new-screen direction vs existing-product improvement), not by a controlled task comparison.
4. **Observer removal leaves gaps.** There is no automated regression for failed-child observation, interrupt handling or permission-wait scenarios; Native session state is the replacement.
5. **Full analysis E2E is macOS-blocked.** It needs Linux/CI for the native socket-credential check.
6. **Oil UI portability.** `skills-lock.json` references `oil-oil/oil-ui`, but the skill directory is gitignored and project-local. A fresh clone will not have the skill; decide whether to add an installer or keep the lock entry as machine-local intent.
7. **Product changes are uncommitted.** The Site Intelligence one-command entry and two Playwright fixes are in the working tree, not committed, because the product repository has concurrent user work.
8. **No controlled comparison against other harnesses.** The current evidence supports mechanism and instruction quality, not a claim of superior product outcomes versus Codex or Claude Code.

## 10. Questions for the external reviewer

1. Is a 31-line, 359-word global instruction set sufficient to preserve Build ownership, Plan advisory use, verification discipline and safety boundaries without over-constraining autonomy?
2. Are any responsibilities still duplicated between `global/AGENTS.md`, `global/opencode.jsonc`, the project map and the docs?
3. Does the Beads / Sleev / canon split hold in practice, or does it create three competing state layers?
4. Are there contradictions or stale claims left in `README.md`, `docs/development.md`, `docs/installation.md`, `docs/validation.md` or `docs/architecture/decisions.md`?
5. Is the verification evidence adequate for the claims, and which claim is still overstated?
6. What is the highest-value next step: Linux/CI analysis E2E, a Sleev A/B, an Oil UI versus Impeccable task comparison, or wiring the AI PR review secret?
7. Does the on-demand `/oc` PR review design preserve the intended boundary (comments only, no code changes, no approval, no merge)?
8. Is there any reason to reintroduce Design or Observer that the current evidence does not support?

## 11. Key files

- `global/AGENTS.md` — portable operating contract
- `global/opencode.jsonc` — roles, permissions, model-agnostic agent definitions
- `AGENTS.md` — project map and Beads pointer
- `README.md` — current architecture and usage
- `docs/development.md` — development loop, Sleev and Beads notes
- `docs/installation.md` — installed configuration and machine-local pins
- `docs/validation.md` — historical evidence and current limitations
- `docs/architecture/decisions.md` — 21 durable decisions
- `scripts/verify-harness.mjs` — offline/native/installed verification
- `tests/agent-routing-native.mjs` — role, delegation and Plan skill probes
- `external/anthropic-knowledge-work-plugins/` — pinned skill library
- `.github/workflows/opencode-review.yml` — on-demand `/oc` review workflow
