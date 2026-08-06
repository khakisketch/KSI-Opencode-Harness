const readOnly = {
  "*": "deny",
  read: {
    "*": "allow",
    "*.env": "deny",
    "*.env.*": "deny",
    "**/.env": "deny",
    "**/.env.*": "deny",
    "**/*credentials*": "deny",
    "*credentials*": "deny",
    "**/auth.json": "deny",
    "auth.json": "deny",
    "**/.npmrc": "deny",
    ".npmrc": "deny",
    "**/.pypirc": "deny",
    ".pypirc": "deny",
    "**/*.pem": "deny",
    "*.pem": "deny",
    "**/*.key": "deny",
    "*.key": "deny",
    "**/*.p12": "deny",
    "*.p12": "deny",
    "**/*.pfx": "deny",
    "*.pfx": "deny",
    "**/id_rsa": "deny",
    "id_rsa": "deny",
    "*.env.example": "allow",
    "**/.env.example": "allow",
  },
  glob: "allow",
  grep: "allow",
  list: "allow",
  edit: "deny",
  bash: "deny",
  task: "deny",
}

function enforce(config, name, definition) {
  const current = config.agent[name] ?? {}
  config.agent[name] = {
    ...current,
    ...definition,
    permission: {
      ...(typeof current.permission === "object" ? current.permission : {}),
      ...(definition.permission ?? {}),
    },
  }
}

function defineReserved(config, name, definition) {
  config.agent[name] = definition
}

export function installAgents(config, prompts) {
  config.agent ??= {}

  defineReserved(config, "explore", {
    description:
      "Fast read-only discovery for locating files, symbols, usages, and bounded inventories. Do not use for architecture, roadmap, security, release, regulatory, or final judgment work; use ksi-analyst or ksi-risk-analyst instead.",
    mode: "subagent",
    prompt: prompts.explore,
    permission: readOnly,
  })

  defineReserved(config, "ksi-analyst", {
    description:
      "Read-only Terra-tier analyst for cross-file synthesis, architecture tradeoffs, roadmap reconciliation, feasibility analysis, and evidence-backed recommendations that are not high-risk final judgments.",
    mode: "subagent",
    prompt: prompts.analyst,
    permission: { ...readOnly, webfetch: "allow", websearch: "allow", skill: "allow" },
  })

  enforce(config, "general", {
    description:
      "Terra-tier implementation worker for complex multistep coding, testing, and bounded execution after product behavior and high-risk decisions are settled.",
  })

  defineReserved(config, "ksi-risk-analyst", {
    description:
      "Read-only Sol-tier authority for security, authorization, privacy, customer data, release, deployment, migration, billing, incident, legal, regulatory, medical, or irreversible architecture judgments and go/no-go decisions.",
    mode: "subagent",
    prompt: prompts["risk-analyst"],
    permission: { ...readOnly, webfetch: "allow", websearch: "allow", skill: "allow" },
  })
}
