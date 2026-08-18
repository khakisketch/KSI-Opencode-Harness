export const UNRESTRICTED_PERMISSION = {
  "*": "allow",
  read: "allow",
  edit: "allow",
  glob: "allow",
  grep: "allow",
  list: "allow",
  bash: "allow",
  task: "allow",
  external_directory: "allow",
  todowrite: "allow",
  question: "allow",
  webfetch: "allow",
  websearch: "allow",
  lsp: "allow",
  doom_loop: "allow",
  skill: "allow",
  plan_enter: "allow",
  plan_exit: "allow",
};

export const PLAN_PERMISSION = {
  "*": "deny",
  read: {
    "*": "allow",
    "*.env": "deny",
    "*.env.*": "deny",
    "*.env.example": "allow",
  },
  glob: "allow",
  grep: "allow",
  list: "allow",
  skill: "allow",
  question: "allow",
  plan_exit: "allow",
  todowrite: "allow",
  webfetch: "allow",
  websearch: "allow",
  external_directory: "deny",
  doom_loop: "deny",
  edit: {
    "*": "deny",
    ".opencode/working-state.md": "allow",
  },
  bash: "deny",
  task: {
    "*": "deny",
    explore: "allow",
    analyst: "allow",
    "risk-analyst": "allow",
  },
};

function defineReserved(config, name, definition) {
  config.agent[name] = definition;
}

export function installAgents(config, prompts) {
  config.agent ??= {};
  config.agent.plan = { ...(config.agent.plan ?? {}), permission: PLAN_PERMISSION };

  defineReserved(config, "developer", {
    description:
      "Write-capable local coding agent for approved, bounded repository changes. Build targets safe two-Developer waves with disjoint ownership, supplies compact task contracts and evidence pointers, and falls back to one Developer for coupled or undersized work; the agent implements and verifies narrowly and escalates product, architecture, contract, security, data, and operational decisions.",
    mode: "subagent",
    steps: 40,
    prompt: prompts.developer,
    permission: { ...UNRESTRICTED_PERMISSION },
  });

  defineReserved(config, "explore", {
    description:
      "Fast read-only discovery for locating files, symbols, usages, and bounded inventories. Do not use for architecture, roadmap, security, release, regulatory, or final judgment work; use reviewer or risk-analyst instead.",
    mode: "subagent",
    steps: 12,
    prompt: prompts.explore,
    permission: { ...UNRESTRICTED_PERMISSION },
  });

  defineReserved(config, "test-runner", {
    description:
      "Independent GPT-5.3 Codex Spark test execution agent. Run it after implementation waves to execute trusted test suites, collect logs, and return structured summaries. It does not edit by role, but test subprocesses are not sandboxed.",
    mode: "subagent",
    prompt: prompts["test-runner"],
    permission: { ...UNRESTRICTED_PERMISSION },
  });

  defineReserved(config, "reviewer", {
    description:
      "Optional advisory reviewer for non-trivial code changes. Uses fresh context to find concrete defects and testing gaps; the primary agent must validate its findings.",
    mode: "subagent",
    prompt: prompts.reviewer,
    permission: { ...UNRESTRICTED_PERMISSION },
  });

  defineReserved(config, "risk-analyst", {
    description:
      "Read-only high-risk authority. OpenAI mains use GPT-5.6 Sol; non-OpenAI mains inherit their selected model and must state that no Sol-tier guarantee applies.",
    mode: "subagent",
    prompt: prompts["risk-analyst"],
    permission: { ...UNRESTRICTED_PERMISSION },
  });
}
