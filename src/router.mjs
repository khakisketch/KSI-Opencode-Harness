export const AGENT_MODEL_CONFIG = {
  openai: {
    explore: { modelID: "gpt-5.6-luna", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    "test-runner": { modelID: "gpt-5.6-luna", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    reviewer: { modelID: "gpt-5.6-terra", tier: "terra", variant: "xhigh", temperature: 0.0, maxTokens: 256000 },
    "risk-analyst": { modelID: "gpt-5.6-sol", tier: "sol", variant: "xhigh", temperature: 0.0, maxTokens: 512000 },
  },
  alibaba: {
    explore: { modelID: "qwen3-235b-a22b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    "test-runner": { modelID: "qwen3-235b-a22b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    reviewer: { modelID: "qwen3-235b-a22b", tier: "terra", variant: "xhigh", temperature: 0.0, maxTokens: 256000 },
    "risk-analyst": { modelID: "qwen3-235b-a22b", tier: "sol", variant: "xhigh", temperature: 0.0, maxTokens: 512000 },
  },
  deepseek: {
    explore: { modelID: "deepseek-v3", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    "test-runner": { modelID: "deepseek-v3", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    reviewer: { modelID: "deepseek-v3", tier: "terra", variant: "xhigh", temperature: 0.0, maxTokens: 256000 },
    "risk-analyst": { modelID: "deepseek-r1", tier: "sol", variant: "xhigh", temperature: 0.0, maxTokens: 512000 },
  },
  local: {
    explore: { modelID: "qwen3.6-35b-a3b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    "test-runner": { modelID: "qwen3.6-35b-a3b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    reviewer: { modelID: "qwen3.6-35b-a3b", tier: "terra", variant: "xhigh", temperature: 0.0, maxTokens: 256000 },
    "risk-analyst": { modelID: "qwen3.6-35b-a3b", tier: "sol", variant: "xhigh", temperature: 0.0, maxTokens: 512000 },
  },
  "local-reviewer": {
    explore: { modelID: "qwen3.6-35b-a3b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    "test-runner": { modelID: "qwen3.6-35b-a3b", tier: "luna", variant: "high", temperature: 0.1, maxTokens: 128000 },
    reviewer: { modelID: "qwen3.6-35b-a3b", tier: "terra", variant: "xhigh", temperature: 0.0, maxTokens: 256000 },
    "risk-analyst": { modelID: "qwen3.6-35b-a3b", tier: "sol", variant: "xhigh", temperature: 0.0, maxTokens: 512000 },
  },
};

const TIER_RANK = { luna: 0, terra: 1, sol: 2 };
const EFFORT_RANK = { none: 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };
const LOCAL_SUBAGENTS = new Set(["explore", "test-runner", "reviewer"]);

const SYNTHESIS =
  /\b(reconcile|design|architecture|roadmap|trade-?offs?|propos(?:e|al)|acceptance criteria|prioriti[sz]e|audit|assess|review|validate|recommend|completion plan|system boundar(?:y|ies))\b|종합|조정|설계|아키텍처|로드맵|트레이드오프|제안|수용 기준|우선순위|감사|평가|검토|검증|권고|시스템 경계/i;

const RISK_DOMAIN =
  /\b(security|auth(?:entication|orization)?|oauth|oidc|sso|rbac|permissions?|privacy|credentials?|secrets?|tenants?|customer data|pii|phi|gdpr|hipaa|vulnerabilit(?:y|ies)|cve|supply chain|releases?|deployments?|rollouts?|rollback|migrations?|backfill|billing|payments?|incidents?|regulat(?:ion|ory)?|legal|medical device|production)\b|보안|인증|인가|권한|개인정보|자격 증명|비밀|테넌트|고객 데이터|취약점|공급망|출시|배포|롤아웃|롤백|마이그레이션|백필|결제|사고|규제|법률|의료기기|운영/i;

const JUDGMENT =
  /\b(final|verdict|approve|approval|go[ /-]?no[ /-]?go|go live|sign-?off|decide|decision|proceed|block|readiness|(?:should|can|may|do) (?:(?:we|i|the team) )?(?:ship|launch|merge|deploy|roll out|go live|proceed|revoke|rotate|delete|purge|destroy|disable|terminate|expose|disclose)|ready to (?:ship|launch|release)|safe to (?:ship|launch|release|deploy)|risk acceptance|accept risk|final architecture)\b|최종|판정|승인|결정|진행 여부|진행해도|해도 되는|폐기해도|삭제해도|회수해도|교체해도|출시 가능|배포 가능|준비 완료|위험 수용|최종 아키텍처|고위험 판단/i;

function textFromParts(parts = []) {
  return parts
    .filter((part) => part?.type === "text" && !part.synthetic)
    .map((part) => part.text ?? "")
    .join("\n");
}

function marker(text, name, values) {
  const match = text.match(new RegExp(`\\[${name}:(${values.join("|")})\\]`, "i"));
  return match?.[1]?.toLowerCase();
}

function getAgentForTier(providerConfig, tier) {
  for (const [agentName, agentConfig] of Object.entries(providerConfig)) {
    if (agentConfig.tier === tier) return agentConfig;
  }
  return null;
}

function promote(route, tier, variant, reason, providerConfig) {
  if (TIER_RANK[tier] > TIER_RANK[route.tier]) {
    const targetAgentConfig = getAgentForTier(providerConfig, tier);
    if (targetAgentConfig) {
      route.tier = tier;
      route.variant = variant;
      route.modelID = targetAgentConfig.modelID;
      route.temperature = targetAgentConfig.temperature;
      route.maxTokens = targetAgentConfig.maxTokens;
    }
    route.reason.push(reason);
    return;
  }
  if (TIER_RANK[tier] === TIER_RANK[route.tier] && EFFORT_RANK[variant] > EFFORT_RANK[route.variant]) {
    route.variant = variant;
    route.reason.push(reason);
  }
}

function getProviderConfig(model) {
  const provider = model?.providerID;
  return AGENT_MODEL_CONFIG[provider] || AGENT_MODEL_CONFIG.openai;
}

export function selectRoute({ model, agent, parts }) {
  if (!agent) return;
  const requestedProvider = model?.providerID || "openai";
  const useLocalSubagents = requestedProvider !== "openai";
  const localSubagent = useLocalSubagents && LOCAL_SUBAGENTS.has(agent);
  const providerID = localSubagent ? "local" : requestedProvider === "local-reviewer" ? "local" : requestedProvider;
  const config = getProviderConfig({ providerID });
  const agentConfig = config[agent];
  if (!agentConfig) return;

  const text = textFromParts(parts);
  const route = { ...agentConfig, agent: undefined, reason: [`agent:${agent}`] };

  if (RISK_DOMAIN.test(text) && JUDGMENT.test(text)) {
    const riskProviderID = requestedProvider === "local" || requestedProvider === "local-reviewer" ? "openai" : requestedProvider;
    const riskConfig = getProviderConfig({ providerID: riskProviderID });
    route.providerID = riskProviderID;
    promote(route, "sol", "xhigh", "high-risk-judgment", riskConfig);
    route.agent = "risk-analyst";
  }

  const requestedTier = marker(text, "(?:route|tier)", Object.keys(TIER_RANK));
  if (requestedTier) promote(route, requestedTier, requestedTier === "luna" ? "high" : "xhigh", "explicit-tier", config);

  const requestedEffort = marker(text, "effort", Object.keys(EFFORT_RANK));
  if (requestedEffort === "max") promote(route, "sol", "max", "explicit-max-effort", config);
  else if (requestedEffort && EFFORT_RANK[requestedEffort] > EFFORT_RANK[route.variant]) {
    route.variant = requestedEffort;
    route.reason.push("explicit-effort");
  }

  return {
    providerID: route.providerID ?? providerID,
    modelID: route.modelID,
    tier: route.tier,
    variant: route.variant,
    temperature: route.temperature,
    maxTokens: route.maxTokens,
    agent: route.agent,
    reason: route.reason,
  };
}
