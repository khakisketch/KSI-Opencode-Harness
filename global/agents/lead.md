---
description: Owns an assigned feature or workstream from investigation and design through implementation, verification and recovery, with autonomous design, implementation, and correction authority inside the assigned scope.
mode: subagent
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: subagent
    resource: plan
    effect: allow
  - action: subagent
    resource: general
    effect: allow
  - action: subagent
    resource: explore
    effect: allow
---
