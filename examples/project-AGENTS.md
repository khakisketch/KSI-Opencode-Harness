# Product completion with OpenCode

KSI is a minimal set of product-development principles, not an agent runner or approval pipeline.

1. **Goal.** Follow approved requirements and observable acceptance criteria. Clarify material ambiguity; do not invent scope. Code and tests show implementation state, not approval.
2. **Implementation.** Complete the feature and its integration. Preserve user work and existing API/data/auth/permission/business contracts. Use the existing Design Specialist when material visual judgment is needed; simple mechanical edits need no handoff.
3. **Evidence.** Use existing project checks and real user flows in proportion to risk. UI changes need actual renders; saving needs persistence/reload evidence. Reuse valid same-state results and recheck affected behavior after edits. Agent review is not execution evidence.
4. **Repair.** Fix relevant defects within approved scope without routine re-approval. Ask only for material scope/design/security/data/cost decisions or genuine blockers. Failed or missing required checks cannot be called complete.
5. **Finish.** Stop when acceptance, integration and required verification are satisfied. Report usable results, checks and gaps; distinguish technical completion, user acceptance and external delivery. Do not create more work to keep agents running.

Protect secrets and unrelated changes. External delivery (including merge), new services/model recipients/credential or profile access, and destructive/security-sensitive changes need target/effect authorization. Verified task-owned local commits are allowed; no history rewriting or force-push.
