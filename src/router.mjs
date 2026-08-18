export const AGENT_MODEL_CONFIG = {
  openai: {
    explore: { modelID: "gpt-5.4-mini", variant: "medium" },
    "test-runner": { modelID: "gpt-5.3-codex-spark", variant: "medium" },
    reviewer: { modelID: "gpt-5.6-terra", tier: "terra", variant: "high" },
    "risk-analyst": { modelID: "gpt-5.6-sol", tier: "sol", variant: "xhigh" },
  },
  "local-developer": {
    developer: { modelID: "qwen3.8-27b", variant: "quality" },
  },
};

const TIER_RANK = { luna: 0, terra: 1, sol: 2 };
const EFFORT_RANK = { none: 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };
const FIXED_OPENAI_SUBAGENTS = new Set(["explore", "test-runner"]);
const FIXED_LOCAL_SUBAGENTS = new Set(["developer"]);
const ROUTED_AGENTS = new Set(["developer", "explore", "test-runner", "reviewer", "risk-analyst"]);

const RISK_DOMAIN =
  /\b(security|auth(?:entication|orization)?|oauth|oidc|sso|rbac|permissions?|privacy|credentials?|secrets?|tenants?|customer data|pii|phi|gdpr|hipaa|vulnerabilit(?:y|ies)|cve|supply chain|releases?|deploy(?:ment|ments)?|roll(?:out|outs| out)|rollback|migrations?|backfill|billing|payments?|incidents?|regulat(?:ion|ory)?|legal|medical device|production)\b|보안|인증|인가|권한|개인정보|자격 증명|비밀|테넌트|고객 데이터|취약점|공급망|출시|배포|롤아웃|롤백|마이그레이션|백필|결제|사고|규제|법률|의료기기|운영/i;

const JUDGMENT =
  /\b(final|verdict|approve|approval|go[ /-]?no[ /-]?go|go live|sign-?off|decide|decision|proceed|block|readiness|(?:should|can|may|do) (?:(?:we|i|the team) )?(?:ship|launch|merge|deploy|roll out|go live|proceed|grant|run|execute|apply|refund|charge|declare|enable|publish|revoke|rotate|delete|purge|destroy|disable|terminate|expose|disclose)|ready to (?:ship|launch|release)|safe to (?:ship|launch|release|deploy)|risk acceptance|accept risk|final architecture)\b|최종|판정|승인|결정|진행 여부|진행해도|해도 되는|폐기해도|삭제해도|회수해도|교체해도|출시 가능|배포 가능|준비 완료|위험 수용|최종 아키텍처|고위험 판단/i;

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
  const currentTierRank = TIER_RANK[route.tier] ?? -1;
  if (TIER_RANK[tier] > currentTierRank) {
    const targetAgentConfig = getAgentForTier(providerConfig, tier);
    if (!targetAgentConfig) {
      route.reason.push(`${reason}-unavailable`);
      return;
    }
    route.tier = tier;
    route.variant = variant;
    route.modelID = targetAgentConfig.modelID;
    route.reason.push(reason);
    return;
  }
  if (TIER_RANK[tier] === currentTierRank && EFFORT_RANK[variant] > (EFFORT_RANK[route.variant] ?? -1)) {
    route.variant = variant;
    route.reason.push(reason);
  }
}

function inheritedRoute(model, agent, reason) {
  if (!model?.providerID || !model?.modelID) return;
  return {
    providerID: model.providerID,
    modelID: model.modelID,
    tier: undefined,
    variant: model.variant,
    agent,
    reason,
  };
}

export function selectRoute({ model, agent, parts }) {
  if (!agent || !ROUTED_AGENTS.has(agent)) return;
  const requestedProvider = model?.providerID || "openai";
  const openai = requestedProvider === "openai";
  const text = textFromParts(parts);
  if (agent === "explore") {
    const route = AGENT_MODEL_CONFIG.openai.explore;
    return { providerID: "openai", ...route, tier: undefined, agent: undefined, reason: ["agent:explore", "fixed-openai"] };
  }
  if (!openai && RISK_DOMAIN.test(text) && JUDGMENT.test(text)) {
    return inheritedRoute(model, "risk-analyst", ["agent:risk-analyst", "high-risk-judgment", "non-openai-main-inheritance"]);
  }
  if (agent === "risk-analyst" && !openai) {
    return inheritedRoute(model, undefined, ["agent:risk-analyst", "non-openai-main-inheritance"]);
  }
  if (agent === "reviewer" && !openai) {
    return inheritedRoute(model, undefined, ["agent:reviewer", "non-openai-main-inheritance"]);
  }

  const fixedOpenAI = FIXED_OPENAI_SUBAGENTS.has(agent);
  const localSubagent = FIXED_LOCAL_SUBAGENTS.has(agent);
  const providerID = fixedOpenAI ? "openai" : localSubagent ? "local-developer" : requestedProvider;
  const config = localSubagent ? AGENT_MODEL_CONFIG["local-developer"] : AGENT_MODEL_CONFIG.openai;
  const agentConfig = config[agent];
  if (!agentConfig) return;

  const route = { ...agentConfig, agent: undefined, reason: [`agent:${agent}`] };

  if (RISK_DOMAIN.test(text) && JUDGMENT.test(text)) {
    if (!openai) {
      return inheritedRoute(model, "risk-analyst", ["agent:risk-analyst", "high-risk-judgment", "non-openai-main-inheritance"]);
    }
    route.providerID = "openai";
    promote(route, "sol", "xhigh", "high-risk-judgment", AGENT_MODEL_CONFIG.openai);
    route.agent = "risk-analyst";
  }

  if (fixedOpenAI || localSubagent) {
    return {
      providerID: route.providerID ?? providerID,
      modelID: route.modelID,
      tier: route.tier,
      variant: route.variant,
      agent: route.agent,
      reason: route.reason,
    };
  }

  const requestedTier = marker(text, "(?:route|tier)", Object.keys(TIER_RANK));
  const promotionConfig = openai ? AGENT_MODEL_CONFIG.openai : config;
  if (requestedTier) {
    if (openai && requestedTier !== "luna") route.providerID = "openai";
    promote(route, requestedTier, requestedTier === "luna" ? "high" : "xhigh", "explicit-tier", promotionConfig);
  }

  const requestedEffort = marker(text, "effort", Object.keys(EFFORT_RANK));
  if (requestedEffort === "max") {
    if (openai) route.providerID = "openai";
    promote(route, "sol", "max", "explicit-max-effort", promotionConfig);
  }
  else if (requestedEffort && EFFORT_RANK[requestedEffort] > EFFORT_RANK[route.variant]) {
    route.variant = requestedEffort;
    route.reason.push("explicit-effort");
  }

  return {
    providerID: route.providerID ?? providerID,
    modelID: route.modelID,
    tier: route.tier,
    variant: route.variant,
    agent: route.agent,
    reason: route.reason,
  };
}
