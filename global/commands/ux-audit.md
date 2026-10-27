---
description: Audit a screen or flow against UX heuristics and accessibility using rendered evidence.
---

Load `skill({ id: "ux-heuristics-audit" })` and `skill({ id: "building-accessible-interfaces" })` before working.

Audit $ARGUMENTS.

- Base findings on the actual rendered interface at the target viewports and interaction states, not on code alone.
- Report each issue with severity, the violated heuristic, and a concrete fix.
- State which checks you could not perform and why.
