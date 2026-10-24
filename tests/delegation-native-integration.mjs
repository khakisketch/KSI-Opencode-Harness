// Delegation native integration test: depth-3 dynamic delegation on real OpenCode v2 CLI.
//
// Spins up, in a private HOME/XDG sandbox:
//   1. a local scripted OpenAI-compatible model server (no external models/credentials),
//   2. `opencode serve` on an isolated loopback port with a sandbox config that is
//      COPIED from the current repo source (global/opencode.jsonc + global/agents/*.md)
//      with ONLY these mechanical transforms, all inside the sandbox:
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
//   A  build(0) -> engineer(1) -> plan(2) -> research(3, forced depth-4 attempt blocked)
//   B  build(0) -> engineer(1) -> plan(2) -> explore(3)   (required Engineer path)
//   J  build(0) -> engineer(1) -> general(2, write+read dev-unit, then SAME child
//      resumed for repair)   (required Engineer dev-unit mechanics: actual files,
//      real write/test/follow-up repair via one owned General child)
//   K  design(0, as Main) -> general(1, small-UI write+read)   (Design UI delivery
//      dynamics on its own fixture; rendered real-UI evidence stays Main-owned)
//   N  build(0) -> engineer(1, real write+edit ALLOWED proof with byte checks)
//   L  build(0) -> engineer(1) + design(1) in ONE response (parallel
//      non-interference: separate task-local files, shared scope read-only;
//      wall-clock request overlap required, serialization fails as NOT PROVEN)
//   D  design(0, as Main) -> critic(1)                     (direct selectable call)
//   C  depth cap at 3, embedded in A: the depth-3 research child still has a policy
//      ALLOW for research->explore (so a leaf-deny is not the guard), yet no depth-4
//      child may be created. Only the exact Native ceiling error passes when the
//      tool is advertised ("Subagent depth limit reached (3)" or an equivalent
//      structured typed depth error); a catalog-omitted tool admits only a
//      removed-tool rejection. Generic permission/network errors never pass.
//   E  plan edit=deny vs design(child) edit=allow via policy probes (NOT a proof of
//      hard transitive readonly), plus handoff-scope marker transmission through A,
//      zero product writes, results returned to Main.
//   F  real child write/edit denial: forced scripted write+edit attempts by
//      research/critic/plan children on the private fixture file end in
//      Native error (deny- or removed-tool-shaped), with byte-level file integrity.
//      Design/General/Engineer are NOT covered here: their own permissions are
//      broad (engineer execution is proven ALLOWED by chain N instead), so a
//      plan edit-deny does not transitively inherit to them (stated limit).
//   G  session continuity: root turn1/turn2 reuses the owned child via its Native
//      subagent sessionID; same childID, past messages kept, original requirement
//      plus new scope delivered, new result returned. Mechanics only.
//   H  failure -> new evidence -> resume & recover: a missing-file read fails with
//      a real Native error, the child returns its limit, then the SAME child
//      sessionID is resumed with an approved new reference and a different
//      question; the same failing call is never repeated. The script selects the
//      recovery path; this proves mechanics/scope/evidence plumbing, NOT model
//      initiative or judgment. Markers verify transmission, never understanding.
//      Ownership path: build -> engineer -> research (engineer replaces the retired
//      architect context; research still owns the missing-file limit).
//   I  explicit session-scoped restrictions inherit to later-created children (no
//      plugin/router/alias): a NEW owned analysis root keeps one retained deny,
//      gains edit+shell denies via PATCH (replace semantics: existing rules are
//      re-sent, never dropped), then delegates Build0->Engineer1->Design2->General3.
//      Children created BEFORE the patch keep the old snapshot (non-retroactive);
//      children created AFTER carry the full snapshot, so even broad Design and
//      General children refuse real write/edit attempts while reads succeed.
//      A fake webfetch target is verified by policy probe only (no external net).
//      Reads are verified on each session's OWN Native tool part (completed +
//      output bytes); each hop up is verified on that level's OWN tool inputs.
//      The stub embeds only evidence sliced from the actual tool result it got
//      (EVID:… or an honest NO-EVIDENCE-IN-RESULT flag) — never hardcoded bytes.
// Scope honesty: the runtime policy matrix covers every contract allow plus
// self/build/archived/unknown denies per caller and targeted
// cross-denies; it is NOT an exhaustive 8x8 (72-pair) all-pairs claim.
// J/K/N share one task-local workspace with SEPARATE files plus the shared
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
// depth-3 / 8-role contract; it never weakens permissions or falls back to interim
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
// Operational 8: build (primary), plan/design (all), engineer/research/critic/
// general/explore (subagent). Architect is physically archived at
// docs/archive/agents/architect.md (out of discovery) and appears in NO edge
// list; every caller must deny it, and no phantom registration may exist.
const CONTRACT = {
  depth: 3,
  modes: {
    plan: "all", design: "all",
    general: "subagent", explore: "subagent",
    engineer: "subagent", research: "subagent", critic: "subagent",
  },
  edges: {
    build: ["plan", "engineer", "design", "general", "explore", "research", "critic"],
    plan: ["research", "critic", "explore"],
    engineer: ["plan", "design", "general", "explore", "research", "critic"],
    design: ["plan", "engineer", "research", "critic", "general", "explore"],
    research: ["explore"],
    critic: [], general: [], explore: [],
  },
};
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
// J/K/N task-local fixtures: SEPARATE files per unit in the same workspace,
// sharing only the read-only scope contract above. No user projects/services.
// J: engineer dev-unit via one owned general child (write+read, then resumed repair).
const DEV_FILE = "dev-unit.txt";
const DEV_LINE = "DEV-UNIT-CONTENT initial implementation";
const DEV_FIXED = "DEV-UNIT-CONTENT repaired implementation";
// K: design-led small-UI unit via one owned general child (write+read dynamics;
// rendered real-UI acceptance stays Main-owned browser evidence, not asserted here).
const UI_FILE = "ui-snippet.css";
const UI_LINE = ".ksi-snippet { color: navy; }";
// N: engineer execution proof (write+edit ALLOWED, byte-verified).
const ENG_FILE = "eng-probe.txt";
const ENG_LINE = "ENG-PROBE-CONTENT initial";
const ENG_FIXED = "ENG-PROBE-CONTENT revised";
// L: parallel non-interference. One build root fans out to engineer + design in
// a SINGLE assistant response; each writes ONLY its own task-local file.
// The shared scope file stays read-only (hash-guarded); off-scope touches fail.
const L_API_FILE = "parallel-api.txt";
const L_API_LINE = "PARALLEL-API-CONTENT engineer unit";
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
// The fixture content family covers the shared scope probe plus the J/K/N/L
// task-local files; each alternative still only matches bytes Native delivered.
// LAST match wins so a resumed session surfaces its latest evidence (earlier
// history, e.g. pre-repair bytes, must not shadow the newest read).
function extractEvidenceSnippet(toolMsgs) {
  const joined = (Array.isArray(toolMsgs) ? toolMsgs : [toolMsgs]).join("\n");
  const all = [...joined.matchAll(/SCOPE-NOTE-CONTENT[^\n"\\]{0,48}|DEV-UNIT-CONTENT[^\n"\\]{0,48}|ENG-PROBE-CONTENT[^\n"\\]{0,48}|\.ksi-snippet[^\n"\\]{0,48}|PARALLEL-API-CONTENT[^\n"\\]{0,48}|\.parallel-ui[^\n"\\]{0,48}/g)];
  return all.length ? all[all.length - 1][0] : null;
}
function evidenceSuffix(toolMsgs) {
  return `EVID:${extractEvidenceSnippet(toolMsgs) ?? "NO-EVIDENCE-IN-RESULT"}`;
}
// Step counters advance ONLY on tool-carrying requests, so title/summary/text-only
// calls that echo transcript markers never consume a script step.
const steps = new Map();
function chainMarker(text) {
  // Most-specific first: KSI-DELEG-H2R contains KSI-DELEG-H2 as a substring, and
  // resumed sessions carry both the old and the new prompt in user history.
  for (const mk of ["KSI-DELEG-A4X", "KSI-DELEG-A3", "KSI-DELEG-A2", "KSI-DELEG-A1", "KSI-DELEG-A0",
    "KSI-DELEG-B3", "KSI-DELEG-B2", "KSI-DELEG-B1", "KSI-DELEG-B0",
    "KSI-DELEG-D1", "KSI-DELEG-D0",
    "KSI-DELEG-H2R", "KSI-DELEG-H2", "KSI-DELEG-H1", "KSI-DELEG-H0",
    "KSI-DELEG-G3", "KSI-DELEG-G2", "KSI-DELEG-G1", "KSI-DELEG-G0",
    "KSI-DELEG-J3", "KSI-DELEG-J2", "KSI-DELEG-J1", "KSI-DELEG-J0",
    "KSI-DELEG-K1", "KSI-DELEG-K0",
    "KSI-DELEG-N1", "KSI-DELEG-N0",
    "KSI-DELEG-L2", "KSI-DELEG-L1", "KSI-DELEG-L0",
    "KSI-DELEG-W3", "KSI-DELEG-W2", "KSI-DELEG-W1", "KSI-DELEG-W0",
    "KSI-DELEG-I0B", "KSI-DELEG-I1B", "KSI-DELEG-I0A", "KSI-DELEG-I1A", "KSI-DELEG-I2", "KSI-DELEG-I3"]) {
    if (text.includes(mk)) return mk;
  }
  return null;
}
const NEXT = {
  "KSI-DELEG-A0": { agent: "engineer", next: "KSI-DELEG-A1", done: "CHAIN-A-ROOT-OK" },
  "KSI-DELEG-A1": { agent: "plan", next: "KSI-DELEG-A2", done: "CHAIN-A-ENGINEER-OK" },
  "KSI-DELEG-A2": { agent: "research", next: "KSI-DELEG-A3", done: "CHAIN-A-PLAN-OK" },
  "KSI-DELEG-B0": { agent: "engineer", next: "KSI-DELEG-B1", done: "CHAIN-B-ROOT-OK" },
  "KSI-DELEG-B1": { agent: "plan", next: "KSI-DELEG-B2", done: "CHAIN-B-ENGINEER-OK" },
  "KSI-DELEG-B2": { agent: "explore", next: "KSI-DELEG-B3", done: "CHAIN-B-PLAN-OK" },
  "KSI-DELEG-D0": { agent: "critic", next: "KSI-DELEG-D1", done: "CHAIN-D-DESIGN-OK" },
};
function subPrompt(next) {
  return `${next} ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Return findings as text; findings travel back to Main.`;
}
// F sequence under one build root: each step delegates a different read-only
// role that is scripted to attempt a real file mutation once. Engineer is
// EXCLUDED here (execution role; its allow-proof is chain N below).
const WSEQ = [
  { agent: "research", next: "KSI-DELEG-W1" },
  { agent: "critic", next: "KSI-DELEG-W2" },
  { agent: "plan", next: "KSI-DELEG-W3" },
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
    // Depth-3 research child: policy ALLOWS research->explore, so only the depth
    // ceiling may stop this. The forced call is emitted whether or not `subagent`
    // is advertised; the next step proceeds regardless of the outcome.
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "explore", description: "deleg A3 forced", prompt: subPrompt("KSI-DELEG-A4X") } }],
      };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `CHAIN-A-RESEARCH-LEAF-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: "scope-note.txt" } }] };
    }
    return { kind: "text", text: `CHAIN-A-RESEARCH-LEAF-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-B3" || marker === "KSI-DELEG-D1") {
    const leaf = marker === "KSI-DELEG-B3" ? "CHAIN-B-EXPLORE-LEAF-OK" : "CHAIN-D-CRITIC-LEAF-OK";
    if (step === 0) {
      if (!has("read")) return { kind: "text", text: `${leaf} ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: "scope-note.txt" } }] };
    }
    return { kind: "text", text: `${leaf} ${HANDOFF} ${ORIGIN}` };
  }
  // F: W0 root fans out to four read-only roles; each W-child attempts one real
  // write then one real edit. Both are expected to fail natively (deny- or
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
  if (marker === "KSI-DELEG-W1" || marker === "KSI-DELEG-W2" || marker === "KSI-DELEG-W3") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DENIED_WRITE, content: "mutation attempt, must be denied\n" } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: SCOPE_FILE, oldString: SCOPE_LINE, newString: `${SCOPE_LINE}-MUTATION-ATTEMPT` } }] };
    }
    return { kind: "text", text: `FW-LEAF-OK-${marker} ${HANDOFF} ${ORIGIN}` };
  }
  // G: continuity via the owned child sessionID. G0 roots turn 1; G2 roots turn 2
  // and resumes the child ID carried in its own prompt (parsed from user text).
  if (marker === "KSI-DELEG-G0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "research", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-G1") + ` Requirement ${ORIGREQ}: keep the original question, decision and evidence.` } }],
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
        calls: [{ name: "subagent", args: { agent: "research", description: `resume ${marker}`, sessionID: resumeId, prompt: `KSI-DELEG-G3 ${HANDOFF} ${ORIGIN} ${NEWSCOPE} Requirement ${ORIGREQ}: keep the original question, decision and evidence; add one new observation read and return updated findings as text.` } }],
      };
    }
    return { kind: "text", text: `G2-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  // H: failure -> resume with new evidence -> recover. H2 reads a file that does
  // not exist (real Native error, returned as the child limit); H1 then resumes
  // the SAME research child with an approved new reference and a new question.
  if (marker === "KSI-DELEG-H0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "engineer", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-H1") } }],
      };
    }
    return { kind: "text", text: `H-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-H1") {
    if (step === 0) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "research", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-H2") + " Read the H-evidence file once and report what the read returned." } }],
      };
    }
    if (step === 1) {
      const resumeId = lastSessionId(toolMsgs);
      if (!resumeId) return { kind: "text", text: "H1-NO-CHILD-ID" };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "research", description: `resume ${marker}`, sessionID: resumeId, prompt: `KSI-DELEG-H2R ${HANDOFF} ${ORIGIN} New approved reference: read ${SCOPE_FILE} once with this different question: what evidence line does the approved reference carry? Return findings as text.` } }],
      };
    }
    return { kind: "text", text: `H1-ENGINEER-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
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
  // J: engineer dev-unit mechanics. J0 (build) -> J1 (engineer) -> J2 (general:
  // real write+read of the dev-unit file); J1 then resumes the SAME general
  // child for a repair follow-up (J3: real edit+read). All files are task-local
  // (DEV_FILE only); the shared scope contract stays read-only.
  if (marker === "KSI-DELEG-J0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "engineer", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-J1") + " Implement the dev-unit task via one owned general worker and return its findings." } }],
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
    return { kind: "text", text: `J1-ENGINEER-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
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
  // K: design-led small-UI unit. K0 (design as Main) -> K1 (general: real
  // write+read of its own UI fixture file). Rendered real-UI acceptance is NOT
  // asserted here; that evidence stays Main-owned browser verification.
  if (marker === "KSI-DELEG-K0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-K1") + " Write the UI snippet file once, read it back, and report the exact read outcome as text." } }],
      };
    }
    return { kind: "text", text: `K0-DESIGN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-K1") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: UI_FILE, content: `${UI_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `K1-GENERAL-UI-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: UI_FILE } }] };
    }
    return { kind: "text", text: `K1-GENERAL-UI-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // N: engineer execution proof. N0 (build) -> N1 (engineer: real write+edit
  // ALLOWED, byte-verified). Counterpart to the F deny proofs for read-only roles.
  if (marker === "KSI-DELEG-N0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "engineer", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-N1") + " Perform the requested file operations exactly once each, then report the exact tool outcomes as text." } }],
      };
    }
    return { kind: "text", text: `N0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-N1") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: ENG_FILE, content: `${ENG_LINE}\n` } }] };
    }
    if (step === 1) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: ENG_FILE, oldString: ENG_LINE, newString: ENG_FIXED } }] };
    }
    return { kind: "text", text: `N1-ENGINEER-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // L: parallel fan-out. L0 (build) emits BOTH subagent calls in ONE assistant
  // response so Native — never the script — schedules them; L1 (engineer) and
  // L2 (design) each write+read ONLY their own file. Mechanics only.
  if (marker === "KSI-DELEG-L0") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [
          { name: "subagent", args: { agent: "engineer", description: `deleg ${marker} eng`, prompt: subPrompt("KSI-DELEG-L1") + " Write the parallel API file once, read it back, and report the exact read outcome as text." } },
          { name: "subagent", args: { agent: "design", description: `deleg ${marker} des`, prompt: subPrompt("KSI-DELEG-L2") + " Write the parallel UI file once, read it back, and report the exact read outcome as text." } },
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
      if (!has("read")) return { kind: "text", text: `L1-ENGINEER-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: L_API_FILE } }] };
    }
    return { kind: "text", text: `L1-ENGINEER-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-L2") {
    if (step === 0) {
      return { kind: "tools", calls: [{ name: "write", args: { path: L_UI_FILE, content: `${L_UI_LINE}\n` } }] };
    }
    if (step === 1) {
      if (!has("read")) return { kind: "text", text: `L2-DESIGN-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: L_UI_FILE } }] };
    }
    return { kind: "text", text: `L2-DESIGN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // I: session-scoped restriction flow. I0A roots the pre-patch turn (Plan child
  // snapshots webfetch-only rules); I0B roots the post-patch turn with the full
  // Build0->Engineer1->Design2->General3 chain under the inherited snapshot.
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
        calls: [{ name: "subagent", args: { agent: "engineer", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I1B") } }],
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
        calls: [{ name: "subagent", args: { agent: "design", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I2") } }],
      };
    }
    return { kind: "text", text: `I1B-ENGINEER-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I2") {
    if (step === 0) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `deleg ${marker}`, prompt: subPrompt("KSI-DELEG-I3") } }],
      };
    }
    return { kind: "text", text: `I2-DESIGN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
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
function startFakeModel(port) {
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
  const mdIds = ["design", "research", "engineer", "critic"];
  const mdSources = {};
  for (const id of mdIds) {
    const p = path.join(SRC_AGENTS, `${id}.md`);
    if (!fs.existsSync(p)) {
      failClosed("CONTRACT-NOT-READY: role file missing in source", `global/agents/${id}.md`);
      return void finish();
    }
    mdSources[id] = fs.readFileSync(p, "utf8");
  }
  check("source role files present (design/research/engineer/critic)", true);
  // Physical archive out of discovery (Main + independent Plan decision):
  // architect.md lives byte-identical at docs/archive/agents/architect.md, the
  // operational path global/agents/architect.md is gone, and no hidden JSON
  // stub remains. This test never deletes/rewrites the archive, only records
  // its bytes and enforces absence from every operational surface.
  const SRC_ARCH = path.join(REPO, "docs", "archive", "agents", "architect.md");
  const OLD_ARCH_OPS = path.join(SRC_AGENTS, "architect.md");
  check("archived source present at docs/archive/agents/architect.md", fs.existsSync(SRC_ARCH));
  check("old operational role path absent (no global/agents/architect.md)", !fs.existsSync(OLD_ARCH_OPS));
  check("source agents declare no hidden architect stub (operational 4 only)",
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
  let edgesOk = true;
  const edgeDetail = [];
  for (const [caller, want] of Object.entries(CONTRACT.edges)) {
    let got;
    try {
      // Roles with source rules (JSON agents or Markdown) must declare exactly the
      // contract allows. Builtin leaves with no source rules (general/explore)
      // declare nothing; their leaf-ness is proven by live native probes below,
      // which stay authoritative if source later adds rules.
      const rules = mdSources[caller] ? parseMdRules(mdSources[caller]) : (srcAgents[caller]?.permissions ?? null);
      got = rules ? subagentAllows(rules) : [];
    } catch (e) {
      edgesOk = false; edgeDetail.push(`${caller}:unparseable`); continue;
    }
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) { edgesOk = false; edgeDetail.push(`${caller}:[${got}]`); }
  }
  check("source declares exact delegation edges", edgesOk, edgeDetail.join(" ") || "all 8 roles match");
  if (!edgesOk) { failClosed("CONTRACT-MISMATCH: refusing to weaken edges", edgeDetail.join("; ").slice(0, 300)); return void finish(); }
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
  check("source role modes match contract (plan/design all; rest subagent)", true);

  // --- 1b. Source freeze: exact models, single-provider routing, skill sets.
  // Every operational role uses the contracted Muse Contributor model; only
  // the reasoning variant differs by role.
  const WANT_MODELS = {
    "design.md": "opencode-go/muse-spark-1.3-contributor#high",
    "research.md": "opencode-go/muse-spark-1.3-contributor#medium",
    "engineer.md": "opencode-go/muse-spark-1.3-contributor#high",
    "critic.md": "opencode-go/muse-spark-1.3-contributor#xhigh",
  };
  let modelsOk = true;
  for (const [file, want] of Object.entries(WANT_MODELS)) {
    const got = mdFrontField(mdSources[file.replace(/\.md$/, "")], "model");
    if (got !== want) { modelsOk = false; note(`model drift ${file}`, `got=${got} want=${want}`); }
  }
  const WANT_JSON_MODELS = {
    plan: "opencode-go/muse-spark-1.3-contributor#xhigh",
    general: "opencode-go/muse-spark-1.3-contributor#high",
    explore: "opencode-go/muse-spark-1.3-contributor#low",
  };
  for (const [id, want] of Object.entries(WANT_JSON_MODELS)) {
    if (srcAgents[id]?.model !== want) { modelsOk = false; note(`model drift agents.${id}`, `got=${srcAgents[id]?.model} want=${want}`); }
  }
  check("source models match the frozen catalog references (Muse Contributor, role variants)", modelsOk);
  if (!modelsOk) { failClosed("CONTRACT-MISMATCH: source model drift", "see model drift notes"); return void finish(); }
  // Build root carries no forced model: caller/session selection applies.
  check("source forces no model on build root (no top-level or build model)",
    srcCfg.model === undefined && srcAgents.build?.model === undefined,
    `top=${srcCfg.model} build=${srcAgents.build?.model}`);
  // Single fixed provider: Muse Contributor only, no router and no per-model
  // OpenRouter data-policy filter left behind after the routing simplification.
  const museBody = srcCfg?.providers?.["opencode-go"]?.models?.["muse-spark-1.3-contributor"]?.body;
  check("source Muse routing exact (auto tool choice)",
    isDeepStrictEqual(museBody, { tool_choice: "auto" }),
    `got=${JSON.stringify(museBody)}`.slice(0, 160));
  check("source providers are exactly opencode-go (no auto router)",
    JSON.stringify(Object.keys(srcCfg.providers ?? {}).sort()) === JSON.stringify(["opencode-go"]),
    `got=${Object.keys(srcCfg.providers ?? {}).sort().join(",")}`);
  const hasFallbackKey = (o) => {
    if (Array.isArray(o)) return o.some(hasFallbackKey);
    if (o && typeof o === "object") return Object.keys(o).some((k) => k === "fallback" || hasFallbackKey(o[k]));
    return false;
  };
  check("source config declares no automatic fallback", !hasFallbackKey(srcCfg));
  // Skill sets: critic carries review + API/performance lenses; research
  // carries evidence-gathering lenses including accessibility; General is
  // executor-only; Explore has no skill surface. Engineer/Design keep their
  // broad default-allow premise, probed live.
  const WANT_CRITIC_SKILLS = ["building-accessible-interfaces", "evolving-apis-and-schemas", "impeccable", "investigating-performance", "journey", "opencode", "organize", "playwright-cli", "reviewing-security", "ux-copy", "ux-heuristics-audit", "vercel-react-best-practices"].sort();
  const WANT_RESEARCH_SKILLS = ["building-accessible-interfaces", "journey", "mobbin-design", "opencode", "organize", "playwright-cli"].sort();
  const WANT_GENERAL_SKILLS = ["building-accessible-interfaces", "evolving-apis-and-schemas", "opencode", "playwright-cli", "vercel-react-best-practices"].sort();
  const gotCriticSkills = skillAllows(parseMdRules(mdSources.critic));
  const gotResearchSkills = skillAllows(parseMdRules(mdSources.research));
  check("source critic skill allows are exactly the 12 (review + technical + copy lenses)",
    JSON.stringify(gotCriticSkills) === JSON.stringify(WANT_CRITIC_SKILLS), `got=[${gotCriticSkills.join(",")}]`);
  check("source research skill allows are exactly the 6 evidence lenses",
    JSON.stringify(gotResearchSkills) === JSON.stringify(WANT_RESEARCH_SKILLS), `got=[${gotResearchSkills.join(",")}]`);
  check("source General has executor-only skill allowlist",
    JSON.stringify(skillAllows(srcAgents.general?.permissions ?? [])) === JSON.stringify(WANT_GENERAL_SKILLS),
    `got=[${skillAllows(srcAgents.general?.permissions ?? []).join(",")}]`);
  check("source Explore has no skill surface",
    skillAllows(srcAgents.explore?.permissions ?? []).length === 0);
  check("source engineer/design declare zero skill rules (default-allow premise)",
    skillAllows(parseMdRules(mdSources.engineer)).length === 0 && skillAllows(parseMdRules(mdSources.design)).length === 0);
  // Shared instructions carry the OpenSpec + provider-data-policy contract.
  check("source AGENTS.md carries the OpenSpec/provider-policy bullet",
    srcAgentsMd.includes("OpenSpec") && srcAgentsMd.includes("not an automatic fallback")
    && srcAgentsMd.includes("Respect each provider's training, retention and region policy"));
  check("source AGENTS.md carries work-unit routing criteria",
    srcAgentsMd.includes("Work-unit routing") && srcAgentsMd.includes("bounded, already-decided slice")
    && srcAgentsMd.includes("Design** owns every UX/interface unit"));
  check("source keeps General ownership model-independent",
    srcAgentsMd.includes("model choice does not transfer ownership")
    && (srcAgents.general?.description ?? "").includes("Model choice does not transfer ownership"));
  check("source retires repo-bundled custom skill and detector plugin",
    !fs.existsSync(path.join(REPO, "skills", "task-first-ux-review"))
    && !fs.existsSync(path.join(REPO, "global", "plugins", "ksi-impeccable-detector")));
  const designSource = mdSources.design ?? "";
  check("source design uses the official Impeccable detector, not the custom hook",
    designSource.includes("detect --json") && !designSource.includes("task-first-ux-review"));
  check("source trial skills are wired to Engineer and Design",
    (mdSources.engineer ?? "").includes("diagnosing-bugs") && designSource.includes("ux-copy"));

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
  // Shared deployment-wide instructions travel into the sandbox global dir with
  // identical bytes, so the running server grounds on the same common text.
  fs.writeFileSync(path.join(cfgDir, "AGENTS.md"), srcAgentsMd);
  check("sandbox AGENTS.md same bytes as source", sha256(fs.readFileSync(path.join(cfgDir, "AGENTS.md"), "utf8")) === srcHashes.agentsMd);

  const overrideIds = [...new Set([...Object.keys(srcAgents), ...mdIds, "build", "plan", "general", "explore", "title", "compaction", "summary"])];
  const sandboxAgents = JSON.parse(JSON.stringify(srcAgents));
  for (const id of overrideIds) {
    sandboxAgents[id] = { ...(sandboxAgents[id] ?? {}), model: FIXTURE_MODEL };
    if (id === "explore") sandboxAgents[id].steps = sandboxAgents[id].steps ?? 20;
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
  const fake = await startFakeModel(MODEL_PORT);
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
      coverage: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "N", "L"],
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
    for (const id of ["build", "plan", "general", "explore", ...mdIds]) {
      await createSession(id);
    }
    check("sandbox resolves all 8 contract roles (registration only)", ["build", "plan", "general", "explore", ...mdIds].every((id) => registered.has(id)), [...registered].sort().join(","));
    const agentCatalog = await mustApi("GET", `/api/agent?${LOC_Q}`, undefined, "agent catalog");
    if (agentCatalog?.location?.directory !== WORKSPACE) throw new Error("agent catalog location echo mismatch");
    const catalogList = requireDataArray(agentCatalog, "agent catalog");
    const byId = new Map(catalogList.map((a) => [a?.id, a]));
    for (const id of ["build", "plan", "general", "explore", ...mdIds]) {
      check(`sandbox catalog registers ${id}`, byId.has(id));
    }
    const archEntry = byId.get("architect") ?? null;
    try { fs.writeFileSync(path.join(ROOT, "catalog-architect-entry.json"), JSON.stringify(archEntry)); } catch {}
    // Physical archive decision: default 8 registered, no 9th phantom. Any
    // catalog architect entry — hidden or not — is a phantom and fails.
    // Target-deny for every caller is additionally proven by the matrix below.
    check("sandbox catalog registers no architect id (phantom rejected)", archEntry === null);
    const wantModes = { ...CONTRACT.modes, build: "primary" };
    for (const [id, mode] of Object.entries(wantModes)) {
      check(`sandbox ${id} mode == ${mode} (catalog, not echo)`, byId.get(id)?.mode === mode, `got=${byId.get(id)?.mode}`);
    }
    for (const id of ["build", "plan", "general", "explore", ...mdIds]) {
      const m = byId.get(id)?.model ?? {};
      check(`sandbox ${id} model == fixture/fixture (catalog)`, m.providerID === "fixture" && m.id === "fixture", `got=${m.providerID}/${m.id}`);
    }
    // The running server grounds on the actual Markdown prompts: catalog system
    // text must equal the copied source bodies (normalization: CRLF/edge space).
    for (const id of mdIds) {
      const sys = byId.get(id)?.system;
      check(`sandbox ${id} prompt == source body (catalog system)`, typeof sys === "string" && normText(sys) === normText(mdBody(mdSources[id])), `systemLen=${typeof sys === "string" ? sys.length : "na"}`);
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
    // Scope: every contract allow plus self/build/archived/unknown
    // denies per caller, plus targeted cross-denies. This is NOT an exhaustive
    // 8x8 (72-pair) all-pairs claim; the chains and the ceiling carry the depth
    // proof.
    // No warmup, no retries: after scope-aware location readiness above, the FIRST
    // formal probe is build->design expected allow (design ordered first for
    // build). A deny there is a genuine blocker FAIL, recorded as-is (cause
    // unverified rather than skipped).
    const DENY_SELF_BUILD_UNKNOWN = ["architect", "build", UNKNOWN];
    for (const [caller, allows] of Object.entries(CONTRACT.edges)) {
      const ordered = caller === "build" ? ["design", ...allows.filter((t) => t !== "design")] : allows;
      const targets = [...new Set([...ordered, caller, ...DENY_SELF_BUILD_UNKNOWN])];
      for (const t of targets) {
        const want = allows.includes(t) ? "allow" : "deny";
        const got = await probe(caller, "subagent", t);
        check(`policy subagent ${caller} -> ${t}: ${want}`, got === want, `got=${got}`);
      }
    }
    // Cross-denies that pin the exact contract (spot checks beyond self/archived/unknown).
    for (const [caller, target] of [["plan", "plan"], ["design", "design"], ["design", "build"],
      ["engineer", "engineer"], ["engineer", "build"],
      ["research", "research"], ["research", "critic"],
      ["research", "plan"], ["research", "design"], ["research", "engineer"], ["research", "architect"], ["research", "general"],
      ["research", "build"], ["general", "engineer"], ["general", "explore"], ["explore", "engineer"], ["explore", "general"],
      ["critic", "engineer"], ["critic", "explore"], ["critic", "architect"]]) {
      const got = await probe(caller, "subagent", target);
      check(`policy subagent ${caller} -> ${target}: deny`, got === "deny", `got=${got}`);
    }
    // E (policy half): plan edit deny vs child-design edit allow; both read allow.
    // This checks effective policy only, NOT hard transitive readonly.
    const scopeAbs = path.join(WORKSPACE, "scope-note.txt");
    check("policy plan edit scope-note: deny (native builtin)", (await probe("plan", "edit", scopeAbs)) === "deny");
    check("policy design edit scope-note: allow (own perms, not inherited)", (await probe("design", "edit", scopeAbs)) === "allow");
    check("policy engineer edit scope-note: allow (execution role)", (await probe("engineer", "edit", scopeAbs)) === "allow");
    check("policy plan read scope-note: allow", (await probe("plan", "read", scopeAbs)) === "allow");
    check("policy design read scope-note: allow", (await probe("design", "read", scopeAbs)) === "allow");

    // Selector overrides must deny before AND after the verb, even if a broad
    // session-name wildcard otherwise absorbs the extra option. Policy-only:
    // no real browser sessions are opened, changed or closed by these probes.
    // Engineer CLI allowlists stay owned by its source role file (not asserted).
    for (const caller of ["research", "critic"]) {
      const prefix = `playwright-cli -s=${caller}-probe`;
      check(`policy ${caller} own-session close: allow`, (await probe(caller, "shell", `${prefix} close`)) === "allow");
      for (const tail of ["-s=other close", "-s other close", "close -s=other", "close -s other", "--session=other close", "close --session other"]) {
        check(`policy ${caller} selector override '${tail}': deny`, (await probe(caller, "shell", `${prefix} ${tail}`)) === "deny");
      }
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

    // Chain A (+C embedded, +E transmission half).
    const a = await runChain("build",
      `KSI-DELEG-A0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate down the allowed chain and return the leaf finding to Main.`,
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
      check("A native parentID chain is engineer->plan->research", JSON.stringify(agents.slice(0, 3)) === JSON.stringify(["engineer", "plan", "research"]), agents.join(">"));
    }
    const logA = reqLog();
    for (const mk of ["KSI-DELEG-A0", "KSI-DELEG-A1", "KSI-DELEG-A2", "KSI-DELEG-A3"]) {
      check(`A level ran natively (${mk} hit fixture)`, logA.some((r) => r.marker === mk && r.hasTools), `reqs=${logA.filter((r) => r.marker === mk).length}`);
    }
    // Result-return evidence: each parent's tool result input (logged toolMsgs)
    // carries the child's OK marker back up. Transmission only, not understanding.
    const blobsA = logA.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-A")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    for (const [parentMk, childOk] of [["KSI-DELEG-A0", "CHAIN-A-ENGINEER-OK"], ["KSI-DELEG-A1", "CHAIN-A-PLAN-OK"], ["KSI-DELEG-A2", "CHAIN-A-RESEARCH-LEAF-OK"]]) {
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
    // C: depth cap. Research(3) policy-ALLOWS explore, so only the ceiling guards.
    // Strict pass rule: when `subagent` is advertised at depth 3, ONLY the exact
    // Native ceiling error passes ("Subagent depth limit reached (3)" or an
    // equivalent structured typed depth error). When the catalog omits the tool,
    // ONLY a removed-tool rejection passes. Generic permission/network errors fail.
    const a3reqs = logA.filter((r) => r.marker === "KSI-DELEG-A3");
    const a3advertised = a3reqs.length ? (a3reqs[0].advertised ?? []) : [];
    const catalogOmits = a3reqs.length > 0 && !a3advertised.includes("subagent");
    note("C depth-3 advertised catalog", a3reqs.length === 0 ? "no A3 requests (chain stalled before depth 3)"
      : `subagent ${catalogOmits ? "omitted" : "advertised"} among [${a3advertised.slice(0, 14).join(",")}]`);
    const researchNodeId = chainA[3] ?? null;
    let forcedStatus = null, forcedErr = "";
    if (researchNodeId) {
      const rmsgs = requireDataArray(
        await mustApi("GET", `/api/session/${researchNodeId}/message?limit=100&order=asc`, undefined, "research child messages"),
        "research child messages",
      );
      const forced = toolEntries(rmsgs).find((t) => t.name === "subagent" && JSON.stringify(t.state?.input ?? {}).includes("explore"));
      forcedStatus = forced?.state?.status ?? null;
      forcedErr = forced?.state?.error?.message ?? "";
    }
    check(
      `C depth guard is the ceiling (${catalogOmits ? "removed-tool rejection" : "exact depth error"})`,
      researchNodeId !== null && forcedStatus === "error"
        && isDelegationCeilingError(forcedErr, { depth: CONTRACT.depth, toolAdvertised: !catalogOmits }),
      `status=${forcedStatus} err=${forcedErr.slice(0, 140)}`,
    );
    const depth4kids = researchNodeId ? await childrenOf(researchNodeId) : [];
    const noDepth4 = depth4kids.length === 0 && maxDepthA <= 3 && !blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED");
    check("C forced depth-4 attempt never succeeded (no session/text)", researchNodeId !== null && forcedStatus !== "completed" && !blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED"), `status=${forcedStatus}`);
    check("C no depth-4 child exists (native/API parentID walk)", noDepth4, researchNodeId === null ? "chain stalled before depth 3" : `maxDepth=${maxDepthA} kids=${depth4kids.length}`);
    if (maxDepthA > 3 || depth4kids.length > 0 || blobsA.includes("CHAIN-A-DEPTH4-UNEXPECTED")) {
      failClosed("C depth ceiling violated", `tree=${JSON.stringify(aDepths.map((d) => `${d.agent}@${d.depth}`))}`.slice(0, 300));
    }
    // Research->explore policy allow holds at depth 3 (guard is depth, not leaf-deny).
    check("C research->explore policy is allow (depth is the guard)", (await probe("research", "subagent", "explore")) === "allow");

    // Chain B: required Engineer path build->engineer->plan->explore (depth 3).
    steps.clear();
    const b = await runChain("build",
      `KSI-DELEG-B0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate via the engineer down to explore and return the finding to Main.`,
      "CHAIN-B-ROOT-OK", "chain-b");
    check("B root returns to Main (CHAIN-B-ROOT-OK)", assistantTexts(b.messages).includes("CHAIN-B-ROOT-OK"));
    {
      let cur = b.id, agents = [];
      for (let d = 0; d < 4; d++) {
        const kids = await childrenOf(cur);
        if (!kids.length) break;
        cur = kids[0].id ?? kids[0].sessionID;
        agents.push(kids[0].agent ?? null);
      }
      check("B native chain is engineer->plan->explore (required path)", JSON.stringify(agents.slice(0, 3)) === JSON.stringify(["engineer", "plan", "explore"]), agents.join(">"));
    }
    const logB = reqLog();
    const blobsB = logB.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-B")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("B leaf finding returns up (CHAIN-B-EXPLORE-LEAF-OK seen by parent)", blobsB.includes("CHAIN-B-EXPLORE-LEAF-OK"));
    check("B explore leaf read the scope note (stub read result returned)", blobsB.includes("SCOPE-NOTE-CONTENT"));

    // Chain D: Main as design calls critic directly (one path suffices; no all-roles chain).
    steps.clear();
    const d = await runChain("design",
      `KSI-DELEG-D0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Ask the critic for findings and return them to Main.`,
      "CHAIN-D-DESIGN-OK", "chain-d");
    check("D design-as-Main returns (CHAIN-D-DESIGN-OK)", assistantTexts(d.messages).includes("CHAIN-D-DESIGN-OK"));
    {
      const kids = await childrenOf(d.id);
      check("D design directly called critic (independent owner, single call)", kids.length === 1 && (kids[0].agent === "critic"), kids.map((k) => k.agent).join(","));
    }
    const logD = reqLog();
    const blobsD = logD.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-D")).flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("D critic findings return to design (CHAIN-D-CRITIC-LEAF-OK)", blobsD.includes("CHAIN-D-CRITIC-LEAF-OK"));

    // E (runtime half) + global guards: no product writes anywhere in A/B/D.
    const allCalls = reqLog().flatMap((r) => r.scriptCalls ?? []);
    check("E/no product writes: zero write/edit calls in chains A/B/D", !allCalls.includes("write") && !allCalls.includes("edit"), `calls=[${[...new Set(allCalls)].join(",")}]`);
    const wsFiles = fs.readdirSync(WORKSPACE).sort();
    check("E workspace holds only the scope probe (analysis-only kept)", JSON.stringify(wsFiles) === JSON.stringify(["scope-note.txt"]), wsFiles.join(","));

    // --- 6. F: real child write/edit attempts are denied natively. ---
    // One build root fans out to research/critic/plan; each child makes
    // one forced write and one forced edit against the private fixture file.
    // Stated limit: Design/General/Engineer are excluded (broad own permissions;
    // engineer execution is proven ALLOWED by chain N, so a plan deny does not
    // transitively inherit to them). No product writes are made to
    // succeed here; byte integrity is asserted, not assumed.
    const scopeHashBeforeF = sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8"));
    const f = await runChain("build",
      `KSI-DELEG-W0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the file-operation probe to each allowed read-only role in turn and return their exact outcomes to Main.`,
      "W-ROOT-OK", "chain-f");
    check("F root returns to Main (W-ROOT-OK)", assistantTexts(f.messages).includes("W-ROOT-OK"));
    const fKids = await childrenOf(f.id);
    check("F one owned child per probed role (no more, no less)",
      fKids.length === 3 && JSON.stringify(fKids.map((k) => k.agent).sort()) === JSON.stringify(["critic", "plan", "research"]),
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
    for (const [mk, role] of [["KSI-DELEG-W1", "research"], ["KSI-DELEG-W2", "critic"], ["KSI-DELEG-W3", "plan"]]) {
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
    for (const mk of ["KSI-DELEG-W1", "KSI-DELEG-W2", "KSI-DELEG-W3"]) {
      check(`F leaf outcome returned up (FW-LEAF-OK-${mk})`, blobsW0.includes(`FW-LEAF-OK-${mk}`));
    }
    check("F denied file never created", !fs.existsSync(path.join(WORKSPACE, DENIED_WRITE)));
    check("F fixture bytes unchanged (sha256 before/after)", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeF);

    // --- 7. G: continuity across parent turns via the owned child sessionID. ---
    // Mechanics only: the same Native child keeps both turns; markers prove what
    // traveled, never that any model judged or remembered anything by itself.
    const g1 = await runChain("build",
      `KSI-DELEG-G0 ${HANDOFF} ${ORIGIN} ${ORIGREQ} ${SCOPE_SENTENCE} Research the approved reference once and return the finding; a follow-up turn will resume your worker.`,
      "G0-ROOT-OK", "chain-g1");
    const gChildId = childIdFromParentMessages(g1.messages);
    check("G turn1 reports the owned childID in its Native tool result", typeof gChildId === "string" && gChildId.length > 0, gChildId ?? "none");
    const gKids1 = await childrenOf(g1.id);
    check("G turn1 owns exactly one research child", gKids1.length === 1 && gKids1[0].agent === "research" && gKids1[0].id === gChildId, gKids1.map((k) => `${k.agent}:${k.id}`).join(","));
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
    // The research child reads a file that does not exist: a real Native error,
    // returned as the child limit. The engineer then resumes THAT child with an
    // approved new reference and a different question. The script selects this
    // recovery path; nothing here evidences model initiative or hypothesis change.
    const h = await runChain("build",
      `KSI-DELEG-H0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Ask the engineer for H-evidence and return whatever comes back to Main.`,
      "H-ROOT-OK", "chain-h");
    check("H root returns to Main (H-ROOT-OK)", assistantTexts(h.messages).includes("H-ROOT-OK"));
    const hEngKids = await childrenOf(h.id);
    check("H build owns one engineer child", hEngKids.length === 1 && hEngKids[0].agent === "engineer", hEngKids.map((k) => k.agent).join(","));
    const hEng = hEngKids[0]?.id ?? null;
    const hResKids = hEng ? await childrenOf(hEng) : [];
    check("H engineer owns one research child (no silent fan-out)", hResKids.length === 1 && hResKids[0].agent === "research", hResKids.map((k) => k.agent).join(","));
    const hRes = hResKids[0]?.id ?? null;
    const hResMsgs = hRes ? requireDataArray(
      await mustApi("GET", `/api/session/${hRes}/message?limit=100&order=asc`, undefined, "H research child messages"),
      "H research child messages",
    ) : [];
    const missingReads = toolEntries(hResMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(MISSING_EVIDENCE));
    const missingErr = missingReads.length === 1 ? (missingReads[0].state?.error?.message ?? "") : "";
    check("H missing-file read fails once with a real Native file error",
      missingReads.length === 1 && missingReads[0].state?.status === "error" && /(no such file|not found|ENOENT|does not exist)/i.test(missingErr),
      `status=${missingReads[0]?.state?.status ?? "none"} err=${missingErr.slice(0, 140)}`);
    const missingAttempts = reqLog().filter((r) => r.marker === "KSI-DELEG-H2" && (r.scriptCalls ?? []).includes("read")
      && (r.scriptArgs ?? []).join(" ").includes(MISSING_EVIDENCE)).length;
    check("H same failing call never repeated (exactly one attempt)", missingAttempts === 1, `attempts=${missingAttempts}`);
    const hResBlob = JSON.stringify(hResMsgs);
    check("H same child holds both the failed and the recovery turn", hResBlob.includes("KSI-DELEG-H2R") && hResBlob.includes("H2-LIMITED-OK"));
    const hEngMsgs = hEng ? requireDataArray(
      await mustApi("GET", `/api/session/${hEng}/message?limit=100&order=asc`, undefined, "H engineer messages"),
      "H engineer messages",
    ) : [];
    const resumePart = toolEntries(hEngMsgs).find((t) => t.name === "subagent" && JSON.stringify(t.state?.input ?? {}).includes("KSI-DELEG-H2R"));
    check("H recovery resumed the same research childID (not a new session)",
      !!resumePart && resumePart.state?.input?.sessionID === hRes, `sessionID=${resumePart?.state?.input?.sessionID ?? "none"}`);
    const logH = reqLog();
    check("H child limit returned first (H2-LIMITED-OK seen by engineer)",
      logH.filter((r) => r.marker === "KSI-DELEG-H1").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("H2-LIMITED-OK"));
    // H bytes-vs-marker distinction: the resumed read is verified on H2R's OWN
    // Native session part (completed + output bytes); each hop up is verified on
    // that level's OWN tool inputs, never on a chain-wide blob. The stub embeds
    // only evidence sliced from the actual tool result it received.
    const hRecReads = toolEntries(hResMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE));
    const hRecBytes = hRecReads.length === 1 ? JSON.stringify(hRecReads[0].state?.content ?? hRecReads[0].state ?? "") : "";
    check("H resumed child completed a real read (Native part output bytes)",
      hRecReads.length === 1 && hRecReads[0].state?.status === "completed" && hRecBytes.includes("SCOPE-NOTE-CONTENT"),
      `status=${hRecReads[0]?.state?.status ?? "none"} bytes=${hRecBytes.length}`);
    const hReceived = (mk, child) => logH.filter((r) => r.marker === mk)
      .some((r) => (r.toolMsgs ?? []).some((text) => text.includes(child) && text.includes("SCOPE-NOTE-CONTENT")));
    check("H engineer received the recovered evidence (H2-RECOVERED-OK + bytes in H1 inputs)",
      hReceived("KSI-DELEG-H1", "H2-RECOVERED-OK"));
    check("H root received the recovered evidence (H1-ENGINEER-OK + bytes in H0 inputs)",
      hReceived("KSI-DELEG-H0", "H1-ENGINEER-OK"));
    check("H root returned the evidence to Main (H-ROOT-OK + bytes in root text)",
      assistantTexts(h.messages).includes("H-ROOT-OK") && assistantTexts(h.messages).includes("SCOPE-NOTE-CONTENT"));
    const hArgs = logH.filter((r) => (r.marker ?? "").startsWith("KSI-DELEG-H")).flatMap((r) => r.scriptArgs ?? []).join(" ");
    check("H no secret/absolute paths in recovery (approved refs only)", !hArgs.includes("..") && !/\s\/[a-z]/.test(hArgs) && !hArgs.includes("/tmp/") && !hArgs.includes("/home/"));
    check("H research created no deeper child", hRes ? (await childrenOf(hRes)).length === 0 : false);

    // --- 8b. J: engineer dev-unit mechanics via ONE owned general child. ---
    // Build0 -> Engineer1 -> General2 (real write+read of DEV_FILE); the
    // engineer then resumes the SAME general child for a repair follow-up
    // (J3: real edit+read). Task-local file only; the shared scope contract
    // stays read-only. Mechanics only, not model quality.
    steps.clear();
    const j = await runChain("build",
      `KSI-DELEG-J0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have the engineer implement the dev-unit task through one owned general worker and return its findings to Main.`,
      "J0-ROOT-OK", "chain-j");
    check("J root returns to Main (J0-ROOT-OK)", assistantTexts(j.messages).includes("J0-ROOT-OK"));
    const jEngKids = await childrenOf(j.id);
    check("J build owns one engineer child", jEngKids.length === 1 && jEngKids[0].agent === "engineer", jEngKids.map((k) => k.agent).join(","));
    const jEng = jEngKids[0]?.id ?? null;
    const jGenKids = jEng ? await childrenOf(jEng) : [];
    check("J engineer owns exactly one general child (no silent fan-out)",
      jGenKids.length === 1 && jGenKids[0].agent === "general", jGenKids.map((k) => k.agent).join(","));
    const jGen = jGenKids[0]?.id ?? null;
    const logJ = reqLog();
    const j1reqs = logJ.filter((r) => r.marker === "KSI-DELEG-J1");
    check("J engineer resumed the owned general childID (not a new session)",
      j1reqs.some((r) => (r.scriptArgs ?? []).join(" ").includes(jGen ?? "###")),
      `resumeCalls=${j1reqs.filter((r) => (r.scriptCalls ?? []).includes("subagent")).length}`);
    const jKidsAfter = jEng ? await childrenOf(jEng) : [];
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
    check("J engineer received the worker evidence (J2-GENERAL-OK in J1 inputs)",
      jReceived("KSI-DELEG-J1", "J2-GENERAL-OK"));
    check("J engineer received the repair evidence (J3-REPAIRED-OK in J1 inputs)",
      jReceived("KSI-DELEG-J1", "J3-REPAIRED-OK"));
    check("J engineer received the repaired bytes (in J1 inputs via J3 result)",
      logJ.filter((r) => r.marker === "KSI-DELEG-J1").flatMap((r) => r.toolMsgs ?? []).join("\n").includes(DEV_FIXED));
    check("J root received the dev-unit evidence (J1-ENGINEER-OK in J0 inputs)",
      jReceived("KSI-DELEG-J0", "J1-ENGINEER-OK"));
    // Root text carries the latest evidence slice (repaired bytes) plus the root
    // token; each hop's own tool inputs carry that level's receipt.
    // Markers verify transmission, never model understanding.
    check("J root returned the evidence to Main (J0-ROOT-OK + repaired bytes in root text)",
      assistantTexts(j.messages).includes("J0-ROOT-OK") && assistantTexts(j.messages).includes(DEV_FIXED));
    check("J repaired bytes reached the root inputs (DEV_FIXED in J0 inputs)",
      jReceived("KSI-DELEG-J0", DEV_FIXED));
    check("J general created no deeper child", jGen ? (await childrenOf(jGen)).length === 0 : false);

    // --- 8c. K: design-led small-UI unit via one owned general child. ---
    // Design0 (as Main) -> General1 (real write+read of its own UI fixture).
    // Build/read/write dynamics only; rendered real-UI acceptance stays
    // Main-owned browser evidence and is NOT asserted here.
    steps.clear();
    const k = await runChain("design",
      `KSI-DELEG-K0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have one owned general worker create the UI snippet file and return its exact read outcome to Main.`,
      "K0-DESIGN-OK", "chain-k");
    check("K design-as-Main returns (K0-DESIGN-OK)", assistantTexts(k.messages).includes("K0-DESIGN-OK"));
    const kKids = await childrenOf(k.id);
    check("K design owns one general child", kKids.length === 1 && kKids[0].agent === "general", kKids.map((x) => x.agent).join(","));
    const kGen = kKids[0]?.id ?? null;
    const kGenMsgs = kGen ? requireDataArray(
      await mustApi("GET", `/api/session/${kGen}/message?limit=100&order=asc`, undefined, "K owned general messages"),
      "K owned general messages",
    ) : [];
    const kWrites = toolEntries(kGenMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(UI_FILE));
    const kReads = toolEntries(kGenMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(UI_FILE));
    const kReadBytes = kReads.length === 1 ? JSON.stringify(kReads[0].state?.content ?? kReads[0].state ?? "") : "";
    check("K general completed the UI write (Native part, exactly once)",
      kWrites.length === 1 && kWrites[0].state?.status === "completed", `status=${kWrites[0]?.state?.status ?? "none"}`);
    check("K general completed the UI read with output bytes (Native part)",
      kReads.length === 1 && kReads[0].state?.status === "completed" && kReadBytes.includes(UI_LINE),
      `status=${kReads[0]?.state?.status ?? "none"} bytes=${kReadBytes.length}`);
    check("K UI file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, UI_FILE), "utf8") === `${UI_LINE}\n`);
    const logK = reqLog();
    check("K design received the UI evidence (K1-GENERAL-UI-OK + bytes in K0 inputs)",
      logK.filter((r) => r.marker === "KSI-DELEG-K0")
        .some((r) => (r.toolMsgs ?? []).some((text) => text.includes("K1-GENERAL-UI-OK") && text.includes(UI_LINE))));
    check("K general created no deeper child", kGen ? (await childrenOf(kGen)).length === 0 : false);

    // --- 8d. N: engineer execution proof (write+edit ALLOWED, byte-verified). ---
    // Counterpart to the F deny proofs for read-only roles: build -> engineer
    // performs one real write and one real edit, both completing natively.
    steps.clear();
    const n = await runChain("build",
      `KSI-DELEG-N0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Have the engineer perform the requested file operations once each and return the exact outcomes to Main.`,
      "N0-ROOT-OK", "chain-n");
    check("N root returns to Main (N0-ROOT-OK)", assistantTexts(n.messages).includes("N0-ROOT-OK"));
    const nKids = await childrenOf(n.id);
    check("N build owns one engineer child", nKids.length === 1 && nKids[0].agent === "engineer", nKids.map((x) => x.agent).join(","));
    const nEng = nKids[0]?.id ?? null;
    const nEngMsgs = nEng ? requireDataArray(
      await mustApi("GET", `/api/session/${nEng}/message?limit=100&order=asc`, undefined, "N engineer messages"),
      "N engineer messages",
    ) : [];
    const nWrites = toolEntries(nEngMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(ENG_FILE));
    const nEdits = toolEntries(nEngMsgs).filter((t) => t.name === "edit" && JSON.stringify(t.state?.input ?? {}).includes(ENG_FILE));
    check("N engineer completed the write (Native part, exactly once)",
      nWrites.length === 1 && nWrites[0].state?.status === "completed", `status=${nWrites[0]?.state?.status ?? "none"} err=${(nWrites[0]?.state?.error?.message ?? "").slice(0, 120)}`);
    check("N engineer completed the edit (Native part, exactly once)",
      nEdits.length === 1 && nEdits[0].state?.status === "completed", `status=${nEdits[0]?.state?.status ?? "none"} err=${(nEdits[0]?.state?.error?.message ?? "").slice(0, 120)}`);
    check("N engineer file holds the revised bytes", fs.readFileSync(path.join(WORKSPACE, ENG_FILE), "utf8") === `${ENG_FIXED}\n`);
    const logN = reqLog();
    check("N engineer outcome returned up (N1-ENGINEER-OK in N0 inputs)",
      logN.filter((r) => r.marker === "KSI-DELEG-N0").flatMap((r) => r.toolMsgs ?? []).join("\n").includes("N1-ENGINEER-OK"));
    check("N engineer created no deeper child", nEng ? (await childrenOf(nEng)).length === 0 : false);

    // --- 8e. L: parallel non-interference (one Build root, two concurrent children). ---
    // The root emits engineer + design subagent calls in ONE assistant response;
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
      `KSI-DELEG-L0 ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the two independent units concurrently — one to the engineer, one to design — and return both findings to Main.`,
      "L0-ROOT-OK", "chain-l");
    check("L root returns to Main (L0-ROOT-OK)", assistantTexts(l.messages).includes("L0-ROOT-OK"));
    const lKids = await childrenOf(l.id);
    check("L root owns exactly two children: engineer + design (single fan-out)",
      lKids.length === 2 && JSON.stringify(lKids.map((k) => k.agent).sort()) === JSON.stringify(["design", "engineer"]),
      lKids.map((k) => k.agent).join(","));
    const lEng = lKids.find((k) => k.agent === "engineer")?.id ?? null;
    const lDes = lKids.find((k) => k.agent === "design")?.id ?? null;
    const lEngMsgs = lEng ? requireDataArray(
      await mustApi("GET", `/api/session/${lEng}/message?limit=100&order=asc`, undefined, "L engineer messages"),
      "L engineer messages",
    ) : [];
    const lDesMsgs = lDes ? requireDataArray(
      await mustApi("GET", `/api/session/${lDes}/message?limit=100&order=asc`, undefined, "L design messages"),
      "L design messages",
    ) : [];
    const lEngWrites = toolEntries(lEngMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lEngReads = toolEntries(lEngMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lDesWrites = toolEntries(lDesMsgs).filter((t) => t.name === "write" && JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    const lDesReads = toolEntries(lDesMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    // Ownership isolation: neither child touches the other's file or the scope file.
    const lEngOff = toolEntries(lEngMsgs).filter((t) => ["write", "edit"].includes(t.name) && !JSON.stringify(t.state?.input ?? {}).includes(L_API_FILE));
    const lDesOff = toolEntries(lDesMsgs).filter((t) => ["write", "edit"].includes(t.name) && !JSON.stringify(t.state?.input ?? {}).includes(L_UI_FILE));
    check("L engineer completed write+read on its own file (own Native parts)",
      lEngWrites.length === 1 && lEngWrites[0].state?.status === "completed"
      && lEngReads.length === 1 && lEngReads[0].state?.status === "completed",
      `w=${lEngWrites[0]?.state?.status ?? "none"} r=${lEngReads[0]?.state?.status ?? "none"}`);
    check("L design completed write+read on its own file (own Native parts)",
      lDesWrites.length === 1 && lDesWrites[0].state?.status === "completed"
      && lDesReads.length === 1 && lDesReads[0].state?.status === "completed",
      `w=${lDesWrites[0]?.state?.status ?? "none"} r=${lDesReads[0]?.state?.status ?? "none"}`);
    const lEngReadBytes = lEngReads.length === 1 ? JSON.stringify(lEngReads[0].state?.content ?? lEngReads[0].state ?? "") : "";
    const lDesReadBytes = lDesReads.length === 1 ? JSON.stringify(lDesReads[0].state?.content ?? lDesReads[0].state ?? "") : "";
    check("L engineer read returned its own bytes (own Native part)",
      lEngReadBytes.includes(L_API_LINE), `bytes=${lEngReadBytes.length}`);
    check("L design read returned its own bytes (own Native part)",
      lDesReadBytes.includes(L_UI_LINE), `bytes=${lDesReadBytes.length}`);
    check("L engineer made no off-scope mutation", lEngOff.length === 0, `off=${lEngOff.length}`);
    check("L design made no off-scope mutation", lDesOff.length === 0, `off=${lDesOff.length}`);
    check("L engineer file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
    check("L design file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, L_UI_FILE), "utf8") === `${L_UI_LINE}\n`);
    check("L shared scope bytes unchanged (read-only conflict guard)",
      sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeL);
    // Both findings returned into the SAME parent turn (single-response fan-out,
    // not two sequential delegations).
    const logL = reqLog();
    const l0inputs = logL.filter((r) => r.marker === "KSI-DELEG-L0").flatMap((r) => r.toolMsgs ?? []).join("\n");
    check("L both child outcomes returned to the parent turn (L1 + L2 markers in L0 inputs)",
      l0inputs.includes("L1-ENGINEER-OK") && l0inputs.includes("L2-DESIGN-OK"));
    // Real overlap: wall-clock windows of the two branches' model requests
    // must intersect strictly. Serialized execution fails here honestly.
    const win = (mk) => logL.filter((r) => r.marker === mk && r.hasTools && typeof r.t === "number").map((r) => r.t).sort((a, b) => a - b);
    const wEng = win("KSI-DELEG-L1"), wDes = win("KSI-DELEG-L2");
    const overlap = wEng.length >= 2 && wDes.length >= 2 && wEng[0] < wDes[wDes.length - 1] && wDes[0] < wEng[wEng.length - 1];
    check("L engineer/design model-request windows overlap (real concurrency, not Promise.all only)",
      overlap, `eng=[${wEng.join(",")}] des=[${wDes.join(",")}]`);
    check("L children created no deeper level", lEng ? (await childrenOf(lEng)).length === 0 : false);
    check("L design created no deeper level", lDes ? (await childrenOf(lDes)).length === 0 : false);

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
      `KSI-DELEG-I0A ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Research the approved reference once under the current session rules and return the finding.`,
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
    // Turn B AFTER the patch: Build0->Engineer1->Design2->General3 (depth 3 max).
    const ibMsgs = await promptTurn(iRoot,
      `KSI-DELEG-I0B ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE} Delegate the analysis down the allowed chain under the current session rules and return the leaf finding to Main.`,
      "I-ROOT-OK", "chain-i0b");
    check("I turn B returns to Main (I-ROOT-OK)", assistantTexts(ibMsgs).includes("I-ROOT-OK"));
    const iTree = await treeFrom(iRoot);
    const iMaxDepth = Math.max(...[...iTree.values()].map((v) => v.depth));
    check("I chain respects the depth ceiling (max 3 from root 0)", iMaxDepth <= 3, `maxDepth=${iMaxDepth}`);
    // Identify the turn-B plan child by its prompt (a pre-patch plan child exists).
    const iPostKids = await childrenOf(iRoot);
    let iPlan = null;
    for (const k of iPostKids) {
      if (k.agent !== "engineer" || k.id === iPre) continue;
      const km = requireDataArray(
        await mustApi("GET", `/api/session/${k.id}/message?limit=20&order=asc`, undefined, "I engineer child identify"),
        "I engineer child identify",
      );
      if (JSON.stringify(km).includes("KSI-DELEG-I1B")) { iPlan = k.id; break; }
    }
    check("I turn-B engineer child identified (distinct from pre-patch child)", typeof iPlan === "string" && iPlan !== iPre, iPlan ?? "none");
    const iDesignKids = iPlan ? await childrenOf(iPlan) : [];
    const iDesign = iDesignKids.length === 1 && iDesignKids[0].agent === "design" ? iDesignKids[0].id : null;
    check("I engineer owns one design child", typeof iDesign === "string", iDesign ?? "none");
    const iGenKids = iDesign ? await childrenOf(iDesign) : [];
    const iGen = iGenKids.length === 1 && iGenKids[0].agent === "general" ? iGenKids[0].id : null;
    check("I design owns one general leaf (depth 3, no fourth level)", typeof iGen === "string", iGen ?? "none");
    check("I general leaf created no deeper child", iGen ? (await childrenOf(iGen)).length === 0 : false);
    // Every post-patch descendant carries the FULL post-patch snapshot: deep-equal
    // against the actual root-after GET array (preserved above) and against the
    // exact expected ordered rules, so added/reordered rules cannot hide.
    const I_EXPECTED_AFTER = [I_RETAINED, ...I_APPENDED];
    for (const [label, sid] of [["engineer", iPlan], ["design", iDesign], ["general", iGen]]) {
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
    check("I design received the leaf evidence (I3-GENERAL-OK + bytes in I2 inputs)",
      iReceived("KSI-DELEG-I2", "I3-GENERAL-OK"));
    check("I engineer received the evidence (I2-DESIGN-OK + bytes in I1B inputs)",
      iReceived("KSI-DELEG-I1B", "I2-DESIGN-OK"));
    check("I root received the evidence (I1B-ENGINEER-OK + bytes in I0B inputs)",
      iReceived("KSI-DELEG-I0B", "I1B-ENGINEER-OK"));
    check("I root returned the evidence to Main (I-ROOT-OK + bytes in root text)",
      assistantTexts(ibMsgs).includes("I-ROOT-OK") && assistantTexts(ibMsgs).includes("SCOPE-NOTE-CONTENT"));
    check("I turn-B branch children are free of pre-patch results (own histories only)", await (async () => {
      // Separation belongs to the CHILD sessions (fresh histories starting at
      // I1B): the resumed ROOT legitimately retains turn-A tool results in its
      // request history (Native continuity, same as G proves desirable), so the
      // root blob is the wrong place to demand amnesia.
      for (const [label, sid, own] of [["engineer", iPlan, "KSI-DELEG-I1B"], ["design", iDesign, "KSI-DELEG-I2"], ["general", iGen, "KSI-DELEG-I3"]]) {
        if (typeof sid !== "string") return false;
        const cm = JSON.stringify(requireDataArray(
          await mustApi("GET", `/api/session/${sid}/message?limit=100&order=asc`, undefined, `I turn-B ${label} history`),
          `I turn-B ${label} history`,
        ));
        if (!cm.includes(own) || cm.includes("KSI-DELEG-I1A")) return false;
      }
      return true;
    })());
    check("I chain results returned up (I1B-ENGINEER-OK -> I2-DESIGN-OK -> I3-GENERAL-OK)",
      blobsI.includes("I1B-ENGINEER-OK") && blobsI.includes("I2-DESIGN-OK") && blobsI.includes("I3-GENERAL-OK"));

    // Final guards across F/G/H/I/J/K/N/L: still analysis-only, still the same bytes.
    // J/K/N/L own exactly their separate task-local files; the shared scope
    // contract file is read-only everywhere (F proves the deny side, L the
    // parallel non-interference side).
    const wsFilesEnd = fs.readdirSync(WORKSPACE).sort();
    check("final workspace holds only the scope probe plus J/K/N/L task-local files",
      JSON.stringify(wsFilesEnd) === JSON.stringify([DEV_FILE, ENG_FILE, L_API_FILE, L_UI_FILE, SCOPE_FILE, UI_FILE]), wsFilesEnd.join(","));
    check("final fixture bytes unchanged since F", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === scopeHashBeforeF);
    check("final dev-unit bytes are the repaired version", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);
    check("final UI bytes are the written snippet", fs.readFileSync(path.join(WORKSPACE, UI_FILE), "utf8") === `${UI_LINE}\n`);
    check("final engineer bytes are the revised probe", fs.readFileSync(path.join(WORKSPACE, ENG_FILE), "utf8") === `${ENG_FIXED}\n`);
    check("final parallel API bytes are the engineer unit", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
    check("final parallel UI bytes are the design unit", fs.readFileSync(path.join(WORKSPACE, L_UI_FILE), "utf8") === `${L_UI_LINE}\n`);

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
