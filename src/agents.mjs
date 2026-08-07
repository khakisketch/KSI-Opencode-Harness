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
  webfetch: "deny",
  websearch: "deny",
  skill: "deny",
}

const testRunnerDeny = [
  "rm -rf *",
  "rm -rf /",
  "git push*",
  "git tag*",
  "docker*",
  "kubectl*",
  "helm*",
  "terraform*",
  "aws*",
  "gcloud*",
  "az*",
  "ssh*",
  "scp*",
  "rsync*",
  "curl* | sh",
  "wget* | sh",
  "chmod 777*",
  "chown root*",
  "sudo*",
  "reboot",
  "shutdown",
  "mkfs*",
  "dd if=*",
  "> /dev/sd*",
];

const testRunnerAllow = [
  "npm test*",
  "yarn test*",
  "pnpm test*",
  "pytest*",
  "cargo test*",
  "go test*",
  "mvn test*",
  "gradle test*",
  "make test*",
  "bash -c *test*",
  "python -m pytest*",
  "node *test*.js",
  "jest*",
  "vitest*",
  "playwright test*",
  "cypress run*",
];

function makeTestRunnerPermission() {
  const perm = { ...readOnly };
  perm.bash = { "*": "deny" };
  for (const pattern of testRunnerDeny) {
    perm.bash[pattern] = "deny";
  }
  for (const pattern of testRunnerAllow) {
    perm.bash[pattern] = "allow";
  }
  return perm;
}

function enforce(config, name, definition) {
  const current = config.agent[name] ?? {};
  config.agent[name] = {
    ...current,
    ...definition,
    permission: {
      ...(typeof current.permission === "object" ? current.permission : {}),
      ...(definition.permission ?? {}),
    },
  };
}

function defineReserved(config, name, definition) {
  config.agent[name] = definition;
}

export function installAgents(config, prompts) {
  config.agent ??= {};

  defineReserved(config, "explore", {
    description:
      "Fast read-only discovery for locating files, symbols, usages, and bounded inventories. Do not use for architecture, roadmap, security, release, regulatory, or final judgment work; use reviewer or risk-analyst instead.",
    mode: "subagent",
    prompt: prompts.explore,
    permission: readOnly,
  });

  defineReserved(config, "test-runner", {
    description:
      "Local test execution agent. Runs test suites, collects logs, and returns structured summaries (pass/fail, key errors, timing). Does not modify code. Use freely during implementation loops.",
    mode: "subagent",
    prompt: prompts["test-runner"],
    permission: makeTestRunnerPermission(),
  });

  defineReserved(config, "reviewer", {
    description:
      "Adversarial code reviewer. Reviews changes with fresh context, withheld producer reasoning. Finds bugs, design flaws, security issues, and maintenance risks. Called at checkpoints by Plan or Build.",
    mode: "subagent",
    prompt: prompts.reviewer,
    permission: { ...readOnly, webfetch: "allow", websearch: "allow", skill: "allow" },
  });

  defineReserved(config, "risk-analyst", {
    description:
      "Read-only Sol-tier authority for security, authorization, privacy, customer data, release, deployment, migration, billing, incident, legal, regulatory, medical, or irreversible architecture judgments and go/no-go decisions.",
    mode: "subagent",
    prompt: prompts["risk-analyst"],
    permission: { ...readOnly, webfetch: "allow", websearch: "allow", skill: "allow" },
  });
}