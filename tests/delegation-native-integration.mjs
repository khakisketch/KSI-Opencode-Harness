// Delegation native integration test: depth-3 dynamic delegation on real OpenCode v2 CLI.
//
// Spins up, in a private HOME/XDG sandbox:
//   1. a local scripted OpenAI-compatible model server (no external models/credentials),
//   2. `opencode serve` on an isolated loopback port with a sandbox config that is
//      COPIED from the current repo source (global/opencode.jsonc + the sole
//      custom operating file global/agents/lead.md; the four removed specialist
//      files are NOT copied) with ONLY these mechanical transforms, all inside
//      the sandbox:
//        - every model reference -> fixture/fixture (top-level, agents JSON, and the
//          `model:` frontmatter line of each copied Markdown role file),
//        - providers reduced to the scripted `fixture` provider only,
//        - `mcp` section removed (no remote URLs / credential references),
//        - no top-level permission widening, no invented config keys.
//      Native builtin Plan prompt/deny-edit behavior is kept (no plan.md override
//      is created in the sandbox; Markdown-later-override is handled by rewriting
//      the MODEL line in sandbox copies only).
//
// The scripted model drives REAL native `subagent` tool calls through representative
// runtime chains (script markers in Native tool I/O only verify delegation mechanics;
// they say nothing about model quality):
//   A  build(0) -> lead(1) -> plan(2) -> explore(3, leaf read)   (optional
//      Build->Lead->Plan advisory chain reaching the retained ceiling of 3
//      when consultation is chosen; never required)
//   C  depth cap at 3, embedded in A: the depth-3 explore leaf still has a policy
//      DENY for explore->general (so the guard here is the removed-tool
//      rejection, classified honestly via the advertised catalog), yet no
//      depth-4 child may be created. Only the exact Native ceiling error passes
//      when the tool is advertised ("Subagent depth limit reached (3)" or an
//      equivalent structured typed depth error); a catalog-omitted tool admits
//      only a removed-tool rejection. Generic permission/network errors never
//      pass. The fixture-only forced attempt must not widen production
//      permissions to make it pass.
//   P  build(0) -> plan(1) -> explore(2)   (optional direct Plan consultation;
//      Plan delegates ANALYSIS ONLY under explicit boundaries)
//   D  build(0) -> lead(1) -> general(2, write+read unit file)   (positive
//      completion path with NO independent review: exactly the owned chain,
//      no review-role sessions, completion token returned)
//   M  build(0) -> general(1, two files write+read)   (positive Build-direct
//      General multi-file task execution)
//   T  build(0) -> lead(1, direct write+edit+read, ZERO subagent calls)
//      (Lead whole-task execution without children)
//   V  fresh uninvolved restricted General (explicit edit+shell session denies,
//      created outside the unit tree) reviews the completed D unit: forced
//      write fails closed with bytes unchanged, findings returned. Mechanics
//      proof for the OPTIONAL restricted-verification capability only.
//   J  build(0) -> lead(1) -> general(2, write+read dev-unit, then SAME child
//      resumed for repair)   (Lead->General delegation mechanics: actual files,
//      real write/test/follow-up repair via one owned General child)
//   L  build(0) -> lead(1) + general(1) in ONE response (parallel
//      non-interference: separate task-local files, shared scope read-only;
//      wall-clock request overlap required, serialization fails as NOT PROVEN)
//   E  plan edit=deny vs lead/general edit=allow via policy probes (NOT a proof of
//      hard transitive readonly), plus handoff-scope marker transmission through A,
//      zero product writes in the analysis-only chains, results returned to Main.
//   F  real child write/edit denial: forced scripted write+edit attempts by
//      plan/explore children on the private fixture file end in
//      Native error (deny- or removed-tool-shaped), with byte-level file integrity.
//      Lead/General/Build are NOT covered here: their own permissions are
//      broad (lead execution is proven ALLOWED by chain T instead), so a plan
//      deny does not transitively inherit to them (stated limit).
//   G  session continuity: root turn1/turn2 reuses the owned child via its Native
//      subagent sessionID; same childID, past messages kept, original requirement
//      plus new scope delivered, new result returned. Mechanics only.
//   H  failure -> new evidence -> resume & recover: a missing-file read fails with
//      a real Native error, the child returns its limit, then the SAME child
//      sessionID is resumed with an approved new reference and a different
//      question; the same failing call is never repeated. The script selects the
//      recovery path; this proves mechanics/scope/evidence plumbing, NOT model
//      initiative or judgment. Markers verify transmission, never understanding.
//      Ownership path: build -> lead -> general (lead replaces the retired
//      engineer context; general still owns the missing-file limit).
//   I  explicit session-scoped restrictions inherit to later-created children (no
//      plugin/router/alias): a NEW owned analysis root keeps one retained deny,
//      gains edit+shell denies via PATCH (replace semantics: existing rules are
//      re-sent, never dropped), then delegates Build0->Lead1->Plan2->General3.
//      Children created BEFORE the patch keep the old snapshot (non-retroactive);
//      children created AFTER carry the full snapshot, so even broad Lead and
//      General children refuse real write/edit attempts while reads succeed.
//      A fake webfetch target is verified by policy probe only (no external net).
//      Reads are verified on each session's OWN Native tool part (completed +
//      output bytes); each hop up is verified on that level's OWN tool inputs.
//      The stub embeds only evidence sliced from the actual tool result it got
//      (EVID:… or an honest NO-EVIDENCE-IN-RESULT flag) — never hardcoded bytes.
// Scope honesty: the runtime policy matrix covers every contract allow plus
// self/build/retired/unknown denies per caller and targeted
// cross-denies; it is NOT an exhaustive 5x5 all-pairs claim.
// J/M/T/D/V/L share one task-local workspace with SEPARATE files plus the shared
// read-only scope contract; no user projects/services are touched. This bound
// integration proves delegation mechanics only, not a workflow engine, real
// model quality, rendered-UI acceptance (Main-owned browser evidence), or
// concurrency beyond the stated chains. Modes/models/prompts come from the
// location-scoped /api/agent catalog, not from session.create echoes.
//
// Run:  node tests/delegation-native-integration.mjs
// Env:  KSI_HARNESS_ROOT (artifact parent; a unique directory is created, never erased)
//       KSI_MODEL_PORT / KSI_SERVE_PORT (defaults 41951/41952; auto-bumped if busy)
//       OPENCODE_BIN (default opencode)
// Fails closed with CONTRACT-NOT-READY when the repo source does not yet declare the
// depth-3 / five-profile contract; it never weakens permissions or falls back to interim
// roles to achieve a chain.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { isDelegationCeilingError } from "../scripts/delegation-errors.mjs";
import { settleSourceFreeAskProbe } from "../scripts/permission-probe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SRC_JSONC = path.join(REPO, "global", "opencode.jsonc");
const SRC_AGENTS = path.join(REPO, "global", "agents");
const SRC_AGENTS_MD = path.join(REPO, "global", "AGENTS.md");
const ARTIFACT_PARENT = process.env.KSI_HARNESS_ROOT ?? "/tmp/opencode";
fs.mkdirSync(ARTIFACT_PARENT, { recursive: true });
const ROOT = fs.mkdtempSync(path.join(ARTIFACT_PARENT, "ksi-deleg-"));
const OPENCODE_BIN = process.env.OPENCODE_BIN ?? "opencode";

const PRIV = path.join(ROOT, "priv-home");
const WORKSPACE = path.join(ROOT, "workspace");
const PASSWORD = crypto.randomBytes(24).toString("hex");
const AUTH = "Basic " + Buffer.from(`opencode:${PASSWORD}`).toString("base64");
const FIXTURE_MODEL = "fixture/fixture";
const UNKNOWN = "no-such-agent-ksi-probe";

// Contract under test (depth 3, root = 0; a max allowance, not a mandatory tree).
// Five operating profiles: build (primary), plan (all, deliberate consultation
// exception), lead/general/explore (subagent). The four superseded specialists
// (engineer/design/research/critic) were REMOVED with user approval
// (last-approved contents survive only in private backups): they appear in NO
// edge list and in NO catalog; every live caller must deny them (or fail
// closed on real calls), and no phantom registration may exist. Architect is
// physically archived at docs/archive/agents/architect.md (out of discovery)
// and appears in NO edge list either.
const CONTRACT = {
  depth: 3,
  modes: {
    plan: "all", lead: "subagent",
    general: "subagent", explore: "subagent",
  },
  edges: {
    build: ["plan", "lead", "general", "explore"],
    lead: ["plan", "general", "explore"],
    plan: ["general", "explore"],
    general: [], explore: [],
  },
};
const RETIRED_IDS = ["engineer", "design", "research", "critic"];
const RETIRED_ALIASES = ["architect", "design-specialist", "design-architect", "ux-scout", "ui-ux-critic", "product-reviewer"];
const HANDOFF = "HANDOFF-SCOPE-ANALYSIS-ONLY-KSI-DELEG";
const ORIGIN = "ORIG-CONTRACT-KSI-DELEG-V1";
const SCOPE_SENTENCE = "Scope is analysis-only handoff; do not write product files.";
// F/G/H markers. Transmission only: their presence in tool I/O proves a handoff
// traveled, never that any model understood, judged, or chose anything.
const ORIGREQ = "ORIG-REQUIREMENT-KSI-DELEG-G";
const NEWSCOPE = "NEW-SCOPE-KSI-DELEG-G";
const MISSING_EVIDENCE = "missing-evidence-H.txt";
const DENIED_WRITE = "denied-note.txt";
const SCOPE_FILE = "scope-note.txt";
const SCOPE_LINE = "SCOPE-NOTE-CONTENT analysis handoff probe";
// J/D/M/T/V task-local fixtures: SEPARATE files per unit in the same workspace,
// sharing only the read-only scope contract above. No user projects/services.
// J: lead dev-unit via one owned general child (write+read, then resumed repair).
const DEV_FILE = "dev-unit.txt";
const DEV_LINE = "DEV-UNIT-CONTENT initial implementation";
const DEV_FIXED = "DEV-UNIT-CONTENT repaired implementation";
// D: lead-owned unit with NO independent review (write+read of its own file;
// completion with exactly the owned chain is the positive no-review path).
const D_UNIT_FILE = "lead-unit.txt";
const D_UNIT_LINE = "D-UNIT-CONTENT lead-owned unit without review";
// M: build-direct general multi-file task (two separate files, write+read each).
const DIRECT_A_FILE = "direct-a.txt";
const DIRECT_A_LINE = "DIRECT-A-CONTENT build-direct general unit";
const DIRECT_B_FILE = "direct-b.css";
const DIRECT_B_LINE = ".direct-b { color: olive; }";
// T: lead direct execution with ZERO subagent calls (write+edit+read ALLOWED,
// byte-verified). Counterpart to the F deny proofs for restricted roles.
const LEAD_DIRECT_FILE = "lead-direct.txt";
const LEAD_DIRECT_LINE = "LEAD-DIRECT-CONTENT initial";
const LEAD_DIRECT_FIXED = "LEAD-DIRECT-CONTENT revised";
// V: chosen optional restricted verification. The fresh restricted General may
// attempt this note exactly once; it must never be created.
const REVIEW_NOTE = "review-note.txt";
// L: parallel non-interference. One build root fans out to lead + general in
// a SINGLE assistant response; each writes ONLY its own task-local file.
// The shared scope file stays read-only (hash-guarded); off-scope touches fail.
const L_API_FILE = "parallel-api.txt";
const L_API_LINE = "PARALLEL-API-CONTENT lead unit";
const L_UI_FILE = "parallel-ui.css";
const L_UI_LINE = ".parallel-ui { color: teal; }";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}
function failClosed(name, detail) {
  check(name, false, detail);
}
function note(name, detail = "") {
  console.log(`NOTE  ${name}${detail ? `  -- ${detail}` : ""}`);
}

// Strip // and /* */ comments outside string literals (state scanner; URLs inside
// strings are untouched because string state wins over comment state).
function stripJsonc(src) {
  let out = "", i = 0, s = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (s) {
      out += c;
      if (c === "\\" && i + 1 < src.length) { out += n; i += 2; continue; }
      if (c === s) s = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { s = c; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c; i++;
  }
  return out;
}

// Canonical three-field frontmatter rule parser; fails closed on unparsed rules.
function parseMdRules(source) {
  const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!header) throw new Error("missing role frontmatter");
  const block = header[1].split(/permissions:\r?\n/)[1];
  if (!block) throw new Error("missing canonical permission list");
  const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, "$2");
  const rules = [...block.matchAll(/^\s*- action: ([^\r\n]+)\r?\n\s+resource: ([^\r\n]+)\r?\n\s+effect: (allow|deny|ask)[ \t]*$/gm)]
    .map((m) => ({ action: unquote(m[1]), resource: unquote(m[2]), effect: m[3] }));
  const total = [...block.matchAll(/^\s*- action:/gm)].length;
  if (rules.length !== total) throw new Error(`unparsed source permission rule (${rules.length}/${total})`);
  return rules;
}
function subagentAllows(rules) {
  const out = [];
  for (const r of rules) {
    if (r.action !== "subagent") continue;
    if (r.resource === "*") { if (r.effect === "deny") out.length = 0; continue; }
    if (r.effect === "allow") { if (!out.includes(r.resource)) out.push(r.resource); }
    else if (r.effect === "deny") { const k = out.indexOf(r.resource); if (k >= 0) out.splice(k, 1); }
  }
  return out.sort();
}
// Effective skill allows under canonical deny-first ordering (* deny clears,
// later allows accumulate). Exact-set pins below fail on any widening.
function skillAllows(rules) {
  const out = [];
  for (const r of rules) {
    if (r.action !== "skill") continue;
    if (r.resource === "*") { if (r.effect === "deny") out.length = 0; continue; }
    if (r.effect === "allow") { if (!out.includes(r.resource)) out.push(r.resource); }
    else if (r.effect === "deny") { const k = out.indexOf(r.resource); if (k >= 0) out.splice(k, 1); }
  }
  return out.sort();
}
function mdFrontField(source, field) {
  const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!header) return null;
  const m = header[1].match(new RegExp(`^${field}:\\s*([^\\r\\n]+)`, "m"));
  return m ? m[1].trim() : null;
}
function mdBody(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}
const normText = (s) => (s ?? "").replace(/\r\n/g, "\n").trim();
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function freePortNear(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const s = net.createServer();
      s.once("error", () => tryPort(p + 1));
      s.listen(p, "127.0.0.1", () => s.close(() => resolve(p)));
    };
    tryPort(start);
  });
}

// ---------------------------------------------------------------- fake model
function userTextsOf(body) {
  // ALL user-role texts: Native appends per-role system-reminders (e.g. plan mode)
  // as trailing user messages AFTER the delegated prompt, so last-only scanning
  // misses the marker in child sessions. Assistant/tool texts are excluded.
  const out = [];
  for (const m of body.messages ?? []) {
    if (m.role !== "user") continue;
    if (typeof m.content === "string") out.push(m.content);
    else if (Array.isArray(m.content)) out.push(m.content.map((p) => (typeof p.text === "string" ? p.text : "")).join("\n"));
  }
  return out;
}
function userTextOf(body) {
  const all = userTextsOf(body);
  return all.length ? all[all.length - 1] : "";
}
function toolMsgsOf(body) {
  return (body.messages ?? []).filter((m) => m.role === "tool").map((m) => JSON.stringify(m.content ?? m));
}
// Owned-child session IDs as Native reports them in subagent tool results
// (<subagent sessionID="ses_...">). Last match wins (newest result first).
function parseSubagentSessionIDs(text) {
  return [...(String(text ?? "").matchAll(/\bses_[A-Za-z0-9]+\b/g))].map((m) => m[0]);
}
function lastSessionId(texts) {
  const ids = parseSubagentSessionIDs((Array.isArray(texts) ? texts : [texts]).join("\n"));
  return ids.length ? ids[ids.length - 1] : null;
}
// Short evidence excerpt sliced from an ACTUAL Native tool-result payload (never
// synthesized: null when the payload carries no evidence bytes, which then fails
// the per-level bytes assertions honestly). The locator below finds evidence
// lines inside the real result; the bytes themselves always come from the payload.
// The fixture content family covers the shared scope probe plus the J/D/M/T/L
// task-local files; each alternative still only matches bytes Native delivered.
// LAST match wins so a resumed session surfaces its latest evidence (earlier
// history, e.g. pre-repair bytes, must not shadow the newest read).
function extractEvidenceSnippet(toolMsgs) {
  const joined = (Array.isArray(toolMsgs) ? toolMsgs : [toolMsgs]).join("\n");
  const all = [...joined.matchAll(/SCOPE-NOTE-CONTENT[^\n"\\]{0,48}|DEV-UNIT-CONTENT[^\n"\\]{0,48}|D-UNIT-CONTENT[^\n"\\]{0,48}|DIRECT-A-CONTENT[^\n"\\]{0,48}|LEAD-DIRECT-CONTENT[^\n"\\]{0,48}|\.direct-b[^\n"\\]{0,48}|PARALLEL-API-CONTENT[^\n"\\]{0,48}|\.parallel-ui[^\n"\\]{0,48}/g)];
  return all.length ? all[all.length - 1][0] : null;
}
function evidenceSuffix(toolMsgs) {
  return `EVID:${extractEvidenceSnippet(toolMsgs) ?? "NO-EVIDENCE-IN-RESULT"}`;
}
// Named evidence slice from an ACTUAL Native tool-result payload (first match
// for the given pattern, or an honest NO-EVIDENCE-IN-RESULT flag). Lets a leaf
// that read two files return both byte proofs without hardcoding anything.
function evidenceMatch(toolMsgs, re) {
  const joined = (Array.isArray(toolMsgs) ? toolMsgs : [toolMsgs]).join("\n");
  const m = joined.match(re);
  return m ? m[0] : "NO-EVIDENCE-IN-RESULT";
}
// Step counters advance ONLY on tool-carrying requests, so title/summary/text-only
// calls that echo transcript markers never consume a script step.
const steps = new Map();
function chainMarker(text) {
  // Most-specific first: KSI-DELEG-H2R contains KSI-DELEG-H2 as a substring, and
  // resumed sessions carry both the old and the new prompt in user history.
  // Marker-naming ban: no marker may be a substring of HANDOFF/ORIGIN/SCOPE
  // (e.g. KSI-DELEG-V1 hid inside ORIG-CONTRACT-KSI-DELEG-V1 and hijacked every
  // chain listed after it — V is R now); keep markers disjoint from constants.
  for (const mk of ["KSI-DELEG-A4X", "KSI-DELEG-A3", "KSI-DELEG-A2", "KSI-DELEG-A1", "KSI-DELEG-A0",
    "KSI-DELEG-P2", "KSI-DELEG-P1", "KSI-DELEG-P0",
    "KSI-DELEG-D2", "KSI-DELEG-D1", "KSI-DELEG-D0",
    "KSI-DELEG-H2R", "KSI-DELEG-H2", "KSI-DELEG-H1", "KSI-DELEG-H0",
    "KSI-DELEG-G3", "KSI-DELEG-G2", "KSI-DELEG-G1", "KSI-DELEG-G0",
    "KSI-DELEG-J3", "KSI-DELEG-J2", "KSI-DELEG-J1", "KSI-DELEG-J0",
    "KSI-DELEG-M1", "KSI-DELEG-M0",
    "KSI-DELEG-T1", "KSI-DELEG-T0",
    "KSI-DELEG-X1", "KSI-DELEG-X0",
    "KSI-DELEG-R1", "KSI-DELEG-R0",
    "KSI-DELEG-L2", "KSI-DELEG-L1", "KSI-DELEG-L0",
    "KSI-DELEG-W2", "KSI-DELEG-W1", "KSI-DELEG-W0",
    "KSI-DELEG-I0B", "KSI-DELEG-I1B", "KSI-DELEG-I0A", "KSI-DELEG-I1A", "KSI-DELEG-I2", "KSI-DELEG-I3"]) {
    if (text.includes(mk)) return mk;
  }
  return null;
}
const NEXT = {
  "KSI-DELEG-A0": { agent: "lead", next: "KSI-DELEG-A1", done: "CHAIN-A-ROOT-OK" },
  "KSI-DELEG-A1": { agent: "plan", next: "KSI-DELEG-A2", done: "CHAIN-A-LEAD-OK" },
  "KSI-DELEG-A2": { agent: "explore", next: "KSI-DELEG-A3", done: "CHAIN-A-PLAN-OK" },
  "KSI-DELEG-P0": { agent: "plan", next: "KSI-DELEG-P1", done: "CHAIN-P-ROOT-OK" },
  "KSI-DELEG-P1": { agent: "explore", next: "KSI-DELEG-P2", done: "CHAIN-P-PLAN-OK" },
  "KSI-DELEG-D0": { agent: "lead", next: "KSI-DELEG-D1", done: "CHAIN-D-ROOT-OK" },
  "KSI-DELEG-D1": { agent: "general", next: "KSI-DELEG-D2", done: "CHAIN-D-LEAD-OK" },
  "KSI-DELEG-M0": { agent: "general", next: "KSI-DELEG-M1", done: "CHAIN-M-ROOT-OK" },
  "KSI-DELEG-T0": { agent: "lead", next: "KSI-DELEG-T1", done: "CHAIN-T-ROOT-OK" },
  "KSI-DELEG-X0": { agent: "plan", next: "KSI-DELEG-X1", done: "CHAIN-X-ROOT-OK" },
};
function subPrompt(next) {
  return `${next} ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Return findings as text; findings travel back to Main.`;
}
// F sequence under one build root: each step delegates a different restricted
// role that is scripted to attempt a real file mutation once. Lead/General are
// EXCLUDED here (broad execution permissions; lead allow-proof is chain T).
const WSEQ = [
  { agent: "plan", next: "KSI-DELEG-W1" },
  { agent: "explore", next: "KSI-DELEG-W2" },
];
function scriptFor(marker, advertised, ctx = {}) {
  const has = (n) => Array.isArray(advertised) && advertised.includes(n);
  const allUser = ctx.allUser ?? "", toolMsgs = ctx.toolMsgs ?? [];
  if (marker === null) return { kind: "text", text: "ok" };
  if (marker === "KSI-DELEG-A4X") return { kind: "text", text: "CHAIN-A-DEPTH4-UNEXPECTED" };
  const step = steps.get(marker) ?? 0;
  const spec = NEXT[marker];
  if (spec) {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: spec.agent, description: `deleg ${marker}`, prompt: subPrompt(spec.next) } }],
      };
    }
    return { kind: "text", text: `${spec.done} ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-A3") {
    // Depth-3 explore leaf: its policy DENIES explore->general, so the forced
    // call is expected to end in a removed-tool rejection (classified honestly
    // via the advertised catalog at check time). The forced call is emitted
    // whether or not `subagent` is advertised; the next step proceeds
    // regardless of the outcome.
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: "deleg A3 forced", prompt: subPrompt("KSI-DELEG-A4X") } }],
      };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `CHAIN-A-EXPLORE-LEAF-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: "scope-note.txt" } }] };
    }
    return { kind: "text", text: `CHAIN-A-EXPLORE-LEAF-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-P2") {
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `CHAIN-P-EXPLORE-LEAF-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: "scope-note.txt" } }] };
    }
    return { kind: "text", text: `CHAIN-P-EXPLORE-LEAF-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-D2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: D_UNIT_FILE, content: `${D_UNIT_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `D2-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: D_UNIT_FILE } }] };
    }
    return { kind: "text", text: `D2-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // F: W0 root fans out to the two restricted roles; each W-child attempts one
  // real write then one real edit. Both are expected to fail natively (deny- or
  // removed-tool-shaped); file integrity is asserted from evidence afterwards.
  if (marker === "KSI-DELEG-W0") {
    if (step < WSEQ.length) {
      const spec = WSEQ[step];
      return {
        kind: "tools",
        calls: [{
          name: "subagent",
          args: {
            agent: spec.agent,
            description: `deleg ${marker}`,
            prompt: `${spec.next} ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Attempt the requested file operation exactly once, then report the exact tool outcome as text; findings travel back to Main.`,
          },
        }],
      };
    }
    return { kind: "text", text: `W-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-W1" || marker === "KSI-DELEG-W2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DENIED_WRITE, content: "mutation attempt, must be denied\n" } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: SCOPE_FILE, oldString: SCOPE_LINE, newString: `${SCOPE_LINE}-MUTATION-ATTEMPT` } }] };
    }
    return { kind: "text", text: `FW-LEAF-OK-${marker} ${HANDOFF} ${ORIGIN}` };
  }
  // G: continuity via the owned child sessionID. G0 roots turn 1 (build -> the
  // general worker); G2 roots turn 2 and resumes the child ID carried in its
  // own prompt (parsed from user text).
  if (marker === "KSI-DELEG-G0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-G1") + ` Requirement ${ORIGREQ}: keep the original question, decision and evidence.` } }],
      };
    }
    return { kind: "text", text: `G0-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-G1" || marker === "KSI-DELEG-G3") {
    const leaf = marker === "KSI-DELEG-G1" ? "G1-RESULT-OK" : "G3-RESULT-OK";
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `${leaf} ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `${leaf} ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-G2") {
    if (step === 0) {
      const resumeId = lastSessionId(allUser);
      if (!resumeId) return { kind: "text", text: "G2-NO-CHILD-ID" };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `resume ${marker}`, sessionID: resumeId, prompt: `KSI-DELEG-G3 ${HANDOFF} ${ORIGIN} ${NEWSCOPE} Requirement ${ORIGREQ}: keep the original question, decision and evidence; add one new observation read and return updated findings as text.` } }],
      };
    }
    return { kind: "text", text: `G2-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  // H: failure -> resume with new evidence -> recover. H2 reads a file that does
  // not exist (real Native error, returned as the child limit); H1 then resumes
  // the SAME general child with an approved new reference and a new question.
  if (marker === "KSI-DELEG-H0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "lead", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-H1") } }],
      };
    }
    return { kind: "text", text: `H-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-H1") {
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-H2") + " Read the H-evidence file once and report what the read returned." } }],
      };
    }
    if (step === 1) {
      const resumeId = lastSessionId(toolMsgs);
      if (!resumeId) return { kind: "text", text: "H1-NO-CHILD-ID" };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `resume ${marker}`, sessionID: resumeId, prompt: `KSI-DELEG-H2R ${HANDOFF} ${ORIGIN} New approved reference: read ${SCOPE_FILE} once with this different question: what evidence line does the approved reference carry? Return findings as text.` } }],
      };
    }
    return { kind: "text", text: `H1-LEAD-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-H2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "read", args: { path: MISSING_EVIDENCE } }] };
    }
    return { kind: "text", text: `H2-LIMITED-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-H2R") {
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `H2-RECOVERED-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `H2-RECOVERED-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // J: lead dev-unit mechanics. J0 (build) -> J1 (lead) -> J2 (general:
  // real write+read of the dev-unit file); J1 then resumes the SAME general
  // child for a repair follow-up (J3: real edit+read). All files are task-local
  // (DEV_FILE only); the shared scope contract stays read-only.
  if (marker === "KSI-DELEG-J0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "lead", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-J1") + " Implement the dev-unit task via one owned general worker and return its findings." } }],
      };
    }
    return { kind: "text", text: `J0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-J1") {
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-J2") + " Write the dev-unit file once, read it back, and report the exact read outcome as text." } }],
      };
    }
    if (step === 1) {
      const resumeId = lastSessionId(toolMsgs);
      if (!resumeId) return { kind: "text", text: "J1-NO-CHILD-ID" };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `resume ${marker}`, sessionID: resumeId, prompt: `KSI-DELEG-J3 ${HANDOFF} ${ORIGIN} Follow-up repair on the same dev-unit file: apply the requested edit once, read it back, and return updated findings as text.` } }],
      };
    }
    return { kind: "text", text: `J1-LEAD-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-J2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DEV_FILE, content: `${DEV_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `J2-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DEV_FILE } }] };
    }
    return { kind: "text", text: `J2-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-J3") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: DEV_FILE, oldString: DEV_LINE, newString: DEV_FIXED } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `J3-REPAIRED-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DEV_FILE } }] };
    }
    return { kind: "text", text: `J3-REPAIRED-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // M: build-direct general multi-file task. M0 (build) -> M1 (general: real
  // write+read of TWO task-local files). Positive proof that Build may use
  // General directly for multi-file work with no obligatory Lead stage.
  if (marker === "KSI-DELEG-M1") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DIRECT_A_FILE, content: `${DIRECT_A_LINE}\n` } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DIRECT_B_FILE, content: `${DIRECT_B_LINE}\n` } }] };
    }
    if (step === 2) {
      if (!has("read")) return { kind: "text", text: `M1-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DIRECT_A_FILE } }] };
    }
    if (step === 3) {
      if (!has("read")) return { kind: "text", text: `M1-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DIRECT_B_FILE } }] };
    }
    return { kind: "text", text: `M1-GENERAL-OK ${HANDOFF} ${ORIGIN} EVID-A:${evidenceMatch(toolMsgs, /DIRECT-A-CONTENT[^\n"\\]{0,48}/)} EVID-B:${evidenceMatch(toolMsgs, /\.direct-b[^\n"\\]{0,48}/)}` };
  }
  // T: lead direct execution with ZERO children. T0 (build) -> T1 (lead: real
  // write+edit+read ALLOWED, byte-verified, no subagent call). Counterpart to
  // the F deny proofs for restricted roles.
  if (marker === "KSI-DELEG-T1") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: LEAD_DIRECT_FILE, content: `${LEAD_DIRECT_LINE}\n` } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: LEAD_DIRECT_FILE, oldString: LEAD_DIRECT_LINE, newString: LEAD_DIRECT_FIXED } }] };
    }
    if (step === 2) {
      if (!has("read")) return { kind: "text", text: `T1-LEAD-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: LEAD_DIRECT_FILE } }] };
    }
    return { kind: "text", text: `T1-LEAD-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // X: actual fresh-call exclusion for a retired target under Native Plan.
  // Probes may report allow (Native default); the REAL call must fail closed
  // with an agent-not-found (or permission-denied) error and create no child.
  // Success (completed) fails the gate. The exact message is logged, never
  // synthesized. With the retired operating files removed, no engineer session
  // can exist to answer — the failure must be a genuine not-found.
  if (marker === "KSI-DELEG-X1") {
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "engineer", description: `exclusion probe ${marker}`, prompt: "This delegated call must not exist; report only." } }],
      };
    }
    return { kind: "text", text: `X1-EXCLUSION-OK ${HANDOFF} ${ORIGIN}` };
  }
  // V: chosen optional restricted verification. V1 runs in a FRESH restricted
  // General session (explicit edit+shell denies, outside the D unit tree):
  // read the evidence, attempt the review-note write exactly once (must fail
  // closed), then return findings as text. Mechanics proof only.
  if (marker === "KSI-DELEG-R1") {
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `V1-FINDINGS-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "write", args: { path: REVIEW_NOTE, content: "restricted review attempt, must be denied\n" } }] };
    }
    if (step === 2) {
      if (!has("read")) return { kind: "text", text: `V1-FINDINGS-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: D_UNIT_FILE } }] };
    }
    return { kind: "text", text: `V1-FINDINGS-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // L: parallel fan-out. L0 (build) emits BOTH subagent calls in ONE assistant
  // response so Native — never the script — schedules them; L1 (lead) and
  // L2 (general) each write+read ONLY their own file. Mechanics only.
  if (marker === "KSI-DELEG-L0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [
          { name: "subagent", args: { agent: "lead", description: `deleg ${marker} lead`, prompt: subPrompt("KSI-DELEG-L1") + " Write the parallel API file once, read it back, and report the exact read outcome as text." } },
          { name: "subagent", args: { agent: "general", description: `deleg ${marker} gen`, prompt: subPrompt("KSI-DELEG-L2") + " Write the parallel UI file once, read it back, and report the exact read outcome as text." } },
        ],
      };
    }
    return { kind: "text", text: `L0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-L1") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: L_API_FILE, content: `${L_API_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `L1-LEAD-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: L_API_FILE } }] };
    }
    return { kind: "text", text: `L1-LEAD-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-L2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: L_UI_FILE, content: `${L_UI_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `L2-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: L_UI_FILE } }] };
    }
    return { kind: "text", text: `L2-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // I: session-scoped restriction flow. I0A roots the pre-patch turn (Plan child
  // snapshots webfetch-only rules); I0B roots the post-patch turn with the full
  // Build0->Lead1->Plan2->General3 chain under the inherited snapshot.
  if (marker === "KSI-DELEG-I0A") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "plan", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I1A") } }],
      };
    }
    return { kind: "text", text: `I0A-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-I0B") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "lead", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I1B") } }],
      };
    }
    return { kind: "text", text: `I-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I1A") {
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `I1A-RESULT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `I1A-RESULT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-I1B") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "plan", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I2") } }],
      };
    }
    return { kind: "text", text: `I1B-LEAD-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I2") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I3") } }],
      };
    }
    return { kind: "text", text: `I2-PLAN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I3") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DENIED_WRITE, content: "mutation attempt, must be denied\n" } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: SCOPE_FILE, oldString: SCOPE_LINE, newString: `${SCOPE_LINE}-MUTATION-ATTEMPT` } }] };
    }
    if (step === 2) {
      if (!has("read")) return { kind: "text", text: `I3-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `I3-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  return { kind: "text", text: "ok" };
}
function chunk(id, model, delta, finish) {
  return { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finish }] };
}
function startFakeModel(port, sharedInstructions) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method === "GET" && url.pathname === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: [{ id: "fixture", object: "model", created: 1, owned_by: "ksi" }] }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          let body = {};
          try { body = JSON.parse(raw); } catch {}
          const text = userTextOf(body);
          const allUser = userTextsOf(body).join("\n");
          // Inspect actual model input, not a source-copy echo. The new log
          // field records presence, not instruction prose; delivery only.
          const instructionText = (body.messages ?? [])
            .filter((m) => m.role === "system" || m.role === "user")
            .flatMap((m) => typeof m.content === "string" ? [m.content]
              : Array.isArray(m.content) ? m.content.map((p) => p.text ?? "") : [])
            .join("\n");
          const marker = chainMarker(allUser);
          const tools = toolMsgsOf(body);
          const advertised = Array.isArray(body.tools) ? body.tools.map((t) => t?.function?.name ?? t?.type) : null;
          const hasTools = !!advertised && advertised.length > 0;
          let script;
          if (!hasTools) {
            script = { kind: "text", text: "ok" };
          } else {
            script = scriptFor(marker, advertised, { allUser, toolMsgs: tools });
            if (script.kind !== "text" && marker !== null) steps.set(marker, (steps.get(marker) ?? 0) + 1);
            else if (script.kind === "text" && marker !== null && !hasTools) { /* no consume */ }
            else if (script.kind === "text" && marker !== null) {
              // A terminal text answer for a tool-carrying request still ends the
              // turn; count it so a retry would advance instead of looping.
              steps.set(marker, (steps.get(marker) ?? 0) + 1);
            }
          }
          try {
            fs.appendFileSync(path.join(ROOT, "fake-model-requests.jsonl"), JSON.stringify({
              // t is wall-clock receipt time (ms): the ONLY timing signal, used
              // by case L to test real call overlap. No other timing framework.
              t: Date.now(),
              marker, hasTools, advertised: advertised ?? [],
              sharedInstructionsPresent: normText(instructionText).includes(normText(sharedInstructions)),
              userTail: text.slice(-300), userAll: allUser.slice(-2000),
              toolMsgs: tools.map((t) => t.slice(0, 1500)),
              scriptKind: script.kind,
              scriptCalls: script.kind === "tools" ? script.calls.map((c) => c.name) : [],
              scriptArgs: script.kind === "tools" ? script.calls.map((c) => JSON.stringify(c.args).slice(0, 1200)) : [],
            }) + "\n");
          } catch {}
          const id = `chatcmpl-ksideleg-${Date.now()}`;
          const finishWith = (payloads, jsonBody) => {
            if (body.stream) {
              res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
              for (const p of payloads) res.write(`data: ${JSON.stringify(p)}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(jsonBody));
            }
          };
          if (script.kind === "text") {
            const msg = { role: "assistant", content: script.text };
            finishWith(
              [chunk(id, "fixture", { role: "assistant", content: script.text }, null), chunk(id, "fixture", {}, "stop")],
              { id, object: "chat.completion", created: 1, model: "fixture", choices: [{ index: 0, message: msg, finish_reason: "stop" }] },
            );
            return;
          }
          const calls = script.calls.map((c, i) => ({
            id: `call_ksideleg_${(marker ?? "na").replace(/-/g, "")}_${steps.get(marker) ?? 0}_${i}_${Date.now()}`,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          }));
          const deltas = calls.map((c, i) => chunk(id, "fixture", { role: "assistant", tool_calls: [{ index: i, id: c.id, type: c.type, function: c.function }] }, null));
          deltas.push(chunk(id, "fixture", {}, "tool_calls"));
          finishWith(deltas, {
            id, object: "chat.completion", created: 1, model: "fixture",
            choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: calls }, finish_reason: "tool_calls" }],
          });
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

// ---------------------------------------------------------------- driver
let SERVE_PORT = 0, MODEL_PORT = 0;
async function api(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${SERVE_PORT}${p}`, {
    method,
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}
function toolEntries(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (m.type !== "assistant") continue;
    for (const part of m.content ?? []) {
      if (part?.type === "tool") out.push(part);
    }
  }
  return out;
}
function assistantTexts(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (m.type !== "assistant") continue;
    for (const part of m.content ?? []) {
      if (part?.type === "text" && typeof part.text === "string") out.push(part.text);
    }
  }
  return out.join("\n");
}

async function main() {
  MODEL_PORT = await freePortNear(Number(process.env.KSI_MODEL_PORT ?? 41951));
  SERVE_PORT = await freePortNear(Number(process.env.KSI_SERVE_PORT ?? 41952));

  // --- 1. Source contract gate (actual repo files; never interim roles) ---
  let srcCfg;
  try {
    srcCfg = JSON.parse(stripJsonc(fs.readFileSync(SRC_JSONC, "utf8")));
  } catch (e) {
    failClosed("CONTRACT-NOT-READY: source opencode.jsonc unreadable", String(e).slice(0, 160));
    return void finish();
  }
  if (srcCfg?.experimental?.subagent_depth !== CONTRACT.depth) {
    failClosed("CONTRACT-NOT-READY: experimental.subagent_depth != 3 in source", `found=${srcCfg?.experimental?.subagent_depth}`);
    return void finish();
  }
  check("source declares experimental.subagent_depth == 3", true);
  const srcAgents = srcCfg.agents ?? {};
  for (const id of ["build", "plan"]) {
    if (!srcAgents[id]) {
      failClosed("CONTRACT-NOT-READY: source agents missing", id);
      return void finish();
    }
  }
  const mdIds = ["lead"];
  const mdSources = {};
  for (const id of mdIds) {
    const p = path.join(SRC_AGENTS, `${id}.md`);
    if (!fs.existsSync(p)) {
      failClosed("CONTRACT-NOT-READY: role file missing in source", `global/agents/${id}.md`);
      return void finish();
    }
    mdSources[id] = fs.readFileSync(p, "utf8");
  }
  check("source carries the sole custom operating file (lead)", true);
  // Authorized removal: the four superseded operating files must be ABSENT
  // from source (last-approved contents survive only in private backups —
  // receipted in the sandbox manifest below, never re-required on disk).
  let removedOk = true;
  for (const id of RETIRED_IDS) {
    if (fs.existsSync(path.join(SRC_AGENTS, `${id}.md`))) { removedOk = false; }
  }
  check("source carries no retired operating files (authorized removal)", removedOk);
  if (!removedOk) { failClosed("CONTRACT-MISMATCH: retired operating files present", RETIRED_IDS.join(",")); return void finish(); }
  // Physical archive out of discovery (Main + independent Plan decision):
  // architect.md lives byte-identical at docs/archive/agents/architect.md, the
  // operational path global/agents/architect.md is gone, and no hidden JSON
  // stub remains. This test never deletes/rewrites the archive, only records
  // its bytes and enforces absence from every operational surface.
  const SRC_ARCH = path.join(REPO, "docs", "archive", "agents", "architect.md");
  const OLD_ARCH_OPS = path.join(SRC_AGENTS, "architect.md");
  check("archived source present at docs/archive/agents/architect.md", fs.existsSync(SRC_ARCH));
  check("old operational role path absent (no global/agents/architect.md)", !fs.existsSync(OLD_ARCH_OPS));
  check("source agents declare no hidden architect stub (five profiles only)",
    !Object.hasOwn(srcCfg.agents ?? {}, "architect"),
    `keys=${Object.keys(srcCfg.agents ?? {}).sort().join(",")}`);
  const archPresent = fs.existsSync(SRC_ARCH);
  const archHash = archPresent ? sha256(fs.readFileSync(SRC_ARCH, "utf8")) : null;
  if (!archPresent) { failClosed("CONTRACT-NOT-READY: archive file missing", SRC_ARCH); return void finish(); }
  // Full-file proof: the archive carries a model frontmatter line, a parseable
  // canonical permission list, and a non-empty body — a stub pointer fails here.
  let archFull = false;
  try {
    const archSrc = fs.readFileSync(SRC_ARCH, "utf8");
    archFull = /^model:\s*\S+/m.test(archSrc.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "")
      && parseMdRules(archSrc).length > 0 && mdBody(archSrc).trim().length > 0;
  } catch { archFull = false; }
  check("archive holds the full role file (model frontmatter + rules + body)", archFull);
  if (!fs.existsSync(SRC_AGENTS_MD)) {
    failClosed("CONTRACT-NOT-READY: shared instruction file missing in source", "global/AGENTS.md");
    return void finish();
  }
  const srcAgentsMd = fs.readFileSync(SRC_AGENTS_MD, "utf8");
  check("source shared instructions present (global/AGENTS.md)", true);
  const srcHashes = {
    jsonc: sha256(fs.readFileSync(SRC_JSONC, "utf8")),
    agentsMd: sha256(srcAgentsMd),
    roles: Object.fromEntries(mdIds.map((id) => [id, sha256(mdSources[id])])),
    archivedArchitect: archPresent ? { path: SRC_ARCH, sha256: archHash } : { moved: true },
    testFile: sha256(fs.readFileSync(fileURLToPath(import.meta.url), "utf8")),
    depthErrorHelper: sha256(fs.readFileSync(path.join(REPO, "scripts", "delegation-errors.mjs"), "utf8")),
  };
  note("archived architect.md recorded (no autodelete, no rewrite)", `docs/archive/agents/architect.md sha256=${(archHash ?? "").slice(0, 16)}`);
  // Exact edge contract from source (JSON agents + Markdown frontmatter).
  // Plan carries NO custom permission rules: the Native prompt and Native
  // permissions apply (mode `all` is the only exception plus the model
  // preference). Its Native General/Explore analysis delegation and Native
  // edit deny are proven by live sandbox probes below — never by static
  // allows, and never as a Plan-OS-readonly claim. Retired specialists carry
  // NO operating definitions at all (no JSONC entries, no files). They appear
  // in no edge list below; catalog absence plus live target-denies and the
  // real-call failure in chain X carry the removal proof.
  let edgesOk = true;
  const edgeDetail = [];
  for (const [caller, want] of Object.entries(CONTRACT.edges)) {
    let got;
    try {
      // Roles with source rules (JSON agents or Markdown) must declare exactly the
      // contract allows. Plan declares nothing (Native retained); builtin leaves
       // with no subagent allows (general/explore) may omit duplicate denies.
       // Their effective leaf behavior is proven by Native probes below.
      const rules = mdSources[caller] ? parseMdRules(mdSources[caller]) : (srcAgents[caller]?.permissions ?? null);
      got = rules ? subagentAllows(rules) : [];
    } catch (e) {
      edgesOk = false; edgeDetail.push(`${caller}:unparseable`); continue;
    }
    if (caller === "plan") {
      if (srcAgents.plan?.permissions !== undefined || got.length !== 0) { edgesOk = false; edgeDetail.push("plan:custom-rules-present"); }
      continue;
    }
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) { edgesOk = false; edgeDetail.push(`${caller}:[${got}]`); }
  }
  check("source declares exact delegation edges", edgesOk, edgeDetail.join(" ") || "all 5 profiles match");
  if (!edgesOk) { failClosed("CONTRACT-MISMATCH: refusing to weaken edges", edgeDetail.join("; ").slice(0, 300)); return void finish(); }
  // Removal mechanism is authorized DELETION — never a `disabled` tombstone,
  // hiding, or a custom loader. No retired id may carry any operating
  // definition (JSONC entry or Markdown file) that could smuggle routing.
  let removedDefsOk = true;
  for (const id of RETIRED_IDS) {
    if (Object.hasOwn(srcAgents, id)) { removedDefsOk = false; edgeDetail.push(`${id}:jsonc-entry-present`); }
  }
  check("source carries no retired operating definitions (no tombstones, no hidden fallback)",
    removedDefsOk, edgeDetail.join(" ") || "engineer/design/research/critic fully removed");
  if (!removedDefsOk) { failClosed("CONTRACT-MISMATCH: retired operating definitions present", edgeDetail.join("; ").slice(0, 300)); return void finish(); }
  for (const [id, mode] of Object.entries(CONTRACT.modes)) {
    const got = mdSources[id] ? mdFrontField(mdSources[id], "mode") : srcAgents[id]?.mode;
    // general/explore are builtins: source declares no mode (undefined) and the
    // Native default applies. Their actual mode is asserted authoritatively from
    // the live sandbox /api/agent catalog below, not assumed here.
    if (got === undefined && (id === "general" || id === "explore") && !mdSources[id]) continue;
    if (got !== mode) {
      failClosed("CONTRACT-MISMATCH: role mode differs", `${id} mode=${got} want=${mode}`);
      return void finish();
    }
  }
  check("source role modes match contract (plan all; lead/general/explore subagent)", true);

  // --- 1b. Source contract: exact model preferences and skill sets.
  // Plan uses OpenAI Sol High; execution workers retain Muse preferences.
  const WANT_MODELS = {
    "lead.md": "opencode-go/muse-spark-1.3-contributor#xhigh",
  };
  let modelsOk = true;
  for (const [file, want] of Object.entries(WANT_MODELS)) {
    const got = mdFrontField(mdSources[file.replace(/\.md$/, "")], "model");
    if (got !== want) { modelsOk = false; note(`model drift ${file}`, `got=${got} want=${want}`); }
  }
  const WANT_JSON_MODELS = {
    plan: "openai/gpt-6.1-sol#high",
    general: "opencode-go/muse-spark-1.3-contributor#high",
    explore: "opencode-go/muse-spark-1.3-contributor#medium",
  };
  for (const [id, want] of Object.entries(WANT_JSON_MODELS)) {
    if (srcAgents[id]?.model !== want) { modelsOk = false; note(`model drift agents.${id}`, `got=${srcAgents[id]?.model} want=${want}`); }
  }
  check("source models match configured preferences (Sol Plan, Muse workers)", modelsOk);
  if (!modelsOk) { failClosed("CONTRACT-MISMATCH: source model drift", "see model drift notes"); return void finish(); }
  // Build root carries no forced model: caller/session selection applies.
  check("source forces no model on build root (no top-level or build model)",
    srcCfg.model === undefined && srcAgents.build?.model === undefined,
    `top=${srcCfg.model} build=${srcAgents.build?.model}`);
  // Only Muse needs a request override; OpenAI uses Native provider defaults.
  // No router or automatic provider fallback is introduced.
  const museBody = srcCfg?.providers?.["opencode-go"]?.models?.["muse-spark-1.3-contributor"]?.body;
  check("source Muse routing exact (auto tool choice)",
    isDeepStrictEqual(museBody, { tool_choice: "auto" }),
    `got=${JSON.stringify(museBody)}`.slice(0, 160));
  check("source custom provider overlay is Muse only (OpenAI Native, no router)",
    JSON.stringify(Object.keys(srcCfg.providers ?? {}).sort()) === JSON.stringify(["opencode-go"]),
    `got=${Object.keys(srcCfg.providers ?? {}).sort().join(",")}`);
  const hasFallbackKey = (o) => {
    if (Array.isArray(o)) return o.some(hasFallbackKey);
    if (o && typeof o === "object") return Object.keys(o).some((k) => k === "fallback" || hasFallbackKey(o[k]));
    return false;
  };
  check("source config declares no automatic fallback", !hasFallbackKey(srcCfg));
  // Skill breadth restored by deletion, not by new allows: lead declares only
  // subagent rules (short responsibility prompt, no skill whitelist); general
  // and explore declare zero skill rules (Native breadth, no KSI whitelist);
  // plan declares no custom rules at all. Retired files do not exist to parse:
  // their last-approved bytes live only in the private manifest backups.
  check("source lead declares zero skill rules (subagent edges only)",
    skillAllows(parseMdRules(mdSources.lead)).length === 0
    && JSON.stringify(subagentAllows(parseMdRules(mdSources.lead))) === JSON.stringify(["explore", "general", "plan"]));
  check("source general/explore declare zero skill rules (Native breadth, no whitelist)",
    skillAllows(srcAgents.general?.permissions ?? []).length === 0
    && skillAllows(srcAgents.explore?.permissions ?? []).length === 0);
  check("source plan declares no custom permissions (Native retained)",
    (srcAgents.plan?.permissions ?? undefined) === undefined);
  check("source explore carries no steps pin (Native default applies)",
    srcAgents.explore?.steps === undefined);
   // Natural-language wording is not an executable contract. Check that the
   // actual sources remain present; policy/tool/chain assertions below carry
   // the mechanism proof without pretending to test model understanding.
   check("source common instructions are non-empty", srcAgentsMd.trim().length > 0);
   check("source preserves Native builtin system prompts",
     ["build", "plan", "general", "explore"].every((id) => srcAgents[id]?.system === undefined));
  check("source retires repo-bundled custom skill and detector plugin",
    !fs.existsSync(path.join(REPO, "skills", "task-first-ux-review"))
    && !fs.existsSync(path.join(REPO, "global", "plugins", "ksi-impeccable-detector")));
   check("source Lead has a dispatch description and non-empty system body",
     Boolean(mdFrontField(mdSources.lead, "description")) && mdBody(mdSources.lead).trim().length > 0);

  // --- 2. Sandbox (private HOME/XDG; copies actual source, sandbox-only transforms) ---
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(path.join(WORKSPACE, "scope-note.txt"), "SCOPE-NOTE-CONTENT analysis handoff probe\n");
  const cfgDir = path.join(PRIV, ".config", "opencode");
  const agentsDir = path.join(cfgDir, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const id of mdIds) {
    const dst = path.join(agentsDir, `${id}.md`);
    // Sandbox-only MODEL rewrite; every other line must stay identical (verified below).
    const rewritten = mdSources[id].replace(/^model:\s*.*$/m, "model: fixture/fixture");
    fs.writeFileSync(dst, rewritten);
  }
  for (const id of mdIds) {
    const a = fs.readFileSync(path.join(SRC_AGENTS, `${id}.md`), "utf8").split("\n");
    const b = fs.readFileSync(path.join(agentsDir, `${id}.md`), "utf8").split("\n");
    const diffs = a.filter((l, i) => l !== b[i]).concat(b.length !== a.length ? ["line-count"] : []);
    const onlyModel = diffs.length > 0 && diffs.every((l) => /^model:/.test(l) || l === "model: fixture/fixture");
    // Recompute precisely: differing line pairs, each pair must be a model-line swap.
    let clean = a.length === b.length;
    if (clean) for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (!(/^model:/.test(a[i]) && b[i] === "model: fixture/fixture")) { clean = false; break; }
    }
    check(`sandbox ${id}.md differs from source ONLY in model line`, clean && onlyModel, diffs.slice(0, 2).join("|").slice(0, 120));
  }
  check("sandbox creates no plan.md builtin override", !fs.existsSync(path.join(agentsDir, "plan.md")));
  check("sandbox carries no architect.md from any path (archive out of discovery)", !fs.existsSync(path.join(agentsDir, "architect.md")));
  // Authorized removal: no retired specialist file travels into the sandbox
  // agents dir (only lead is copied). Backup retention is proven by the
  // private manifest below (last-approved hashes + backup locations), never by
  // re-requiring deleted source files on disk.
  for (const id of RETIRED_IDS) {
    check(`sandbox carries no ${id}.md (authorized removal)`, !fs.existsSync(path.join(agentsDir, `${id}.md`)));
  }
  // Shared deployment-wide instructions travel into the sandbox global dir with
  // identical bytes, so the running server grounds on the same common text.
  fs.writeFileSync(path.join(cfgDir, "AGENTS.md"), srcAgentsMd);
  check("sandbox AGENTS.md same bytes as source", sha256(fs.readFileSync(path.join(cfgDir, "AGENTS.md"), "utf8")) === srcHashes.agentsMd);

  const overrideIds = [...new Set([...Object.keys(srcAgents), ...mdIds, "build", "plan", "general", "explore", "title", "compaction", "summary"])];
  const sandboxAgents = JSON.parse(JSON.stringify(srcAgents));
  for (const id of overrideIds) {
    // Sandbox-only model rewrite for operating profiles; nothing else about
    // the agents map is rewritten. Retired ids have no entries at all.
    sandboxAgents[id] = { ...(sandboxAgents[id] ?? {}), model: FIXTURE_MODEL };
  }
  const sandboxCfg = {
    $schema: srcCfg.$schema ?? "https://opencode.ai/config.json",
    ...(srcCfg.default_agent ? { default_agent: srcCfg.default_agent } : {}),
    ...(srcCfg.share ? { share: srcCfg.share } : {}),
    ...(srcCfg.update ? { update: srcCfg.update } : {}),
    experimental: JSON.parse(JSON.stringify(srcCfg.experimental)),
    agents: sandboxAgents,
    providers: {
      fixture: {
        name: "Fixture (local scripted)",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: `http://127.0.0.1:${MODEL_PORT}/v1`, apiKey: "ksi-deleg-fake-key" },
        models: { fixture: { name: "Fixture scripted model", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32768, output: 8192 } } },
      },
    },
    ...(srcCfg.tool_output ? { tool_output: srcCfg.tool_output } : {}),
    ...(srcCfg.compaction ? { compaction: srcCfg.compaction } : {}),
  };
  fs.writeFileSync(path.join(cfgDir, "opencode.json"), JSON.stringify(sandboxCfg, null, 1));
  // Serve reads either name depending on version; identical content (pure JSON is
  // valid JSONC), so no divergence risk.
  fs.writeFileSync(path.join(cfgDir, "opencode.jsonc"), JSON.stringify(sandboxCfg, null, 1));
  const cfgText = JSON.stringify(sandboxCfg);
  check("sandbox providers are fixture-only", Object.keys(sandboxCfg.providers).join() === "fixture");
  check("sandbox drops MCP remotes/credentials", !("mcp" in sandboxCfg) && !cfgText.includes("mobbin") && !cfgText.includes("context7"));
  check("sandbox models all fixture-only", !/openai\/|opencode-go\/|anthropic\//.test(cfgText), "no external provider/model refs");
  check("sandbox keeps depth ceiling (not widened)", sandboxCfg.experimental.subagent_depth === 3);
  check("sandbox carries no retired operating definitions (authorized removal)",
    RETIRED_IDS.every((id) => !Object.hasOwn(sandboxCfg.agents ?? {}, id)),
    `retiredKeys=[${Object.keys(sandboxCfg.agents ?? {}).filter((k) => RETIRED_IDS.includes(k)).join(",")}]`);
  check("sandbox adds no top-level permission widening", !("permissions" in sandboxCfg) && !("permission" in sandboxCfg));
  const apiKeys = [...cfgText.matchAll(/"apiKey"\s*:\s*"([^"]*)"/g)].map((m) => m[1]);
  check("sandbox carries no real secret values (only the fake fixture key)", apiKeys.length > 0 && apiKeys.every((k) => k === "ksi-deleg-fake-key"), `apiKeys=${apiKeys.length}`);

  // Minimal env whitelist: locale/terminal/PATH plumbing only. HOME/XDG and the
  // server password are set explicitly below. Nothing else is inherited, in
  // particular no OPENCODE_* (OPENCODE_CONFIG/CONTENT/SERVER_URL contamination),
  // no credentials, no editor/pager/display state. Key names only, never values.
  const ENV_KEEP = new Set(["PATH", "LANG", "LC_ALL", "TERM", "SHELL", "TZ", "TMPDIR", "TMP", "TEMP"]);
  const ownTmp = path.join(ROOT, "tmp");
  fs.mkdirSync(ownTmp, { recursive: true });
  const env = {};
  const keptNames = [];
  let dropped = 0;
  for (const [k, v] of Object.entries(process.env)) {
    if (ENV_KEEP.has(k) || /^LC_[A-Z_]+$/.test(k)) { env[k] = v; keptNames.push(k); }
    else dropped++;
  }
  env.TMPDIR = ownTmp; env.TMP = ownTmp; env.TEMP = ownTmp;
  Object.assign(env, {
    HOME: PRIV,
    XDG_CONFIG_HOME: path.join(PRIV, ".config"),
    XDG_DATA_HOME: path.join(PRIV, ".local", "share"),
    XDG_CACHE_HOME: path.join(PRIV, ".cache"),
    XDG_STATE_HOME: path.join(PRIV, ".local", "state"),
    OPENCODE_SERVER_PASSWORD: PASSWORD,
  });
  const leaked = Object.keys(env).filter((k) => /^OPENCODE_/i.test(k) && k !== "OPENCODE_SERVER_PASSWORD");
  check("env whitelist-minimal (own TMPDIR, no OPENCODE_*/secret passthrough)", leaked.length === 0, `kept=[${keptNames.sort().join(",")}] dropped=${dropped}`);
  if (leaked.length) { failClosed("env contamination would reach the server", leaked.join(",")); return void finish(); }

  // Strict API helper for evidence paths: non-canonical responses throw instead of
  // degrading into false-empty passes. Polling loops below keep their own retry
  // cadence and validate the final shape; everything else fails closed here.
  async function mustApi(method, p, body, what, wantStatus = 200) {
    const r = await api(method, p, body);
    if (r.status !== wantStatus) {
      throw new Error(`${what}: HTTP ${r.status} (want ${wantStatus}): ${JSON.stringify(r.json).slice(0, 200)}`);
    }
    return r.json;
  }
  function requireDataArray(json, what) {
    const d = json?.data;
    if (!Array.isArray(d)) throw new Error(`${what}: canonical {data:[]} shape missing`);
    return d;
  }
  // REST adapter for the shared ask-probe cleanup helper. Typed native fields
  // are adopted ONLY when the payload carries them; they are never synthesized,
  // so untyped failures rethrow fail-closed per the helper contract.
  function restApiError(op, r) {
    const err = new Error(`${op} failed: HTTP ${r.status}`);
    err.operation = op;
    err.httpStatus = r.status;
    const payload = r.json ?? {};
    const tag = payload?.nativeTag ?? payload?.error?.nativeTag ?? payload?.data?.nativeTag;
    const rid = payload?.nativeRequestID ?? payload?.error?.nativeRequestID ?? payload?.data?.nativeRequestID;
    if (typeof tag === "string") err.nativeTag = tag;
    if (typeof rid === "string") err.nativeRequestID = rid;
    return err;
  }
  async function restProbeApi(op, params = [], data = null) {
    const kv = {};
    for (const p of params) { const i = p.indexOf("="); kv[p.slice(0, i)] = p.slice(i + 1); }
    if (op === "session.permission.list") {
      const r = await api("GET", `/api/session/${kv.sessionID}/permission`);
      if (r.status !== 200) throw restApiError(op, r);
      return requireDataArray(r.json, "session.permission.list");
    }
    if (op === "session.permission.reply") {
      const r = await api("POST", `/api/session/${kv.sessionID}/permission/${kv.requestID}/reply`, data);
      if (r.status === 200 || r.status === 201) return r.json?.data ?? r.json;
      throw restApiError(op, r);
    }
    throw new Error(`unexpected probe op ${op}`);
  }
  const children = [];
  const onExit = () => { for (const c of children) { try { c.kill("SIGTERM"); } catch {} } };
  process.on("exit", onExit);
  // Bounded runtime: a stuck await must fail closed instead of idling forever.
  // Firing exits the process (which runs onExit above to SIGTERM own children).
  const watchdog = setTimeout(() => {
    try { fs.appendFileSync(path.join(ROOT, "WATCHDOG-TIMEOUT"), `fired after 15min\n`); } catch {}
    console.error("WATCHDOG-TIMEOUT: bounded runtime exceeded, failing closed");
    process.exit(1);
  }, 15 * 60 * 1000);
  if (typeof watchdog.unref === "function") watchdog.unref();
  const fake = await startFakeModel(MODEL_PORT, srcAgentsMd);
  const serveLog = path.join(ROOT, "serve.stdout.log");
  const serveOut = fs.openSync(serveLog, "a");
  const serve = spawn(OPENCODE_BIN, ["serve", "--port", String(SERVE_PORT), "--hostname", "127.0.0.1"], { env, cwd: WORKSPACE, stdio: ["ignore", serveOut, serveOut] });
  children.push(serve);
  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      try {
        const r = await api("GET", "/api/info");
        if (r.status === 200) { healthy = true; break; }
      } catch {}
    }
    check("isolated serve healthy (private HOME, no external creds)", healthy, `127.0.0.1:${SERVE_PORT}`);
    if (!healthy) throw new Error("Private server did not become healthy");
    const nativeInfo = await mustApi("GET", "/api/info", undefined, "private server identity");
    const ownsServer = Number.isInteger(nativeInfo?.pid) && nativeInfo.pid === serve.pid
      && serve.exitCode === null && serve.signalCode === null;
    check("server PID matches the owned child before any mutating API call", ownsServer);
    if (!ownsServer) throw new Error("Private server identity mismatch; refusing to reload or mutate a foreign instance");
    const nativeVersion = nativeInfo.version ?? null;
    fs.writeFileSync(path.join(ROOT, "sandbox-manifest.json"), JSON.stringify({
      source: { jsonc: SRC_JSONC, agents: SRC_AGENTS, agentsMd: SRC_AGENTS_MD, depth: srcCfg.experimental.subagent_depth, sha256: srcHashes },
      sandbox: { config: path.join(cfgDir, "opencode.json"), agents: agentsDir },
      sandboxConfigSha256: sha256(fs.readFileSync(path.join(cfgDir, "opencode.json"), "utf8")),
      native: { version: nativeVersion, bin: OPENCODE_BIN, pid: nativeInfo.pid },
      modelOverrides: overrideIds, ports: { model: MODEL_PORT, serve: SERVE_PORT },
      coverage: ["A", "C", "P", "X", "D", "M", "T", "V", "E", "F", "G", "H", "I", "J", "L"],
      // Backup retention proof (PRIVATE manifest, not on-disk source): the four
      // removed operating files' last-approved contents, verified byte-identical
      // to both backup sets before authorized deletion. Never auto-restored.
      retiredBackup: {
        note: "user-authorized removal; originals recoverable from these private backups only",
        files: {
          engineer: { sha256: "7ba211bec5eb1ac8a23595ef35adc0a0ca77c440b5832a1d7c261b7a9264f03c" },
          design: { sha256: "cff01e0f9d435ea1d0e80f0accb6c50976b9d11ec97be21dfd7b289b6e5807b5" },
          research: { sha256: "e2df56022a47c20c17632ba135f7b73c7f066263b37bd93084cb51acce680854" },
          critic: { sha256: "6b4fa4df05845b312680b9691fef0743938c1e15da3a622cf9bf6132d31c6ac7" },
        },
        locations: [
          "/tmp/opencode/ksi-native-lead-deploy-wpt16al1/working-before/global/agents/",
          "/tmp/opencode/ksi-native-lead-deploy-wpt16al1/installed-before/agents/",
        ],
      },
    }, null, 1));

    // --- 3. Scope-aware location readiness + actual role registry.
    // /api/agent is location-scoped: it answers [] until the location is loaded,
    // so readiness is verified explicitly (location info -> reload -> bootstrap
    // session -> catalog), all with canonical shapes. Modes, models and prompts
    // below come from this catalog, never from session.create echoes.
    const LOC_Q = `location[directory]=${encodeURIComponent(WORKSPACE)}`;
    const locInfo = await mustApi("GET", `/api/location?${LOC_Q}`, undefined, "location readiness");
    check("location ready (canonical directory/project shape)", locInfo?.directory === WORKSPACE && typeof locInfo?.project?.id === "string", `dir=${locInfo?.directory}`);
    await mustApi("POST", "/api/location/reload", undefined, "location reload", 204);
    check("location reload accepted (sandbox config loaded)", true);
    const registered = new Set();
    async function createSession(caller) {
      const d = (await mustApi("POST", "/api/session", {
        location: { directory: WORKSPACE }, agent: caller, model: { id: "fixture", providerID: "fixture" },
      }, `session.create ${caller}`))?.data ?? {};
      if (typeof d.id !== "string" || !d.id) throw new Error(`session.create ${caller}: canonical {data.id} shape missing`);
      if (d.agent !== caller) throw new Error(`agent echo mismatch: want=${caller} got=${d.agent}`);
      registered.add(caller);
      return d.id;
    }
    // One bootstrap session loads the location; the rest prove registration.
    // Registration alone proves nothing about mode: subagent-mode agents accept
    // root creation too, so mode/model/prompt assertions use the catalog below.
    // Removed agents are never instantiated here: their absence is proven by
    // catalog reads plus live target-denies and the real-call failure in chain
    // X, not by creating sessions for them.
    const OPERATING_IDS = ["build", "plan", "lead", "general", "explore"];
    for (const id of OPERATING_IDS) {
      await createSession(id);
    }
    check("sandbox resolves all 5 operating profiles (registration only)", OPERATING_IDS.every((id) => registered.has(id)), [...registered].sort().join(","));
    const agentCatalog = await mustApi("GET", `/api/agent?${LOC_Q}`, undefined, "agent catalog");
    if (agentCatalog?.location?.directory !== WORKSPACE) throw new Error("agent catalog location echo mismatch");
    const catalogList = requireDataArray(agentCatalog, "agent catalog");
     const byId = new Map(catalogList.map((a) => [a?.id, a]));
     fs.writeFileSync(path.join(ROOT, "catalog-operating.json"), JSON.stringify(catalogList, null, 1));
    for (const id of OPERATING_IDS) {
      check(`sandbox catalog registers ${id}`, byId.has(id));
    }
    // Removal proof: only five operating profiles are offered; no retired or
    // alias catalog entry — hidden or not — may exist (any such entry is a
    // phantom and fails). The removed files' last-approved contents survive
    // only in the private manifest backups, never in the sandbox agents dir.
    for (const id of [...RETIRED_IDS, ...RETIRED_ALIASES]) {
      const entry = byId.get(id) ?? null;
      try { fs.writeFileSync(path.join(ROOT, `catalog-${id}-entry.json`), JSON.stringify(entry)); } catch {}
      check(`sandbox catalog offers no ${id} id (removed, phantom rejected)`, entry === null);
    }
     const wantModes = { ...CONTRACT.modes, build: "primary" };
     const defaultSession = (await mustApi("POST", "/api/session", {
       location: { directory: WORKSPACE }, model: { id: "fixture", providerID: "fixture" },
     }, "session.create Native default"))?.data;
     fs.writeFileSync(path.join(ROOT, "default-session-created.json"), JSON.stringify(defaultSession, null, 1));
    for (const [id, mode] of Object.entries(wantModes)) {
      check(`sandbox ${id} mode == ${mode} (catalog, not echo)`, byId.get(id)?.mode === mode, `got=${byId.get(id)?.mode}`);
    }
    for (const id of OPERATING_IDS) {
      const m = byId.get(id)?.model ?? {};
      check(`sandbox ${id} model == fixture/fixture (catalog)`, m.providerID === "fixture" && m.id === "fixture", `got=${m.providerID}/${m.id}`);
    }
    // The running server grounds on the actual Lead prompt: catalog system
    // text must equal the copied source body (normalization: CRLF/edge space).
    {
      const sys = byId.get("lead")?.system;
      check("sandbox lead prompt == source body (catalog system)", typeof sys === "string" && normText(sys) === normText(mdBody(mdSources.lead)), `systemLen=${typeof sys === "string" ? sys.length : "na"}`);
    }
    async function probe(caller, action, resource) {
      const id = await createSession(caller);
      const r = await api("POST", `/api/session/${id}/permission`, { action, resources: [resource], agent: caller });
      const d = r.status === 200 ? (r.json?.data ?? {}) : {};
      if (typeof d.effect !== "string") {
        check(`probe shape ${caller}/${action}`, false, `HTTP ${r.status}, no effect string`);
        return null;
      }
      if (d.effect === "ask") {
        // Unexpected in this matrix (all expectations are allow/deny): settle via
        // the shared helper and keep the effect mismatch visible. No retries.
        try {
          const res = await settleSourceFreeAskProbe({ sessionID: id, probe: d, api: restProbeApi, notice: `own-session cleanup ${caller}/${action}` });
          note(`ask settled ${caller}/${action}`, res.settled);
        } catch (e) {
          check(`ask cleanup ${caller}/${action} needs investigation`, false, String(e?.message ?? e).slice(0, 160));
        }
      }
      return d.effect;
    }

    // Policy probe against an EXISTING owned session (inherited session rules +
    // agent rules in effect there). Unlike probe(), this creates no session, so it
    // measures the target session's own effective policy. Ask outcomes settle via
    // the shared helper; no retries, no external calls.
    async function probeOn(sessionID, agent, action, resource) {
      const r = await api("POST", `/api/session/${sessionID}/permission`, { action, resources: [resource], agent });
      const d = r.status === 200 ? (r.json?.data ?? {}) : {};
      if (typeof d.effect !== "string") {
        check(`probe shape ${agent}/${action} @${String(sessionID).slice(-6)}`, false, `HTTP ${r.status}, no effect string`);
        return null;
      }
      if (d.effect === "ask") {
        try {
          const res = await settleSourceFreeAskProbe({ sessionID, probe: d, api: restProbeApi, notice: `own-session cleanup ${agent}/${action}` });
          note(`ask settled ${agent}/${action}`, res.settled);
        } catch (e) {
          check(`ask cleanup ${agent}/${action} needs investigation`, false, String(e?.message ?? e).slice(0, 160));
        }
      }
      return d.effect;
    }

    // --- 4. Runtime policy matrix (no model calls; own sessions only) ---
    // Scope: every contract allow plus self/build/retired/unknown
    // denies per caller, plus targeted cross-denies. Plan's general/explore
    // allows below are NATIVE-OBSERVED (source declares no Plan rules); the
    // retired-target denies under every caller are likewise genuine Native
    // effects — never faked. This is NOT an exhaustive 5x5 all-pairs claim;
    // the chains and the ceiling carry the depth proof.
    // No warmup, no retries: after scope-aware location readiness above, the FIRST
    // formal probe is build->lead expected allow (lead ordered first for
    // build). A deny there is a genuine blocker FAIL, recorded as-is (cause
    // unverified rather than skipped).
    const DENY_RETIRED_ARCHIVED = [...RETIRED_IDS, "architect", "build", UNKNOWN];
    for (const [caller, allows] of Object.entries(CONTRACT.edges)) {
      const ordered = caller === "build" ? ["lead", ...allows.filter((t) => t !== "lead")] : allows;
      const targets = [...new Set([...ordered, caller, ...DENY_RETIRED_ARCHIVED])];
      for (const t of targets) {
        // Plan declares no custom rules: every subagent probe reports the
        // NATIVE default (allow). Analysis delegation (general/explore) is the
        // intended use; retired exclusion rests on catalog absence plus the
        // real-call failure in chain X — never on a faked deny — and
        // self/ancestor discipline stays contractual (AGENTS.md), not
        // permission-enforced for the Native-permissioned Plan.
        const want = caller === "plan" ? "allow" : (allows.includes(t) ? "allow" : "deny");
        const got = await probe(caller, "subagent", t);
        check(`policy subagent ${caller} -> ${t}: ${want}`, got === want, `got=${got}`);
      }
    }
    // Retired/alias denies for every live caller EXCEPT Native-permissioned
    // plan (observed allow; see above): removed ids and legacy aliases are
    // never operational targets for build/lead/general/explore — the merged
    // catalog plus these denies and the real-call failure in chain X prove it.
    for (const caller of OPERATING_IDS) {
      for (const target of [...RETIRED_IDS, ...RETIRED_ALIASES]) {
        const got = await probe(caller, "subagent", target);
        const want = caller === "plan" ? "allow" : "deny";
        check(`policy subagent ${caller} -> ${target}: ${want}${caller === "plan" ? " (Native-observed; exclusion via catalog + chain X)" : " (retired/alias)"}`, got === want, `got=${got}`);
      }
    }
    // Cross-denies that pin the exact contract (spot checks beyond self/retired/unknown).
    // Plan pairs are intentionally absent: Native-observed plan allows are
    // asserted in the matrix above, not denied here.
    for (const [caller, target] of [["lead", "lead"], ["lead", "build"],
      ["general", "general"], ["general", "explore"], ["general", "plan"], ["general", "lead"],
      ["explore", "explore"], ["explore", "general"], ["explore", "plan"], ["explore", "lead"]]) {
      const got = await probe(caller, "subagent", target);
      check(`policy subagent ${caller} -> ${target}: deny`, got === "deny", `got=${got}`);
    }
    // E (policy half): plan edit deny (Native builtin behavior on normal files,
    // not a Plan-OS-readonly claim) vs lead/general edit allow; all read allow.
    // This checks effective policy only, NOT hard transitive readonly.
    const scopeAbs = path.join(WORKSPACE, "scope-note.txt");
    check("policy plan edit scope-note: deny (native builtin)", (await probe("plan", "edit", scopeAbs)) === "deny");
    check("policy lead edit scope-note: allow (own perms, not inherited)", (await probe("lead", "edit", scopeAbs)) === "allow");
    check("policy general edit scope-note: allow (execution role)", (await probe("general", "edit", scopeAbs)) === "allow");
    check("policy explore edit scope-note: deny (read-centric)", (await probe("explore", "edit", scopeAbs)) === "deny");
    check("policy plan read scope-note: allow", (await probe("plan", "read", scopeAbs)) === "allow");
    check("policy lead read scope-note: allow", (await probe("lead", "read", scopeAbs)) === "allow");
     check("policy explore read scope-note: allow", (await probe("explore", "read", scopeAbs)) === "allow");
     for (const caller of ["general", "explore"]) {
       check(`policy ${caller} question: deny (Native leaf)`, (await probe(caller, "question", "*")) === "deny");
     }

    // --- 5. Runtime chains (real Native sessions + real subagent tool calls) ---
    async function runChain(rootAgent, rootText, doneToken, label, settleSecs = 150) {
      const id = await createSession(rootAgent);
      await mustApi("POST", `/api/session/${id}/prompt`, { text: rootText }, `prompt ${label}`);
      let messages = null;
      for (let i = 0; i < settleSecs; i++) {
        const m = await api("GET", `/api/session/${id}/message?limit=100&order=asc`);
        const msgs = m.status === 200 ? (m.json?.data ?? null) : null;
        if (Array.isArray(msgs)) {
          messages = msgs;
          if (assistantTexts(messages).includes(doneToken)) break;
        }
        await sleep(1000);
      }
      if (!Array.isArray(messages)) throw new Error(`messages ${label}: canonical {data:[]} shape never observed`);
      fs.writeFileSync(path.join(ROOT, `messages-${label}.json`), JSON.stringify(messages, null, 1));
      return { id, messages };
    }
    // Follow-up turn on an existing owned session (continuity/recovery). Same
    // settle contract as runChain; the session (and its owned children) persist.
     async function promptTurn(sessionID, text, doneToken, label, settleSecs = 150) {
      await mustApi("POST", `/api/session/${sessionID}/prompt`, { text }, `prompt turn ${label}`);
      let messages = null;
      for (let i = 0; i < settleSecs; i++) {
        const m = await api("GET", `/api/session/${sessionID}/message?limit=100&order=asc`);
        const msgs = m.status === 200 ? (m.json?.data ?? null) : null;
        if (Array.isArray(msgs)) {
          messages = msgs;
          if (assistantTexts(messages).includes(doneToken)) break;
        }
        await sleep(1000);
      }
      if (!Array.isArray(messages)) throw new Error(`messages ${label}: canonical {data:[]} shape never observed`);
      fs.writeFileSync(path.join(ROOT, `messages-${label}.json`), JSON.stringify(messages, null, 1));
       return messages;
     }
     // Native chooses the default on execution, not in session.create metadata.
     // Check an actual completed assistant turn instead of treating that echo as
     // selection proof. The fixed local fixture replies without tools or writes.
     const defaultMessages = await promptTurn(defaultSession.id, "Reply ok without using tools.", "ok", "native-default");
     const defaultReplies = defaultMessages.filter((m) => m.type === "assistant" && m.time?.completed);
     check("Native default execution selects Build without an agent override",
       defaultReplies.length > 0 && defaultReplies.every((m) => m.agent === "build"),
       `agents=${defaultReplies.map((m) => m.agent).join(",")}`);
    // Owned-child ID straight from a Native subagent tool result delivered to the
    // parent (own API read of own session). Null when Native never reported one.
    function childIdFromParentMessages(messages) {
      for (const t of toolEntries(messages)) {
        if (t.name !== "subagent") continue;
        const id = lastSessionId(JSON.stringify(t.state?.content ?? ""));
        if (id) return id;
      }
      return null;
    }
    async function childrenOf(parentID) {
      const json = await mustApi("GET", `/api/session?parentID=${encodeURIComponent(parentID)}&limit=100`, undefined, `children of ${parentID}`);
      return requireDataArray(json, `children of ${parentID}`);
    }
    async function treeFrom(rootID) {
      const seen = new Map();
      let frontier = [{ id: rootID, depth: 0 }];
      while (frontier.length) {
        const next = [];
        for (const n of frontier) {
          if (seen.has(n.id)) continue;
          const g = await mustApi("GET", `/api/session/${n.id}`, undefined, `session ${n.id}`);
          const full = g?.data ?? null;
          if (!full || typeof full !== "object" || full.id !== n.id) {
            throw new Error(`session ${n.id}: canonical {data:{id}} shape missing`);
          }
          seen.set(n.id, { depth: n.depth, agent: full.agent ?? null, parentID: full.parentID ?? null });
          for (const c of await childrenOf(n.id)) {
            if (c?.id) next.push({ id: c.id, depth: n.depth + 1 });
          }
        }
        frontier = next;
      }
      return seen;
    }
    function reqLog() {
      return fs.readFileSync(path.join(ROOT, "fake-model-requests.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    }

    // Chain A (+C embedded, +E transmission half): the optional
    // Build->Lead->Plan->Explore advisory chain reaching the retained ceiling
    // of 3 when consultation is chosen (never required).
    const a = await runChain("build",
      `KSI-DELEG-A0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate down the allowed advisory chain and return the leaf finding to Main.`,
      "CHAIN-A-ROOT-OK", "chain-a");
    check("A root returns to Main (CHAIN-A-ROOT-OK)", assistantTexts(a.messages).includes("CHAIN-A-ROOT-OK"));
    const aTree = await treeFrom(a.id);
    const aDepths = [...aTree.entries()].map(([id, v]) => ({ id, ...v }));
    const maxDepthA = Math.max(...aDepths.map((d) => d.depth));
    const chainA = [a.id];
    {
      let cur = a.id, agents = [];
      for (let d = 0; d < 4; d++) {
        const kids = await childrenOf(cur);
        if (!kids.length) break;
        cur = kids[0].id ?? kids[0].sessionID;
        agents.push(kids[0].agent ?? null);
        chainA.push(cur);
      }
      check("A native parentID chain is lead->plan->explore", JSON.stringify(agents.slice(0, 3)) === JSON.stringify(["lead", "plan", "explore"]), agents.join(">"));
    }
    const logA = reqLog();
    for (const mk of ["KSI-DELEG-A0", "KSI-DELEG-A1", "KSI-DELEG-A2", "KSI-DELEG-A3"]) {
      check(`A level ran natively (${mk} hit fixture)`, logA.some((r) => r.marker === mk && r.hasTools), `reqs=${logA.filter((r) => r.marker === mk).length}`);
    }
    // Result-return evidence: each parent's tool result input (logged toolMsgs)
    // carries the child's OK marker back up. Transmission only, not understanding.
    const blobsA = logA.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-A")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    for (const [parentMk, childOk] of [["KSI-DELEG-A0", "CHAIN-A-LEAD-OK"], ["KSI-DELEG-A1", "CHAIN-A-PLAN-OK"], ["KSI-DELEG-A2", "CHAIN-A-EXPLORE-LEAF-OK"]]) {
      const seg = logA.filter((r) => r.marker === parentMk).flatMap((r) => r.toolMsgs ?? []).join("\n");
      check(`A native result returns (${parentMk} sees ${childOk})`, seg.includes(childOk));
    }
    // Handoff/origin markers transmitted at every level (full user text of each
    // request carries them; the last-300 tail alone is insufficient because Native
    // appends per-role reminders after the delegated prompt). Transmission only.
    for (const mk of ["KSI-DELEG-A0", "KSI-DELEG-A1", "KSI-DELEG-A2", "KSI-DELEG-A3"]) {
      const segs = logA.filter((r) => r.marker === mk);
      const carried = segs.length > 0 && segs.every((r) => ((r.userAll ?? "")).includes(HANDOFF) && ((r.userAll ?? "")).includes(ORIGIN));
      check(`A handoff scope transmitted at ${mk} (not model understanding)`, carried);
    }
    // C: depth cap. Explore(3) policy-DENIES explore->general, so the forced
    // depth-4 call is expected to end in a removed-tool rejection (catalog
    // omits the tool for a leaf-deny role). Strict pass rule: when `subagent`
    // is advertised at depth 3, ONLY the exact Native ceiling error passes
    // ("Subagent depth limit reached (3)" or an equivalent structured typed
    // depth error). When the catalog omits the tool, ONLY a removed-tool
    // rejection passes. Generic permission/network errors fail. Either way no
    // depth-4 child may exist: maxDepth stays <= 3.
    const a3reqs = logA.filter((r) => r.marker === "KSI-DELEG-A3");
    const a3advertised = a3reqs.length ? (a3reqs[0].advertised ?? []) : [];
    const catalogOmits = a3reqs.length > 0 && !a3advertised.includes("subagent");
    note("C depth-3 advertised catalog", a3reqs.length === 0 ? "no A3 requests (chain stalled before depth 3)"
      : `subagent ${catalogOmits ? "omitted" : "advertised"} among [${a3advertised.slice(0, 14).join(",")}]`);
    const exploreNodeId = chainA[3] ?? null;
    let forcedStatus = null, forcedErr = "";
    if (exploreNodeId) {
      const emsgs = requireDataArray(
        await mustApi("GET", `/api/session/${exploreNodeId}/message?limit=100&order=asc`, undefined, "explore child messages"),
        "explore child messages",
      );
      const forced = toolEntries(emsgs).find((t) => t.name === "subagent" && JSON.stringify(t.state?.input ?? {}).includes("general"));
      forcedStatus = forced?.state?.status ?? null;
      forcedErr = forced?.state?.error?.message ?? "";
    }
    check(
      `C depth guard holds (${catalogOmits ? "removed-tool rejection" : "exact depth error"})`,
      exploreNodeId !== null && forcedStatus === "error"
        && isDelegationCeilingError(forcedErr, { depth: CONTRACT.depth, toolAdvertised: !catalogOmits }),
      `status=${forcedStatus} err=${forcedErr.slice(0, 140)}`,
    );
    const depth4kids = exploreNodeId ? await childrenOf(exploreNodeId) : [];
    const noDepth4 = depth4kids.length === 0 && maxDepthA <= 3 && !blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED");
    check("C forced depth-4 attempt never succeeded (no session/text)", exploreNodeId !== null && forcedStatus !== "completed" && !blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED"), `status=${forcedStatus}`);
    check("C no depth-4 child exists (native/API parentID walk)", noDepth4, exploreNodeId === null ? "chain stalled before depth 3" : `maxDepth=${maxDepthA} kids=${depth4kids.length}`);
    if (maxDepthA > 3 || depth4kids.length > 0 || blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED")) {
      failClosed("C depth ceiling violated", `tree=${JSON.stringify(aDepths.map((d) => `${d.agent}@${d.depth}`))}`.slice(0, 300));
    }
    // Explore->general policy deny holds at depth 3 (the leaf-deny half of the
    // guard; the ceiling half is the no-depth-4 proof above).
    check("C explore->general policy is deny (leaf is the guard here)", (await probe("explore", "subagent", "general")) === "deny");

    // Chain P: optional direct Plan consultation. Build(0) -> Plan(1) calls
    // Plan for direction advice; Plan delegates ANALYSIS ONLY to Explore(2).
    steps.clear();
    const p = await runChain("build",
      `KSI-DELEG-P0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Consult plan for direction advice on the approved reference and return the finding to Main.`,
      "CHAIN-P-ROOT-OK", "chain-p");
    check("P root returns to Main (CHAIN-P-ROOT-OK)", assistantTexts(p.messages).includes("CHAIN-P-ROOT-OK"));
    {
      let cur = p.id, agents = [];
      for (let d = 0; d < 3; d++) {
        const kids = await childrenOf(cur);
        if (!kids.length) break;
        cur = kids[0].id ?? kids[0].sessionID;
        agents.push(kids[0].agent ?? null);
      }
      check("P native chain is plan->explore (analysis-only delegation)", JSON.stringify(agents.slice(0, 2)) === JSON.stringify(["plan", "explore"]), agents.join(">"));
    }
    const logP = reqLog();
    const blobsP = logP.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-P")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("P plan finding returns up (CHAIN-P-PLAN-OK seen by root)", blobsP.includes("CHAIN-P-PLAN-OK"));
    check("P explore leaf finding returns up (CHAIN-P-EXPLORE-LEAF-OK seen by plan)",
      logP.filter((r) => r.marker === "KSI-DELEG-P1").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("CHAIN-P-EXPLORE-LEAF-OK"));
    check("P explore leaf read the scope note (stub read result returned)", blobsP.includes("SCOPE-NOTE-CONTENT"));

    // --- X: retired fresh-call exclusion at REAL call time (Native Plan). ---
    // Plan probes report allow (Native default), so exclusion must be proven
    // by the actual call: one real `subagent -> engineer` attempt from a plan
    // child must fail closed (agent-not-found or permission-denied) and create
    // no child. With the retired operating files removed, no engineer session
    // can answer — the failure must be a genuine not-found. Success is never
    // faked into a deny; the exact tool message is logged.
    steps.clear();
    const x = await runChain("build",
      `KSI-DELEG-X0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Ask plan to place one call to a retired role and return the exact tool outcome to Main.`,
      "CHAIN-X-ROOT-OK", "chain-x");
    check("X root returns to Main (CHAIN-X-ROOT-OK)", assistantTexts(x.messages).includes("CHAIN-X-ROOT-OK"));
    const xKids = await childrenOf(x.id);
    check("X build owns one plan child", xKids.length === 1 && xKids[0].agent === "plan", xKids.map((k) => k.agent).join(","));
    const xPlan = xKids[0]?.id ?? null;
    const xPlanMsgs = xPlan ? requireDataArray(
      await mustApi("GET", `/api/session/${xPlan}/message?limit=100&order=asc`, undefined, "X plan messages"),
      "X plan messages",
    ) : [];
    const xCalls = toolEntries(xPlanMsgs).filter((t) => t.name === "subagent" && JSON.stringify(t.state?.input ?? {}).includes("engineer"));
    const xErr = xCalls.length === 1 ? (xCalls[0].state?.error?.message ?? "") : "";
    const xNotFound = /(not found|no such (agent|tool)|unknown agent)/i.test(xErr);
    const xDenied = /(denied|not permitted|not allowed)/i.test(xErr);
    check("X retired fresh call failed closed exactly once (not-found or deny, never success)",
      xCalls.length === 1 && xCalls[0].state?.status === "error" && (xNotFound || xDenied),
      `status=${xCalls[0]?.state?.status ?? "none"} shape=${xNotFound ? "not-found" : xDenied ? "deny" : "OTHER"} err=${xErr.slice(0, 160)}`);
    check("X retired call created no child session", xPlan ? (await childrenOf(xPlan)).length === 0 : false);
    const logX = reqLog();
    check("X plan outcome returned up (X1-EXCLUSION-OK in X0 inputs)",
      logX.filter((r) => r.marker === "KSI-DELEG-X0").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("X1-EXCLUSION-OK"));

    // E (runtime half) + global guards: no product writes in the analysis-only
    // chains A/P.
    const apCalls = reqLog().filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-A") || (r.marker ?? "").startsWith("KSI-DELEG-P")).flatMap((r) => r.scriptCalls ?? []);
    check("E/no product writes: zero write/edit calls in chains A/P", !apCalls.includes("write") && !apCalls.includes("edit"), `calls=[${[...new Set(apCalls)].join(",")}]`);
    const wsFiles = fs.readdirSync(WORKSPACE).sort();
    check("E workspace holds only the scope probe (analysis-only kept)", JSON.stringify(wsFiles) === JSON.stringify(["scope-note.txt"]), wsFiles.join(","));

    // --- 6. F: real child write/edit attempts are denied natively. ---
    // One build root fans out to plan/explore; each child makes
    // one forced write and one forced edit against the private fixture file.
    // Stated limit: Lead/General/Build are excluded (broad own permissions;
    // lead execution is proven ALLOWED by chain T, so a plan deny does not
    // transitively inherit to them). No product writes are made to
    // succeed here; byte integrity is asserted, not assumed.
    const scopeHashBeforeF = sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8"));
    const f = await runChain("build",
      `KSI-DELEG-W0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the file-operation probe to each restricted role in turn and return their exact outcomes to Main.`,
      "W-ROOT-OK", "chain-f");
    check("F root returns to Main (W-ROOT-OK)", assistantTexts(f.messages).includes("W-ROOT-OK"));
    const fKids = await childrenOf(f.id);
    check("F one owned child per probed role (no more, no less)",
      fKids.length === 2 && JSON.stringify(fKids.map((k) => k.agent).sort()) === JSON.stringify(["explore", "plan"]),
      fKids.map((k) => k.agent).join(","));
    const logF = reqLog();
    // Write/edit denial classifier (mirrors the shared delegation-errors module's
    // exact-match philosophy). Accepted Native enforcement forms only:
    //  - explicit permission denial,
    //  - catalog-removed rejection naming the exact tool, or
    //  - Native Plan confinement jailing mutations to the Plan directory.
    // Anything else (including success) fails. Exact messages stay in evidence.
    function isWriteEditDenial(tool, message) {
      if (typeof message !== "string" || !message) return false;
      if (/permission denied|not permitted|not allowed|access denied/i.test(message)) return true;
      if (message.startsWith(`No tool named "${tool}" is currently available.`)) return true;
      if (message.startsWith(`Cannot use ${tool} to modify files outside the Plan directory`)) return true;
      return false;
    }
    for (const [mk, role] of [["KSI-DELEG-W1", "plan"], ["KSI-DELEG-W2", "explore"]]) {
      const kid = fKids.find((k) => k.agent === role);
      const kmsgs = kid ? requireDataArray(
        await mustApi("GET", `/api/session/${kid.id}/message?limit=100&order=asc`, undefined, `${role} probe child messages`),
        `${role} probe child messages`,
      ) : [];
      const writes = toolEntries(kmsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(DENIED_WRITE));
      const edits = toolEntries(kmsgs).filter((t) => t.name === "edit" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE));
      const wErr = writes.length === 1 ? (writes[0].state?.error?.message ?? "") : "";
      const eErr = edits.length === 1 ? (edits[0].state?.error?.message ?? "") : "";
      check(`F ${role} forced write denied natively (exactly once)`,
        writes.length === 1 && writes[0].state?.status === "error" && isWriteEditDenial("write", wErr), `status=${writes[0]?.state?.status ?? "none"} err=${wErr.slice(0, 120)}`);
      check(`F ${role} forced edit denied natively (exactly once)`,
        edits.length === 1 && edits[0].state?.status === "error" && isWriteEditDenial("edit", eErr), `status=${edits[0]?.state?.status ?? "none"} err=${eErr.slice(0, 120)}`);
      const adv = (logF.find((r) => r.marker === mk)?.advertised ?? []).slice(0, 12).join(",");
      note(`F ${role} advertised catalog at attempt`, `[${adv}]`);
    }
    const blobsW0 = logF.filter((r) => r.marker === "KSI-DELEG-W0").flatMap((r) => r.toolMsgs ?? []).join("\n");
    for (const mk of ["KSI-DELEG-W1", "KSI-DELEG-W2"]) {
      check(`F leaf outcome returned up (FW-LEAF-OK-${mk})`, blobsW0.includes(`FW-LEAF-OK-${mk}`));
    }
    check("F denied file never created", !fs.existsSync(path.join(WORKSPACE, DENIED_WRITE)));
    check("F fixture bytes unchanged (sha256 before/after)", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeF);

    // --- 7. G: continuity across parent turns via the owned child sessionID. ---
    // Mechanics only: the same Native child keeps both turns; markers prove what
    // traveled, never that any model judged or remembered anything by itself.
    const g1 = await runChain("build",
      `KSI-DELEG-G0 ${HANDOFF} ${ORIGIN} ${ORIGREQ} ${SCOPE_SENTENCE} Read the approved reference once and return the finding; a follow-up turn will resume your worker.`,
      "G0-ROOT-OK", "chain-g1");
    const gChildId = childIdFromParentMessages(g1.messages);
    check("G turn1 reports the owned childID in its Native tool result", typeof gChildId === "string" && gChildId.length > 0, gChildId ?? "none");
    const gKids1 = await childrenOf(g1.id);
    check("G turn1 owns exactly one general child", gKids1.length === 1 && gKids1[0].agent === "general" && gKids1[0].id === gChildId, gKids1.map((k) => `${k.agent}:${k.id}`).join(","));
    const g2msgs = await promptTurn(g1.id,
      `KSI-DELEG-G2 resume owned child ${gChildId} ${HANDOFF} ${ORIGIN} ${ORIGREQ} ${NEWSCOPE} ${SCOPE_SENTENCE} Give the worker one new observation read and return updated findings.`,
      "G2-ROOT-OK", "chain-g2");
    const logG = reqLog();
    const g2reqs = logG.filter((r) => r.marker === "KSI-DELEG-G2");
    check("G turn2 resumed the owned childID (not a new session)",
      g2reqs.some((r) => (r.scriptArgs ?? []).join(" ").includes(gChildId ?? "###")),
      `resumeCalls=${g2reqs.filter((r) => (r.scriptCalls ?? []).includes("subagent")).length}`);
    const gKids2 = await childrenOf(g1.id);
    check("G still exactly one owned child after turn2 (no duplicate)", gKids2.length === 1 && gKids2[0].id === gChildId, gKids2.map((k) => k.id).join(","));
    const gChildMsgs = gChildId ? requireDataArray(
      await mustApi("GET", `/api/session/${gChildId}/message?limit=100&order=asc`, undefined, "G owned child messages"),
      "G owned child messages",
    ) : [];
    const gChildBlob = JSON.stringify(gChildMsgs);
    check("G owned child keeps turn1 prompt and result", gChildBlob.includes("KSI-DELEG-G1") && gChildBlob.includes("G1-RESULT-OK"));
    check("G owned child carries turn2 prompt and new result", gChildBlob.includes("KSI-DELEG-G3") && gChildBlob.includes("G3-RESULT-OK"));
    check("G new scope delivered at turn2 (transmission only)",
      g2reqs.length > 0 && g2reqs.every((r) => (r.userAll ?? "").includes(NEWSCOPE)));
    check("G original requirement travels into the resumed turn (transmission only)",
      logG.filter((r) => r.marker === "KSI-DELEG-G3").some((r) => (r.userAll ?? "").includes(ORIGREQ) && (r.userAll ?? "").includes(NEWSCOPE)));
    const blobsG2 = g2reqs.flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("G resumed result returned to the parent (G3-RESULT-OK)", blobsG2.includes("G3-RESULT-OK"));
    check("G root keeps both turns (G0-ROOT-OK + G2-ROOT-OK)", assistantTexts(g2msgs).includes("G0-ROOT-OK") && assistantTexts(g2msgs).includes("G2-ROOT-OK"));

    // --- 8. H: failure -> new evidence -> resume & recover (same child). ---
    // The general child reads a file that does not exist: a real Native error,
    // returned as the child limit. The lead then resumes THAT child with an
    // approved new reference and a different question. The script selects this
    // recovery path; nothing here evidences model initiative or hypothesis change.
    const h = await runChain("build",
      `KSI-DELEG-H0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Ask the lead for H-evidence and return whatever comes back to Main.`,
      "H-ROOT-OK", "chain-h");
    check("H root returns to Main (H-ROOT-OK)", assistantTexts(h.messages).includes("H-ROOT-OK"));
    const hLeadKids = await childrenOf(h.id);
    check("H build owns one lead child", hLeadKids.length === 1 && hLeadKids[0].agent === "lead", hLeadKids.map((k) => k.agent).join(","));
    const hLead = hLeadKids[0]?.id ?? null;
    const hGenKids = hLead ? await childrenOf(hLead) : [];
    check("H lead owns one general child (no silent fan-out)", hGenKids.length === 1 && hGenKids[0].agent === "general", hGenKids.map((k) => k.agent).join(","));
    const hGen = hGenKids[0]?.id ?? null;
    const hGenMsgs = hGen ? requireDataArray(
      await mustApi("GET", `/api/session/${hGen}/message?limit=100&order=asc`, undefined, "H general child messages"),
      "H general child messages",
    ) : [];
    const missingReads = toolEntries(hGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(MISSING_EVIDENCE));
    const missingErr = missingReads.length === 1 ? (missingReads[0].state?.error?.message ?? "") : "";
    check("H missing-file read fails once with a real Native file error",
      missingReads.length === 1 && missingReads[0].state?.status === "error" && /(no such file|not found|ENOENT|does not exist)/i.test(missingErr),
      `status=${missingReads[0]?.state?.status ?? "none"} err=${missingErr.slice(0, 140)}`);
    const missingAttempts = reqLog().filter((r) => r.marker === "KSI-DELEG-H2" && (r.scriptCalls ?? []).includes("read")
      && (r.scriptArgs ?? []).join(" ").includes(MISSING_EVIDENCE)).length;
    check("H same failing call never repeated (exactly one attempt)", missingAttempts === 1, `attempts=${missingAttempts}`);
    const hGenBlob = JSON.stringify(hGenMsgs);
    check("H same child holds both the failed and the recovery turn", hGenBlob.includes("KSI-DELEG-H2R") && hGenBlob.includes("H2-LIMITED-OK"));
    const hLeadMsgs = hLead ? requireDataArray(
      await mustApi("GET", `/api/session/${hLead}/message?limit=100&order=asc`, undefined, "H lead messages"),
      "H lead messages",
    ) : [];
    const resumePart = toolEntries(hLeadMsgs).find((t) => t.name === "subagent" && JSON.stringify(t.state?.input ?? {}).includes("KSI-DELEG-H2R"));
    check("H recovery resumed the same general childID (not a new session)",
      !!resumePart && resumePart.state?.input?.sessionID === hGen, `sessionID=${resumePart?.state?.input?.sessionID ?? "none"}`);
    const logH = reqLog();
    check("H child limit returned first (H2-LIMITED-OK seen by lead)",
      logH.filter((r) => r.marker === "KSI-DELEG-H1").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("H2-LIMITED-OK"));
    // H bytes-vs-marker distinction: the resumed read is verified on H2R's OWN
    // Native session part (completed + output bytes); each hop up is verified on
    // that level's OWN tool inputs, never on a chain-wide blob. The stub embeds
    // only evidence sliced from the actual tool result it received.
    const hRecReads = toolEntries(hGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE));
    const hRecBytes = hRecReads.length === 1 ? JSON.stringify(hRecReads[0].state?.content ?? hRecReads[0].state ?? "") : "";
    check("H resumed child completed a real read (Native part output bytes)",
      hRecReads.length === 1 && hRecReads[0].state?.status === "completed" && hRecBytes.includes("SCOPE-NOTE-CONTENT"),
      `status=${hRecReads[0]?.state?.status ?? "none"} bytes=${hRecBytes.length}`);
    const hReceived = (mk, child) => logH.filter((r) => r.marker === mk)
      .some((r) => (r.toolMsgs ?? []).some((text) => text.includes(child) && text.includes("SCOPE-NOTE-CONTENT")));
    check("H lead received the recovered evidence (H2-RECOVERED-OK + bytes in H1 inputs)",
      hReceived("KSI-DELEG-H1", "H2-RECOVERED-OK"));
    check("H root received the recovered evidence (H1-LEAD-OK + bytes in H0 inputs)",
      hReceived("KSI-DELEG-H0", "H1-LEAD-OK"));
    check("H root returned the evidence to Main (H-ROOT-OK + bytes in root text)",
      assistantTexts(h.messages).includes("H-ROOT-OK") && assistantTexts(h.messages).includes("SCOPE-NOTE-CONTENT"));
    const hArgs = logH.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-H")).flatMap((r) => r.scriptArgs ?? []).join(" ");
    check("H no secret/absolute paths in recovery (approved refs only)", !hArgs.includes("..") && !/\s\/[a-z]/.test(hArgs) && !hArgs.includes("/tmp/") && !hArgs.includes("/home/"));
    check("H general created no deeper child", hGen ? (await childrenOf(hGen)).length === 0 : false);

    // --- 8b. J: lead dev-unit mechanics via ONE owned general child. ---
    // Build0 -> Lead1 -> General2 (real write+read of DEV_FILE); the
    // lead then resumes the SAME general child for a repair follow-up
    // (J3: real edit+read). Task-local file only; the shared scope contract
    // stays read-only. Mechanics only, not model quality.
    steps.clear();
    const j = await runChain("build",
      `KSI-DELEG-J0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have the lead implement the dev-unit task through one owned general worker and return its findings to Main.`,
      "J0-ROOT-OK", "chain-j");
    check("J root returns to Main (J0-ROOT-OK)", assistantTexts(j.messages).includes("J0-ROOT-OK"));
    const jLeadKids = await childrenOf(j.id);
    check("J build owns one lead child", jLeadKids.length === 1 && jLeadKids[0].agent === "lead", jLeadKids.map((k) => k.agent).join(","));
    const jLead = jLeadKids[0]?.id ?? null;
    const jGenKids = jLead ? await childrenOf(jLead) : [];
    check("J lead owns exactly one general child (no silent fan-out)",
      jGenKids.length === 1 && jGenKids[0].agent === "general", jGenKids.map((k) => k.agent).join(","));
    const jGen = jGenKids[0]?.id ?? null;
    const logJ = reqLog();
    const j1reqs = logJ.filter((r) => r.marker === "KSI-DELEG-J1");
    check("J lead resumed the owned general childID (not a new session)",
      j1reqs.some((r) => (r.scriptArgs ?? []).join(" ").includes(jGen ?? "###")),
      `resumeCalls=${j1reqs.filter((r) => (r.scriptCalls ?? []).includes("subagent")).length}`);
    const jKidsAfter = jLead ? await childrenOf(jLead) : [];
    check("J still exactly one owned general child after repair (no duplicate)",
      jKidsAfter.length === 1 && jKidsAfter[0].id === jGen, jKidsAfter.map((k) => k.id).join(","));
    const jGenMsgs = jGen ? requireDataArray(
      await mustApi("GET", `/api/session/${jGen}/message?limit=100&order=asc`, undefined, "J owned general messages"),
      "J owned general messages",
    ) : [];
    const jWrites = toolEntries(jGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(DEV_FILE));
    const jEdits = toolEntries(jGenMsgs).filter((t) => t.name === "edit" && JSON.stringify(t.state?.input ?? {}).includes(DEV_FILE));
    const jReads = toolEntries(jGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(DEV_FILE));
    const jReadBytes = jReads.map((t) => JSON.stringify(t.state?.content ?? t.state ?? ""));
    check("J general completed the initial write (Native part, exactly once)",
      jWrites.length === 1 && jWrites[0].state?.status === "completed", `status=${jWrites[0]?.state?.status ?? "none"}`);
    check("J general completed the repair edit (Native part, exactly once)",
      jEdits.length === 1 && jEdits[0].state?.status === "completed", `status=${jEdits[0]?.state?.status ?? "none"} err=${(jEdits[0]?.state?.error?.message ?? "").slice(0, 120)}`);
    check("J general completed write-side and repair-side reads (Native parts)",
      jReads.length === 2 && jReads.every((t) => t.state?.status === "completed"),
      `reads=${jReads.length}`);
    // Own-part byte proof: the first read carries the initial bytes, the repair
    // read carries the repaired bytes. Order follows message order (J2 then J3).
    check("J write-side read returned the initial bytes (own Native part)",
      jReadBytes.length === 2 && jReadBytes[0].includes(DEV_LINE), `bytes=${jReadBytes[0]?.length ?? 0}`);
    check("J repair-side read returned the repaired bytes (own Native part)",
      jReadBytes.length === 2 && jReadBytes[1].includes(DEV_FIXED), `bytes=${jReadBytes[1]?.length ?? 0}`);
    check("J dev-unit file holds the repaired bytes", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);
    const jReceived = (mk, child) => logJ.filter((r) => r.marker === mk)
      .some((r) => (r.toolMsgs ?? []).some((text) => text.includes(child)));
    check("J lead received the worker evidence (J2-GENERAL-OK in J1 inputs)",
      jReceived("KSI-DELEG-J1", "J2-GENERAL-OK"));
    check("J lead received the repair evidence (J3-REPAIRED-OK in J1 inputs)",
      jReceived("KSI-DELEG-J1", "J3-REPAIRED-OK"));
    check("J lead received the repaired bytes (in J1 inputs via J3 result)",
      logJ.filter((r) => r.marker === "KSI-DELEG-J1").flatMap((r) => r.toolMsgs ?? []).join("\n").includes(DEV_FIXED));
    check("J root received the dev-unit evidence (J1-LEAD-OK in J0 inputs)",
      jReceived("KSI-DELEG-J0", "J1-LEAD-OK"));
    // Root text carries the latest evidence slice (repaired bytes) plus the root
    // token; each hop's own tool inputs carry that level's receipt.
    // Markers verify transmission, never model understanding.
    check("J root returned the evidence to Main (J0-ROOT-OK + repaired bytes in root text)",
      assistantTexts(j.messages).includes("J0-ROOT-OK") && assistantTexts(j.messages).includes(DEV_FIXED));
    check("J repaired bytes reached the root inputs (DEV_FIXED in J0 inputs)",
      jReceived("KSI-DELEG-J0", DEV_FIXED));
    check("J general created no deeper child", jGen ? (await childrenOf(jGen)).length === 0 : false);

    // --- 8c. D: positive completion WITHOUT independent review. ---
    // Build0 -> Lead1 -> General2 completes the unit file; default work ends
    // when requirements are verified, not when a review is satisfied. Proof is
    // the owned tree containing exactly {build, lead, general} with no
    // review-role sessions and no subagent call from the general leaf.
    steps.clear();
    const dd = await runChain("build",
      `KSI-DELEG-D0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have the lead complete the unit file through one owned general worker and return its exact read outcome to Main. No independent review is requested.`,
      "CHAIN-D-ROOT-OK", "chain-dd");
    check("D root returns to Main (CHAIN-D-ROOT-OK)", assistantTexts(dd.messages).includes("CHAIN-D-ROOT-OK"));
    const dKids = await childrenOf(dd.id);
    check("D build owns one lead child", dKids.length === 1 && dKids[0].agent === "lead", dKids.map((x) => x.agent).join(","));
    const dLead = dKids[0]?.id ?? null;
    const dGenKids = dLead ? await childrenOf(dLead) : [];
    check("D lead owns one general child", dGenKids.length === 1 && dGenKids[0].agent === "general", dGenKids.map((x) => x.agent).join(","));
    const dGen = dGenKids[0]?.id ?? null;
    const dGenMsgs = dGen ? requireDataArray(
      await mustApi("GET", `/api/session/${dGen}/message?limit=100&order=asc`, undefined, "D owned general messages"),
      "D owned general messages",
    ) : [];
    const dWrites = toolEntries(dGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(D_UNIT_FILE));
    const dReads = toolEntries(dGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(D_UNIT_FILE));
    const dReadBytes = dReads.length === 1 ? JSON.stringify(dReads[0].state?.content ?? dReads[0].state ?? "") : "";
    check("D general completed the unit write (Native part, exactly once)",
      dWrites.length === 1 && dWrites[0].state?.status === "completed", `status=${dWrites[0]?.state?.status ?? "none"}`);
    check("D general completed the unit read with output bytes (Native part)",
      dReads.length === 1 && dReads[0].state?.status === "completed" && dReadBytes.includes(D_UNIT_LINE),
      `status=${dReads[0]?.state?.status ?? "none"} bytes=${dReadBytes.length}`);
    check("D general made no subagent call (leaf, no review spawned)",
      toolEntries(dGenMsgs).filter((t) => t.name === "subagent").length === 0);
    check("D unit file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, D_UNIT_FILE), "utf8") === `${D_UNIT_LINE}\n`);
    const dTree = await treeFrom(dd.id);
    const dAgents = new Set([...dTree.values()].map((v) => v.agent));
    check("D tree holds only the owned chain (no review-role sessions)",
      [...dAgents].every((a) => ["build", "lead", "general"].includes(a)), [...dAgents].sort().join(","));
    const logD = reqLog();
    check("D lead received the unit evidence (D2-GENERAL-OK + bytes in D1 inputs)",
      logD.filter((r) => r.marker === "KSI-DELEG-D1")
        .some((r) => (r.toolMsgs ?? []).some((text) => text.includes("D2-GENERAL-OK") && text.includes(D_UNIT_LINE))));
    check("D general created no deeper child", dGen ? (await childrenOf(dGen)).length === 0 : false);

    // --- 8d. M: Build-direct General multi-file task. ---
    // Build0 -> General1 writes+reads TWO task-local files. Positive proof
    // that small clear work may go Build-direct/General with no obligatory
    // Lead stage — including multi-file execution inside the assigned scope.
    steps.clear();
    const m = await runChain("build",
      `KSI-DELEG-M0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have one owned general worker create both direct files and return their exact read outcomes to Main.`,
      "CHAIN-M-ROOT-OK", "chain-m");
    check("M root returns to Main (CHAIN-M-ROOT-OK)", assistantTexts(m.messages).includes("CHAIN-M-ROOT-OK"));
    const mKids = await childrenOf(m.id);
    check("M build owns one general child (direct, no Lead stage)", mKids.length === 1 && mKids[0].agent === "general", mKids.map((x) => x.agent).join(","));
    const mGen = mKids[0]?.id ?? null;
    const mGenMsgs = mGen ? requireDataArray(
      await mustApi("GET", `/api/session/${mGen}/message?limit=100&order=asc`, undefined, "M owned general messages"),
      "M owned general messages",
    ) : [];
    const mWritesA = toolEntries(mGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(DIRECT_A_FILE));
    const mWritesB = toolEntries(mGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(DIRECT_B_FILE));
    const mReadsA = toolEntries(mGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(DIRECT_A_FILE));
    const mReadsB = toolEntries(mGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(DIRECT_B_FILE));
    check("M general completed both direct writes (Native parts, exactly once each)",
      mWritesA.length === 1 && mWritesA[0].state?.status === "completed"
      && mWritesB.length === 1 && mWritesB[0].state?.status === "completed",
      `a=${mWritesA[0]?.state?.status ?? "none"} b=${mWritesB[0]?.state?.status ?? "none"}`);
    const mBytesA = mReadsA.length === 1 ? JSON.stringify(mReadsA[0].state?.content ?? mReadsA[0].state ?? "") : "";
    const mBytesB = mReadsB.length === 1 ? JSON.stringify(mReadsB[0].state?.content ?? mReadsB[0].state ?? "") : "";
    check("M general completed both direct reads with output bytes (Native parts)",
      mReadsA.length === 1 && mReadsA[0].state?.status === "completed" && mBytesA.includes(DIRECT_A_LINE)
      && mReadsB.length === 1 && mReadsB[0].state?.status === "completed" && mBytesB.includes(DIRECT_B_LINE),
      `bytes=${mBytesA.length}/${mBytesB.length}`);
    check("M direct files hold the written bytes",
      fs.readFileSync(path.join(WORKSPACE, DIRECT_A_FILE), "utf8") === `${DIRECT_A_LINE}\n`
      && fs.readFileSync(path.join(WORKSPACE, DIRECT_B_FILE), "utf8") === `${DIRECT_B_LINE}\n`);
    const logM = reqLog();
    check("M build received both file outcomes (M1-GENERAL-OK + bytes in M0 inputs)",
      logM.filter((r) => r.marker === "KSI-DELEG-M0")
        .some((r) => (r.toolMsgs ?? []).some((text) => text.includes("M1-GENERAL-OK") && text.includes(DIRECT_A_LINE) && text.includes(DIRECT_B_LINE))));
    check("M general created no deeper child", mGen ? (await childrenOf(mGen)).length === 0 : false);

    // --- 8e. T: lead direct execution with ZERO children. ---
    // Build0 -> Lead1 performs one real write, one real edit and one read
    // directly (no subagent call), all completing natively with byte proof.
    // Counterpart to the F deny proofs for restricted roles.
    steps.clear();
    const t = await runChain("build",
      `KSI-DELEG-T0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have the lead perform the requested file operations directly with no subagent call, then return the exact outcomes to Main.`,
      "CHAIN-T-ROOT-OK", "chain-t");
    check("T root returns to Main (CHAIN-T-ROOT-OK)", assistantTexts(t.messages).includes("CHAIN-T-ROOT-OK"));
    const tKids = await childrenOf(t.id);
    check("T build owns one lead child", tKids.length === 1 && tKids[0].agent === "lead", tKids.map((x) => x.agent).join(","));
    const tLead = tKids[0]?.id ?? null;
    check("T lead created no child (direct execution, zero subagents)", tLead ? (await childrenOf(tLead)).length === 0 : false);
    const tLeadMsgs = tLead ? requireDataArray(
      await mustApi("GET", `/api/session/${tLead}/message?limit=100&order=asc`, undefined, "T lead messages"),
      "T lead messages",
    ) : [];
    const tWrites = toolEntries(tLeadMsgs).filter((t2) => t2.name === "write" && JSON.stringify(t2.state?.input ?? {}).includes(LEAD_DIRECT_FILE));
    const tEdits = toolEntries(tLeadMsgs).filter((t2) => t2.name === "edit" && JSON.stringify(t2.state?.input ?? {}).includes(LEAD_DIRECT_FILE));
    const tReads = toolEntries(tLeadMsgs).filter((t2) => t2.name === "read" && JSON.stringify(t2.state?.input ?? {}).includes(LEAD_DIRECT_FILE));
    check("T lead made no subagent call (own parts only)",
      toolEntries(tLeadMsgs).filter((t2) => t2.name === "subagent").length === 0);
    check("T lead completed the write (Native part, exactly once)",
      tWrites.length === 1 && tWrites[0].state?.status === "completed", `status=${tWrites[0]?.state?.status ?? "none"} err=${(tWrites[0]?.state?.error?.message ?? "").slice(0, 120)}`);
    check("T lead completed the edit (Native part, exactly once)",
      tEdits.length === 1 && tEdits[0].state?.status === "completed", `status=${tEdits[0]?.state?.status ?? "none"} err=${(tEdits[0]?.state?.error?.message ?? "").slice(0, 120)}`);
    const tReadBytes = tReads.length === 1 ? JSON.stringify(tReads[0].state?.content ?? tReads[0].state ?? "") : "";
    check("T lead completed the read with revised bytes (Native part)",
      tReads.length === 1 && tReads[0].state?.status === "completed" && tReadBytes.includes(LEAD_DIRECT_FIXED),
      `status=${tReads[0]?.state?.status ?? "none"} bytes=${tReadBytes.length}`);
    check("T lead file holds the revised bytes", fs.readFileSync(path.join(WORKSPACE, LEAD_DIRECT_FILE), "utf8") === `${LEAD_DIRECT_FIXED}\n`);
    const logT = reqLog();
    check("T lead outcome returned up (T1-LEAD-OK in T0 inputs)",
      logT.filter((r) => r.marker === "KSI-DELEG-T0").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("T1-LEAD-OK"));

    // --- 8f. V: CHOSEN optional restricted verification (fresh General). ---
    // A fresh uninvolved General session with explicit edit+shell denies (own
    // session, outside the D unit tree) reviews the completed D unit: it reads
    // the evidence, attempts the review-note write exactly once (must fail
    // closed), then returns findings as text. This proves the mechanics of the
    // OPTIONAL restricted-verification capability only — not product quality,
    // and it adds no production gate/profile/plugin. `No issue found` would be
    // an equally valid finding shape; here the scripted finding carries the
    // exact denied-write outcome plus evidence bytes.
    steps.clear();
    const scopeHashBeforeV = sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8"));
    const unitHashBeforeV = sha256(fs.readFileSync(path.join(WORKSPACE, D_UNIT_FILE), "utf8"));
    const vData = (await mustApi("POST", "/api/session", {
      location: { directory: WORKSPACE }, agent: "general",
      model: { id: "fixture", providerID: "fixture" },
      permissions: [
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "*", effect: "deny" },
      ],
    }, "V fresh restricted reviewer create"))?.data ?? {};
    if (typeof vData.id !== "string" || !vData.id) throw new Error("V reviewer create: canonical {data.id} shape missing");
    const vReviewer = vData.id;
    const vMsgs = await promptTurn(vReviewer,
      `KSI-DELEG-R1 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Chosen optional verification of the completed lead unit: read the approved scope reference and the unit file, attempt the requested review-note write exactly once, then return findings as text with the exact write outcome.`,
      "V1-FINDINGS-OK", "chain-v");
    check("V reviewer returns findings (V1-FINDINGS-OK)", assistantTexts(vMsgs).includes("V1-FINDINGS-OK"));
    const vParts = toolEntries(vMsgs);
    const vWrites = vParts.filter((t2) => t2.name === "write" && JSON.stringify(t2.state?.input ?? {}).includes(REVIEW_NOTE));
    const vWErr = vWrites.length === 1 ? (vWrites[0].state?.error?.message ?? "") : "";
    check("V reviewer forced write denied natively (exactly once)",
      vWrites.length === 1 && vWrites[0].state?.status === "error" && isWriteEditDenial("write", vWErr),
      `status=${vWrites[0]?.state?.status ?? "none"} err=${vWErr.slice(0, 120)}`);
    const vReads = vParts.filter((t2) => t2.name === "read" && t2.state?.status === "completed");
    const vBytes = vReads.map((t2) => JSON.stringify(t2.state?.content ?? t2.state ?? "")).join("\n");
    check("V reviewer completed evidence reads (scope + unit bytes in own parts)",
      vReads.length === 2 && vBytes.includes("SCOPE-NOTE-CONTENT") && vBytes.includes(D_UNIT_LINE),
      `reads=${vReads.length}`);
    check("V reviewer findings carry the evidence (unit bytes in return text)",
      assistantTexts(vMsgs).includes(D_UNIT_LINE));
    check("V review note never created", !fs.existsSync(path.join(WORKSPACE, REVIEW_NOTE)));
    check("V scope bytes unchanged (sha256 before/after)", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeV);
    check("V unit bytes unchanged (sha256 before/after)", sha256(fs.readFileSync(path.join(WORKSPACE, D_UNIT_FILE), "utf8")) === unitHashBeforeV);
    check("V reviewer created no deeper child", (await childrenOf(vReviewer)).length === 0);

    // --- 8g. L: parallel non-interference (one Build root, two concurrent children). ---
    // The root emits lead + general subagent calls in ONE assistant response;
    // Native schedules both children — the script never fakes concurrency with
    // marker echoes or a bare Promise.all assertion. Each child writes+reads
    // ONLY its own file (depth 1, direct work). The shared scope file must keep
    // identical bytes; off-scope touches fail. Goal is mechanic
    // non-interference evidence, not a benchmark. If Native serializes instead,
    // the overlap check below fails honestly as NOT PROVEN (a concrete
    // blocker, never a new layer).
    steps.clear();
    const scopeHashBeforeL = sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8"));
    const l = await runChain("build",
      `KSI-DELEG-L0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the two independent units concurrently — one to lead, one to general — and return both findings to Main.`,
      "L0-ROOT-OK", "chain-l");
    check("L root returns to Main (L0-ROOT-OK)", assistantTexts(l.messages).includes("L0-ROOT-OK"));
    const lKids = await childrenOf(l.id);
    check("L root owns exactly two children: lead + general (single fan-out)",
      lKids.length === 2 && JSON.stringify(lKids.map((k) => k.agent).sort()) === JSON.stringify(["general", "lead"]),
      lKids.map((k) => k.agent).join(","));
    const lEng = lKids.find((k) => k.agent === "lead")?.id ?? null;
    const lDes = lKids.find((k) => k.agent === "general")?.id ?? null;
    const lEngMsgs = lEng ? requireDataArray(
      await mustApi("GET", `/api/session/${lEng}/message?limit=100&order=asc`, undefined, "L lead messages"),
      "L lead messages",
    ) : [];
    const lDesMsgs = lDes ? requireDataArray(
      await mustApi("GET", `/api/session/${lDes}/message?limit=100&order=asc`, undefined, "L general messages"),
      "L general messages",
    ) : [];
    const lEngWrites = toolEntries(lEngMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lEngReads = toolEntries(lEngMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lDesWrites = toolEntries(lDesMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    const lDesReads = toolEntries(lDesMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    // Ownership isolation: neither child touches the other's file or the scope file.
    const lEngOff = toolEntries(lEngMsgs).filter((t) => ["write", "edit"].includes(t.name) && !JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lDesOff = toolEntries(lDesMsgs).filter((t) => ["write", "edit"].includes(t.name) && !JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    check("L lead completed write+read on its own file (own Native parts)",
      lEngWrites.length === 1 && lEngWrites[0].state?.status === "completed"
      && lEngReads.length === 1 && lEngReads[0].state?.status === "completed",
      `w=${lEngWrites[0]?.state?.status ?? "none"} r=${lEngReads[0]?.state?.status ?? "none"}`);
    check("L general completed write+read on its own file (own Native parts)",
      lDesWrites.length === 1 && lDesWrites[0].state?.status === "completed"
      && lDesReads.length === 1 && lDesReads[0].state?.status === "completed",
      `w=${lDesWrites[0]?.state?.status ?? "none"} r=${lDesReads[0]?.state?.status ?? "none"}`);
    const lEngReadBytes = lEngReads.length === 1 ? JSON.stringify(lEngReads[0].state?.content ?? lEngReads[0].state ?? "") : "";
    const lDesReadBytes = lDesReads.length === 1 ? JSON.stringify(lDesReads[0].state?.content ?? lDesReads[0].state ?? "") : "";
    check("L lead read returned its own bytes (own Native part)",
      lEngReadBytes.includes(L_API_LINE), `bytes=${lEngReadBytes.length}`);
    check("L general read returned its own bytes (own Native part)",
      lDesReadBytes.includes(L_UI_LINE), `bytes=${lDesReadBytes.length}`);
    check("L lead made no off-scope mutation", lEngOff.length === 0, `off=${lEngOff.length}`);
    check("L general made no off-scope mutation", lDesOff.length === 0, `off=${lDesOff.length}`);
    check("L lead file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
    check("L general file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, L_UI_FILE), "utf8") === `${L_UI_LINE}\n`);
    check("L shared scope bytes unchanged (read-only conflict guard)",
      sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeL);
    // Both findings returned into the SAME parent turn (single-response fan-out,
    // not two sequential delegations).
    const logL = reqLog();
    const l0inputs = logL.filter((r) => r.marker === "KSI-DELEG-L0").flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("L both child outcomes returned to the parent turn (L1-LEAD + L2-GENERAL in L0 inputs)",
      l0inputs.includes("L1-LEAD-OK") && l0inputs.includes("L2-GENERAL-OK"));
    // Real overlap: wall-clock windows of the two branches' model requests
    // must intersect strictly. Serialized execution fails here honestly.
    const win = (mk) => logL.filter((r) => r.marker === mk && r.hasTools && typeof r.t === "number").map((r) => r.t).sort((a, b) => a - b);
    const wEng = win("KSI-DELEG-L1"), wDes = win("KSI-DELEG-L2");
    const overlap = wEng.length >= 2 && wDes.length >= 2 && wEng[0] < wDes[wDes.length - 1] && wDes[0] < wEng[wEng.length - 1];
    check("L lead/general model-request windows overlap (real concurrency, not Promise.all only)",
      overlap, `eng=[${wEng.join(",")}] des=[${wDes.join(",")}]`);
    check("L children created no deeper level", lEng ? (await childrenOf(lEng)).length === 0 : false);
    check("L general created no deeper level", lDes ? (await childrenOf(lDes)).length === 0 : false);

    // --- 9. I: session-scoped restrictions inherit to later-created children. ---
    // No plugin, router, alias, or workflow engine: only the Native session-rules
    // surface, used on our OWN sessions (a NEW analysis root; nothing else is
    // created or patched). Snapshot semantics: a child carries the rules in effect
    // when it was created; patching the root afterwards does not rewrite it.
    // Contrast with E: there Design is broad by ROLE permission; here Design and
    // General are confined by explicit SESSION rules, which apply after agent
    // rules. No claim about HTTP/browser/execute OS sandboxes is made; the shell
    // deny below evidences shell-path blocking capability only, via policy probe
    // (no real shell, no external network anywhere in this case).
    const I_RETAINED = { action: "webfetch", resource: "https://retained.invalid/*", effect: "deny" };
    const I_APPENDED = [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
    ];
    const hasRule = (rules, want) => Array.isArray(rules) && rules.some((r) =>
      r?.action === want.action && r?.resource === want.resource && r?.effect === want.effect);
    const iRootData = (await mustApi("POST", "/api/session", {
      location: { directory: WORKSPACE }, agent: "build",
      model: { id: "fixture", providerID: "fixture" },
      permissions: [I_RETAINED],
    }, "I root create"))?.data ?? {};
    if (typeof iRootData.id !== "string" || !iRootData.id) throw new Error("I root create: canonical {data.id} shape missing");
    const iRoot = iRootData.id;
    const iRootPerms0 = (await mustApi("GET", `/api/session/${iRoot}`, undefined, "I root pre-patch read"))?.data?.permissions;
    check("I root keeps its retained webfetch deny (pre-patch read)",
      hasRule(iRootPerms0, I_RETAINED) && iRootPerms0.length === 1, `rules=${(iRootPerms0 ?? []).length}`);
    // Turn A BEFORE the patch: the Plan child snapshots webfetch-only rules.
    const iaMsgs = await promptTurn(iRoot,
      `KSI-DELEG-I0A ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Read the approved reference once under the current session rules and return the finding.`,
      "I0A-ROOT-OK", "chain-i0a");
    check("I turn A returns (I0A-ROOT-OK)", assistantTexts(iaMsgs).includes("I0A-ROOT-OK"));
    const iPreKids = await childrenOf(iRoot);
    check("I turn A owns one plan child", iPreKids.length === 1 && iPreKids[0].agent === "plan", iPreKids.map((k) => k.agent).join(","));
    const iPre = iPreKids[0]?.id ?? null;
    const iPrePerms = iPre ? (await mustApi("GET", `/api/session/${iPre}`, undefined, "I pre-patch child read"))?.data?.permissions : null;
    check("I pre-patch child snapshot is exactly the retained rule (ordered, no extras)",
      isDeepStrictEqual(iPrePerms, [I_RETAINED]),
      `rules=${JSON.stringify(iPrePerms)}`.slice(0, 200));
    // PATCH appends edit+shell denies (replace semantics: the retained rule is
    // re-sent, never dropped). Own root only.
    await mustApi("PATCH", `/api/session/${iRoot}`, { permissions: [I_RETAINED, ...I_APPENDED] }, "I root patch", 204);
    const iRootPerms1 = (await mustApi("GET", `/api/session/${iRoot}`, undefined, "I root post-patch read"))?.data?.permissions;
    check("I patch preserves the retained deny and adds edit+shell denies",
      isDeepStrictEqual(iRootPerms1, [I_RETAINED, ...I_APPENDED]),
      `rules=${(iRootPerms1 ?? []).length}`);
    try {
      const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "sandbox-manifest.json"), "utf8"));
      mf.iCase = { root: iRoot, retained: I_RETAINED, appended: I_APPENDED };
      fs.writeFileSync(path.join(ROOT, "sandbox-manifest.json"), JSON.stringify(mf, null, 1));
    } catch {}
    // The pre-patch child must be byte-identical to its creation snapshot: a full
    // ordered deep-equal, so an added allow, a new deny, or a reorder cannot hide
    // behind a retained+absent spot check (that weaker form admits counterexamples).
    const iPrePerms1 = iPre ? (await mustApi("GET", `/api/session/${iPre}`, undefined, "I pre-patch child re-read"))?.data?.permissions : null;
    check("I pre-patch child keeps its exact snapshot (deep-equal, no retroactive rewrite)",
      iPre !== null && isDeepStrictEqual(iPrePerms1, iPrePerms),
      `rules=${JSON.stringify(iPrePerms1)}`.slice(0, 200));
    // Turn B AFTER the patch: Build0->Lead1->Plan2->General3 (depth 3 max).
    // This owned strict session fixture is where analysis-only is ENFORCED for
    // Plan (inherited edit+shell denies confine the I2 plan child to reads);
    // static config carries no Plan allowlist by design.
    const ibMsgs = await promptTurn(iRoot,
      `KSI-DELEG-I0B ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the analysis down the allowed chain under the current session rules and return the leaf finding to Main.`,
      "I-ROOT-OK", "chain-i0b");
    check("I turn B returns to Main (I-ROOT-OK)", assistantTexts(ibMsgs).includes("I-ROOT-OK"));
    const iTree = await treeFrom(iRoot);
    const iMaxDepth = Math.max(...[...iTree.values()].map((v) => v.depth));
    check("I chain respects the depth ceiling (max 3 from root 0)", iMaxDepth <= 3, `maxDepth=${iMaxDepth}`);
    // Identify the turn-B lead child by its prompt (a pre-patch plan child exists).
    const iPostKids = await childrenOf(iRoot);
    let iLead = null;
    for (const k of iPostKids) {
      if (k.agent !== "lead" || k.id === iPre) continue;
      const km = requireDataArray(
        await mustApi("GET", `/api/session/${k.id}/message?limit=20&order=asc`, undefined, "I lead child identify"),
        "I lead child identify",
      );
      if (JSON.stringify(km).includes("KSI-DELEG-I1B")) { iLead = k.id; break; }
    }
    check("I turn-B lead child identified (distinct from pre-patch child)", typeof iLead === "string" && iLead !== iPre, iLead ?? "none");
    const iPlanKids = iLead ? await childrenOf(iLead) : [];
    const iPlan = iPlanKids.length === 1 && iPlanKids[0].agent === "plan" ? iPlanKids[0].id : null;
    check("I lead owns one plan child", typeof iPlan === "string", iPlan ?? "none");
    const iGenKids = iPlan ? await childrenOf(iPlan) : [];
    const iGen = iGenKids.length === 1 && iGenKids[0].agent === "general" ? iGenKids[0].id : null;
    check("I plan owns one general leaf (depth 3, no fourth level)", typeof iGen === "string", iGen ?? "none");
    check("I general leaf created no deeper child", iGen ? (await childrenOf(iGen)).length === 0 : false);
    // Every post-patch descendant carries the FULL post-patch snapshot: deep-equal
    // against the actual root-after GET array (preserved above) and against the
    // exact expected ordered rules, so added/reordered rules cannot hide.
    const I_EXPECTED_AFTER = [I_RETAINED, ...I_APPENDED];
    for (const [label, sid] of [["lead", iLead], ["plan", iPlan], ["general", iGen]]) {
      const perms = sid ? (await mustApi("GET", `/api/session/${sid}`, undefined, `I ${label} rules read`))?.data?.permissions : null;
      check(`I ${label} session rules deep-equal the post-patch snapshot (ordered)`,
        sid !== null && isDeepStrictEqual(perms, iRootPerms1) && isDeepStrictEqual(perms, I_EXPECTED_AFTER),
        `rules=${JSON.stringify(perms)}`.slice(0, 220));
    }
    // Enforcement on the broad general leaf, in its own session context: real
    // write/edit attempts denied, reads allowed, fake webfetch denied by probe
    // only (no external network), shell path blocked by probe only (no real shell).
    const iGenMsgs = iGen ? requireDataArray(
      await mustApi("GET", `/api/session/${iGen}/message?limit=100&order=asc`, undefined, "I general leaf messages"),
      "I general leaf messages",
    ) : [];
    const iWrites = toolEntries(iGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(DENIED_WRITE));
    const iEdits = toolEntries(iGenMsgs).filter((t) => t.name === "edit" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE));
    const iWErr = iWrites.length === 1 ? (iWrites[0].state?.error?.message ?? "") : "";
    const iEErr = iEdits.length === 1 ? (iEdits[0].state?.error?.message ?? "") : "";
    check("I general forced write denied under session rules (exactly once)",
      iWrites.length === 1 && iWrites[0].state?.status === "error" && isWriteEditDenial("write", iWErr),
      `status=${iWrites[0]?.state?.status ?? "none"} err=${iWErr.slice(0, 120)}`);
    check("I general forced edit denied under session rules (exactly once)",
      iEdits.length === 1 && iEdits[0].state?.status === "error" && isWriteEditDenial("edit", iEErr),
      `status=${iEdits[0]?.state?.status ?? "none"} err=${iEErr.slice(0, 120)}`);
    check("I general edit probe denies in its session", iGen ? (await probeOn(iGen, "general", "edit", path.join(WORKSPACE, SCOPE_FILE))) === "deny" : false);
    check("I general shell probe denies in its session", iGen ? (await probeOn(iGen, "general", "shell", "echo i-probe")) === "deny" : false);
    check("I general read probe allows in its session", iGen ? (await probeOn(iGen, "general", "read", path.join(WORKSPACE, SCOPE_FILE))) === "allow" : false);
    check("I retained webfetch probe denies in its session (no external call)",
      iGen ? (await probeOn(iGen, "general", "webfetch", "https://retained.invalid/notes")) === "deny" : false);
    const logI = reqLog();
    const blobsI = logI.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-I")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("I pre-patch result returned (I1A-RESULT-OK seen by root)",
      logI.filter((r) => r.marker === "KSI-DELEG-I0A").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("I1A-RESULT-OK"));
    // The general leaf's read is verified on its OWN Native session part
    // (completed + output bytes in the tool result), never via a chain-wide blob
    // that the pre-patch plan read could also satisfy.
    const iReads = toolEntries(iGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE));
    const iReadBytes = iReads.length === 1 ? JSON.stringify(iReads[0].state?.content ?? iReads[0].state ?? "") : "";
    check("I general leaf completed a real read (Native part output bytes)",
      iReads.length === 1 && iReads[0].state?.status === "completed" && iReadBytes.includes("SCOPE-NOTE-CONTENT"),
      `status=${iReads[0]?.state?.status ?? "none"} bytes=${iReadBytes.length}`);
    // Bytes-up proof per level, each on its OWN branch's tool results (the
    // pre-patch I1A branch cannot satisfy these): the stub embeds only evidence
    // sliced from the actual tool result it received (EVID:… or an honest
    // NO-EVIDENCE-IN-RESULT flag), so bytes at a parent prove receipt, and the
    // parent's own EVID embedding proves onward return.
    const iReceived = (mk, child) => logI.filter((r) => r.marker === mk)
      .some((r) => (r.toolMsgs ?? []).some((text) => text.includes(child) && text.includes("SCOPE-NOTE-CONTENT")));
    check("I plan received the leaf evidence (I3-GENERAL-OK + bytes in I2 inputs)",
      iReceived("KSI-DELEG-I2", "I3-GENERAL-OK"));
    check("I lead received the evidence (I2-PLAN-OK + bytes in I1B inputs)",
      iReceived("KSI-DELEG-I1B", "I2-PLAN-OK"));
    check("I root received the evidence (I1B-LEAD-OK + bytes in I0B inputs)",
      iReceived("KSI-DELEG-I0B", "I1B-LEAD-OK"));
    check("I root returned the evidence to Main (I-ROOT-OK + bytes in root text)",
      assistantTexts(ibMsgs).includes("I-ROOT-OK") && assistantTexts(ibMsgs).includes("SCOPE-NOTE-CONTENT"));
    check("I turn-B branch children are free of pre-patch results (own histories only)", await (async () => {
      // Separation belongs to the CHILD sessions (fresh histories starting at
      // I1B): the resumed ROOT legitimately retains turn-A tool results in its
      // request history (Native continuity, same as G proves desirable), so the
      // root blob is the wrong place to demand amnesia.
      for (const [label, sid, own] of [["lead", iLead, "KSI-DELEG-I1B"], ["plan", iPlan, "KSI-DELEG-I2"], ["general", iGen, "KSI-DELEG-I3"]]) {
        if (typeof sid !== "string") return false;
        const cm = JSON.stringify(requireDataArray(
          await mustApi("GET", `/api/session/${sid}/message?limit=100&order=asc`, undefined, `I turn-B ${label} history`),
          `I turn-B ${label} history`,
        ));
        if (!cm.includes(own) || cm.includes("KSI-DELEG-I1A")) return false;
      }
      return true;
    })());
    check("I chain results returned up (I1B-LEAD-OK -> I2-PLAN-OK -> I3-GENERAL-OK)",
      blobsI.includes("I1B-LEAD-OK") && blobsI.includes("I2-PLAN-OK") && blobsI.includes("I3-GENERAL-OK"));

    const instructionRequests = reqLog();
    for (const [role, marker] of [
      ["build", "KSI-DELEG-A0"], ["lead", "KSI-DELEG-A1"],
      ["plan", "KSI-DELEG-A2"], ["explore", "KSI-DELEG-A3"],
      ["general", "KSI-DELEG-M1"],
    ]) {
      const first = instructionRequests.find((r) => r.marker === marker);
      check(`full common instructions reach ${role} model input (delivery only)`, first?.sharedInstructionsPresent === true);
    }

    // Final guards across F/G/H/I/J/D/M/T/V/L: still the same bytes.
    // J/D/M/T/V/L own exactly their separate task-local files; the shared scope
    // contract file is read-only everywhere (F proves the deny side, L the
    // parallel non-interference side, V the chosen-verification side).
    const wsFilesEnd = fs.readdirSync(WORKSPACE).sort();
    check("final workspace holds only the scope probe plus J/D/M/T/L task-local files",
      JSON.stringify(wsFilesEnd) === JSON.stringify([D_UNIT_FILE, DEV_FILE, DIRECT_A_FILE, DIRECT_B_FILE, L_API_FILE, L_UI_FILE, LEAD_DIRECT_FILE, SCOPE_FILE].sort()), wsFilesEnd.join(","));
    check("final fixture bytes unchanged since F", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeF);
    check("final dev-unit bytes are the repaired version", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);
    check("final lead-unit bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, D_UNIT_FILE), "utf8") === `${D_UNIT_LINE}\n`);
    check("final direct-a bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_A_FILE), "utf8") === `${DIRECT_A_LINE}\n`);
    check("final direct-b bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_B_FILE), "utf8") === `${DIRECT_B_LINE}\n`);
    check("final lead-direct bytes are the revised unit", fs.readFileSync(path.join(WORKSPACE, LEAD_DIRECT_FILE), "utf8") === `${LEAD_DIRECT_FIXED}\n`);
    check("final parallel API bytes are the lead unit", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
    check("final parallel UI bytes are the general unit", fs.readFileSync(path.join(WORKSPACE, L_UI_FILE), "utf8") === `${L_UI_LINE}\n`);

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed. Evidence dir: ${ROOT}`);
    if (failed.length) {
      console.log("FAILURES:", failed.map((f) => f.name).join("; "));
      process.exitCode = 1;
    }
    clearTimeout(watchdog);
  } finally {
    try { fake.closeAllConnections(); } catch {}
    await new Promise((resolve) => { try { fake.close(resolve); } catch { resolve(); } });
    if (serve.exitCode === null && serve.signalCode === null) {
      serve.kill("SIGTERM");
      await Promise.race([new Promise((resolve) => serve.once("exit", resolve)), sleep(2000)]);
      if (serve.exitCode === null && serve.signalCode === null) serve.kill("SIGKILL");
    }
    try { fs.closeSync(serveOut); } catch {}
    process.removeListener("exit", onExit);
  }
}

async function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Evidence dir: ${ROOT}`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name).join("; "));
    process.exitCode = 1;
  }
  // NOTE: watchdog is main-scoped; early finish() paths exit the process right
  // after via the settled main() promise (only servers keep the loop alive, and
  // none are started before the gates that call finish()).
}

main().catch((e) => {
  console.error("INTEGRATION-ERROR", e?.stack ?? String(e));
  process.exitCode = 1;
});
