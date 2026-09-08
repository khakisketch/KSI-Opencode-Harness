export function toEpochMs(value) {
  if (typeof value === "number") return value < 100_000_000_000 ? value * 1000 : value
  if (typeof value !== "string") return null
  const asNumber = Number(value)
  if (Number.isFinite(asNumber)) return asNumber < 100_000_000_000 ? asNumber * 1000 : asNumber
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function sessionDurationMs(row) {
  const start = toEpochMs(row.session_started_at ?? row.first_assistant_at)
  const end = toEpochMs(row.last_assistant_at)
  return start == null || end == null ? null : Math.max(0, end - start)
}

export function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil((sorted.length - 1) * p)]
}

export function validateRoutes(value, roles) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("--routes must contain a JSON object keyed by recognized role names")
  }
  for (const [role, route] of Object.entries(value)) {
    if (!roles.includes(role)) throw new Error(`--routes contains an unrecognized role: ${role}`)
    if (route === null || typeof route !== "object" || Array.isArray(route)) {
      throw new Error(`--routes.${role} must be an object with a model provider/id`)
    }
    for (const property of Object.keys(route)) {
      if (!["model", "variant"].includes(property)) {
        throw new Error(`--routes.${role} contains unknown property: ${property}`)
      }
    }
    const separator = typeof route.model === "string" ? route.model.indexOf("/") : -1
    if (separator < 1 || separator === route.model.length - 1 || /\s/.test(route.model)) {
      throw new Error(`--routes.${role}.model must be a nonempty provider/id string`)
    }
    if (route.variant !== undefined && (typeof route.variant !== "string" || !route.variant.trim() || route.variant !== route.variant.trim())) {
      throw new Error(`--routes.${role}.variant must be a nonempty string when provided`)
    }
  }
  return value
}

function expectedRoute(row, routes) {
  const route = routes?.[row.agent]
  if (!route) return undefined
  const separator = route.model.indexOf("/")
  return { provider: route.model.slice(0, separator), model: route.model.slice(separator + 1), variant: route.variant }
}

function matchesExpected(row) {
  return row.provider === row.expected.provider &&
    row.model === row.expected.model &&
    (row.expected.variant === undefined || (row.variant ?? null) === row.expected.variant)
}

export function analyzeAuditRows(rows, routes, roles) {
  const recognized = rows.filter((row) => roles.includes(row.agent))
  const checked = recognized.map((row) => ({ ...row, expected: expectedRoute(row, routes) })).filter((row) => row.expected)
  const developerVariants = new Map()
  for (const row of recognized) {
    if (row.agent !== "developer") continue
    const variant = row.variant ?? "missing"
    developerVariants.set(variant, (developerVariants.get(variant) ?? 0) + 1)
  }
  return {
    recognized,
    checked,
    violations: checked.filter((row) => !matchesExpected(row)),
    unrecognized: rows.filter((row) => !roles.includes(row.agent)),
    unconfigured: routes ? recognized.filter((row) => !routes[row.agent]) : [],
    developerVariants: new Map([...developerVariants.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }
}
