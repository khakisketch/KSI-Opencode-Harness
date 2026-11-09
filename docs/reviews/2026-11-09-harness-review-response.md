# KSI OpenCode Harness — 외부 아키텍처 리뷰 응답 (ChatGPT 검토, 2026-11-09)

- Date: 2026-11-09
- Review: [2026-11-09-harness-review.md](2026-11-09-harness-review.md) (PR #16, review target `b6a8926`)
- Response: 2026-11-09, follow-up fixes in PR #18 (Context7 wording, decision #18 dating)
- Review verdict under response: **KEEP** — with two documentation defects corrected during response

This response is Build's critical read-back of the external review and the fixes applied while answering it.

## 1. 총평

The external review concluded **KEEP** — keep the current structure, make small improvements if any. The response agrees.

Build ownership, the Plan-as-advisor contract, the four-role split, the depth-2 single-edge and the instruction compression were all reviewed against current source and tests during this response cycle. None required structural change. The review's central claim — that a harness is only as good as its real product loop, not its agent count — is accepted as project canon.

## 2. Findings and responses

### H1 — Plan/Explore non-mutation boundary (High) → **not a defect; verified enforceable**

The review pointed at the permission surface and noted that configured subagent-call denies are not the same as file-write non-mutation, and that Native default edit restrictions do not by themselves guarantee blocking shell/CLI write paths; `docs/development.md` acknowledged this.

During this response cycle the enforcement chain was verified end to end:

- Source: `global/opencode.jsonc` gives Plan only an Explore subagent edge (deny all, allow explore) and Explore a full subagent deny; no retired roles; no agent `system` override (Native prompt applies).
- Runtime probes: `tests/agent-routing-native.mjs` asserts that a Plan session denies ordinary edits (repo-relative and `/tmp` paths) and that Explore denies edits, in addition to subagent-call denies.
- Design note retained: strict non-mutation requires explicit session restrictions or actual isolation, not only the edge allowlist — the session-level denies are the mechanism that satisfies this.

Conclusion: the boundary is enforced by deny rules plus tested session permission effects; the residual OS-level isolation gap is a known, accepted boundary, not a shipped contradiction. No change made.

### H2 — Context7 registration wording (High) → **genuine defect; fixed in PR #18**

Source (`global/opencode.jsonc`) and `docs/installation.md` genuinely contradicted each other on whether the official plugin and the explicit MCP server may coexist.

- Source: use exactly one of the MCP server or the plugin; enabling both registers the same Context7 tools twice.
- Install doc (before fix): claimed both were kept and that the plugin does not duplicate the MCP registration.

Resolution in PR #18: documentation now states the explicit MCP server path is currently active, the plugin is an alternative path, and both must not be enabled together.

### M1 — Reproducibility of product validation (Medium) → **accepted, unchanged**

The review correctly noted that the product repository's comparison-screen work is uncommitted and that the full analysis E2E needs Linux/CI. The response treats UI validation as runnable before full pipeline acceptance, per the scope distinction already recorded in the review brief.

### M2 — Portable vs local boundary (Medium) → **accepted as documentation boundary**

### L1 — Stale instruction-compression figures (Low) → **fixed in PR #18**

Decision #18 recorded the 2026-11-08 compression (1,664→359 words / 813→225) while the current brief carried later figures (459 words / 38 lines global; 267 words / 43 lines project). The decision record is now dated and contextualized.

## 3. What was changed while answering the review

- PR #18: `docs/installation.md` (Context7 path wording), `docs/architecture/decisions.md` (decision #18 dating/context).
- No agents, skills, workflow engine, review gate, model pins or product changes were introduced — the fixed constraints were respected throughout.

## 4. Responses to the review's ten questions

1. **Is 38 lines / 459 words enough?** Yes for the operating contract; safety cannot be fully instruction-enforced, and the response accepts that while keeping tested deny boundaries.
2. **Remaining duplication?** No core overlap; install-state repetition is minor and accepted.
3. **Beads / Sleev / canon split?** Holds; Beads is task state, not product canon or memory.
4. **Stale claims?** Context7 and decision #18 were stale — both fixed in PR #18.
5. **Verification adequate?** Mechanism yes; real-model quality and product acceptance no — stated explicitly and accepted.
6. **Highest-value next step?** Site Intelligence comparison-screen real UI validation.
7. **`/oc` and Serena removal right?** Yes; optional narrow re-introduction remains possible.
8. **Design/Observer revival?** Not supported by current evidence.
9. **CUA/Mobbin justified?** CUA for native GUI use cases; Mobbin optional design reference.
10. **Cut from 14 bullets?** None cut; no compression pressure remains.

## 5. Final judgment

Usable for general product development. Conditional for long-running development; additional protection required for sensitive environments.

The harness's decisive advantage remains the move away from agent-count maximization toward Build execution ownership plus real rendered-result verification.

## 6. Follow-ups (not changed in this response cycle)

- Real product UI validation (Site Intelligence comparison screen).
- Sleev / Oil UI / be-ambitious A/B comparisons.
- Linux analysis E2E for full pipeline acceptance.
- Optional narrow re-introduction of read-only review tooling.

## 7. Reviewer's closing instruction, honoured

"확인하고 검증하는 건 내가 개발하면서 너가 나중에 기록보고 하도록 하고 지금은 개선 가능한 것만 개선하도록 해"

Applied: the response performed verification-of-claims and made only the two improvable documentation fixes (PR #18); deeper product verification was handed back as the user's development task.
