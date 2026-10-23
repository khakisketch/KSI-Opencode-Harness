---
name: task-first-ux-review
description: >
  Review a UI change from the user's task outward: what they must see and do
  first, what folds away, how alternatives compare, what the change gains and
  loses, and whether the task got easier on the real product. Use when screen
  structure, main flows, or key operations change, or when usability problems
  repeat. Optional; small, clear fixes skip it entirely.
---

# Task-first UX review

A lightweight review method for UI changes. It is a way of judging, not a
gate: no question quotas, no score tables, no report folders, no approval
steps, no fixed iteration counts. Small, clear fixes skip it entirely.

## When to use

- Screen structure, main flows, or key operations change.
- The same kind of usability problem recurs.
- A simplification or rearrangement is proposed and its cost is unclear.

## Method

1. **Scene.** Who does what, in which situation, to finish what? One or two
   lines. If the scene is unclear, clarify the direction before building,
   not after.
2. **Composition.** What must be seen and done first? What appears on demand?
   What folds away, and why there? Check whether visual prominence matches task
   importance, rather than merely accommodating all available features.
3. **Alternatives.** What does the current composition do? How do established
   products solve the same task? Adopt only what fits this task; never copy a
   pattern that serves a different job.
4. **Trade-offs.** State what the change gains and what it loses. Required
   evidence, recovery paths, and safety information must stay discoverable.
   Challenge the layout hypothesis: which user action would expose it as wrong,
   and what observation would make you change it? Fewer words or controls alone
   is not improvement; do not manufacture problems to justify a redesign.
5. **Real check.** Perform the task on the real product build: normal, empty,
   and problem states. Distinguish whether the intended design was implemented
   from whether that design actually helps the task. Fix the implementation or
   revise the design accordingly, then re-check the affected task. Reuse valid
   evidence; report what could not be verified instead of treating it as passing.

## Boundaries

- Technical identifiers, hashes, and process history fold before anything that
  lets a person recognize the actual site, asset, or result — unless the task
  itself is about those identifiers.
- Prefer direct manipulation people already know (drag, wheel, touch) unless
  explicit controls serve the task better (precision, accessibility,
  discoverability). Judge by whether the primary task gets easier; a control
  that is easy to script is not automatically easy to use.
- Simulation, mocks, and real device behavior stay distinguished; limits are
  reported as unverified, not as passing.
- Use `journey`/`organize`/`wireframe` and Impeccable where they help; this
  method does not replace them. Do not invent product claims to fill a layout.
