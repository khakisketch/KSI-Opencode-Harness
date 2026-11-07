// Delegation native integration test: depth-1 dynamic delegation on real OpenCode v2 CLI.
//
// Spins up, in a private HOME/XDG sandbox:
//   1. a local scripted OpenAI-compatible model server (no external models/credentials),
//   2. `opencode serve` on an isolated loopback port with a sandbox config that is
//      COPIED from the current repo source (global/opencode.jsonc; there are no
//      custom operating files anymore) with ONLY these mechanical transforms,
//      all inside the sandbox:
//        - configured models -> loopback fixture model (portable source pins
//          none, so the sandbox assigns the fixture model; unconfigured General
//          inherits its actual parent),
//        - providers reduced to the scripted `fixture` provider only,
//        - `mcp` section removed (no remote URLs / credential references),
//        - no top-level permission widening, no invented config keys.
//
// Contract under test (depth 1, root = 0; Build is the sole development owner):
//   Five operating profiles: build (primary), plan (all, optional consultation),
//   general/explore (subagent leaves) and design (all, advisory-only review
//   leaf). No intermediate owner. Build fans out to Plan/General/Explore/
//   Design directly; children never delegate. Plan keeps its Explore-only edge
//   for root-level use; as a depth-1 child the Native depth guard — not
//   policy — stops any Plan->Explore attempt.
//
// The scripted model drives REAL native `subagent` tool calls through representative
// runtime chains (script markers in Native tool I/O only verify delegation mechanics;
// they say nothing about model quality):
//   P  build(0) -> plan(1, analysis only, ZERO subagent calls)   (optional direct
//      Plan consultation: result returned to Main, never a required stage)
//   C  build(0) -> plan(1) -> explore(2) ATTEMPTED and refused by the depth guard
//      (no depth-2 child may be created; the tool must be advertised yet fail
//      closed with a depth error — this is the depth-1 contract proof)
//   D  build(0) -> general(1, write+read unit file, then SAME child resumed for
//      repair)   (Build-owned worker: real write/test/follow-up repair via one
//      owned general child; completion returns to Main)
//   M  build(0) -> general(1, two files write+read)   (positive Build-direct
//      General multi-file task execution)
//   T  build(0) direct write+edit+read, ZERO subagent calls   (Build whole-task
//      execution without children)
//   V  fresh uninvolved restricted General (explicit edit+shell session denies,
//      created outside the unit tree) reviews the completed unit: forced write
//      fails closed with bytes unchanged, findings returned. Mechanics proof
//      for the OPTIONAL restricted-verification capability only.
//   E  policy probes per caller (NOT a proof of hard transitive readonly),
//      handoff-scope marker transmission, zero product writes in the
//      analysis-only chains, results returned to Main.
//   F  real child write/edit denial: forced scripted write+edit attempts by
//      plan/explore sessions on the private fixture file end in Native error
//      (deny-shaped), with byte-level file integrity.
//   G  session continuity: root turn1/turn2 reuses the owned child via its Native
//      subagent sessionID; same childID, past messages kept, original requirement
//      plus new scope delivered, new result returned. Mechanics only.
//   H  failure -> new evidence -> resume & recover: a missing-file read fails with
//      a real Native error, the child returns its limit, then the SAME child
//      sessionID is resumed with an approved new reference and a different
//      question; the same failing call is never repeated. Mechanics/scope/evidence
//      plumbing only, NOT model initiative or judgment.
//   I  explicit session-scoped restrictions inherit to later-created children:
//      an I0A control root (unrestricted) and an I0B restricted root (edit+shell
//      denies) each fan out to Plan/General siblings; reads succeed everywhere
//      while writes/edits fail closed under the inherited snapshot, even for
//      the broad General executor.
//   L  build(0) -> general(1) + explore(1) in ONE response (parallel
//      non-interference: general writes its own task-local file while explore
//      reads the shared scope; shared scope stays read-only; wall-clock request
//      overlap required, serialization fails as NOT PROVEN)
//   X  retired-target fresh-call exclusion at REAL call time from the build
//      root. Removed engineer/lead must fail closed (agent-not-found or
//      denial) and create no child session. A depth-1 plan child would hit
//      the depth guard first, which chain C already proves separately.
// J/M/T/D/V/L task-local files are SEPARATE plus the shared read-only scope
// contract; no user projects/services are touched. This bound integration proves
// delegation mechanics only, not a workflow engine, real model quality, rendered
// UI acceptance (Main-owned browser evidence), or concurrency beyond the stated
// chains. Modes/models/prompts come from the location-scoped /api/agent catalog,
// not from session.create echoes.
//
// Run:  node tests/delegation-native-integration.mjs
// Env:  KSI_HARNESS_ROOT (artifact parent; a unique directory is created, never erased)
//       KSI_MODEL_PORT / KSI_SERVE_PORT (defaults 41951/41952; auto-bumped if busy)
//       OPENCODE_BIN (default opencode)
// Fails closed with CONTRACT-NOT-READY when the repo source does not yet declare the
// depth-1 / four-profile contract; it never weakens permissions or falls back to interim
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

// Contract under test (depth 1, root = 0; a max allowance, not a mandatory tree).
// Five operating profiles: build (primary), plan (all, optional consultation),
// general/explore (subagent leaves), design (all, review-only leaf). The Lead
// role and the four superseded
// specialists were REMOVED with user approval (last-approved contents survive
// only in private backups): they appear in NO edge list and in NO catalog;
// every live caller must deny them (or fail closed on real calls), and no
// phantom registration may exist. Architect is physically archived at
// docs/archive/agents/architect.md (out of discovery) and appears in NO edge
// list either.
const CONTRACT = {
  depth: 1,
  modes: {
    plan: "all", design: "all",
    general: "subagent", explore: "subagent",
  },
  edges: {
    build: ["plan", "general", "explore", "design"],
    plan: ["explore"],
    general: [], explore: [], design: [],
  },
};
const RETIRED_IDS = ["engineer", "research", "critic", "lead"];
const RETIRED_ALIASES = ["architect", "design-specialist", "design-architect", "ux-scout", "ui-ux-critic", "product-reviewer"];
const HANDOFF = "HANDOFF-SCOPE-ANALYSIS-ONLY-KSI-DELEG";
const ORIGIN = "ORIG-CONTRACT-KSI-DELEG-V1";
const SCOPE_SENTENCE = "Scope is analysis-only handoff; do not write product files.";
// Scope-note markers. Transmission only: their presence in tool I/O proves a handoff
// traveled, never that any model understood, judged, or chose anything.
const MISSING_EVIDENCE = "missing-evidence-H.txt";
const DENIED_WRITE = "denied-note.txt";
const SCOPE_FILE = "scope-note.txt";
const SCOPE_LINE = "SCOPE-NOTE-CONTENT analysis handoff probe";
// Task-local fixtures: SEPARATE files per unit in the same workspace, sharing
// only the read-only scope contract above. No user projects/services.
// D: Build-owned general unit with NO independent review (write+read of its own
// file, then same-child repair; completion with exactly the owned chain is the
// positive no-review path).
const DEV_FILE = "dev-unit.txt";
const DEV_LINE = "DEV-UNIT-CONTENT initial implementation";
const DEV_FIXED = "DEV-UNIT-CONTENT repaired implementation";
// M: build-direct general multi-file task (two separate files, write+read each).
const DIRECT_A_FILE = "direct-a.txt";
const DIRECT_A_LINE = "DIRECT-A-CONTENT build-direct general unit";
const DIRECT_B_FILE = "direct-b.css";
const DIRECT_B_LINE = ".direct-b { color: olive; }";
// T: build direct execution with ZERO subagent calls (write+edit+read ALLOWED,
// byte-verified).
const BUILD_DIRECT_FILE = "build-direct.txt";
const BUILD_DIRECT_LINE = "BUILD-DIRECT-CONTENT initial";
const BUILD_DIRECT_FIXED = "BUILD-DIRECT-CONTENT revised";
// V: chosen optional restricted verification. The fresh restricted General may
// attempt this note exactly once; it must never be created.
const REVIEW_NOTE = "review-note.txt";
// L: parallel non-interference. One build root fans out to general + explore in
// a SINGLE assistant response; general writes ONLY its own task-local file
// while explore only reads the shared scope. The shared scope stays read-only
// (hash-guarded).
const L_API_FILE = "parallel-api.txt";
const L_API_LINE = "PARALLEL-API-CONTENT general unit";

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
    const ch = src[i], nx = src[i + 1];
    if (s) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) { out += nx; i += 2; continue; }
      if (ch === s) s = null;
      i++; continue;
    }
    if (ch === '"' || ch === "'") { s = ch; out += ch; i++; continue; }
    if (ch === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (ch === "/" && nx === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2; continue;
    }
    out += ch; i++;
  }
  return out;
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
function parseSubagentSessionIDs(text) {
  return [...(String(text ?? "").matchAll(/\bses_[A-Za-z0-9]+\b/g))].map((m) => m[0]);
}
function lastSessionId(texts) {
  const ids = parseSubagentSessionIDs((Array.isArray(texts) ? texts : [texts]).join("\n"));
  return ids.length ? ids[ids.length - 1] : null;
}
// Short evidence excerpt sliced from an ACTUAL Native tool-result payload (never
// synthesized: null when the payload carries no evidence bytes, which then fails
// the per-level bytes assertions honestly).
function extractEvidenceSnippet(toolMsgs) {
  const joined = (Array.isArray(toolMsgs) ? toolMsgs : [toolMsgs]).join("\n");
  const all = [...joined.matchAll(/SCOPE-NOTE-CONTENT[^\n"\\]{0,48}|DEV-UNIT-CONTENT[^\n"\\]{0,48}|DIRECT-A-CONTENT[^\n"\\]{0,48}|BUILD-DIRECT-CONTENT[^\n"\\]{0,48}|\.direct-b[^\n"\\]{0,48}|PARALLEL-API-CONTENT[^\n"\\]{0,48}/g)];
  return all.length ? all[all.length - 1][0] : null;
}
function evidenceSuffix(toolMsgs) {
  return `EVID:${extractEvidenceSnippet(toolMsgs) ?? "NO-EVIDENCE-IN-RESULT"}`;
}
function evidenceMatch(toolMsgs, re) {
  const joined = (Array.isArray(toolMsgs) ? toolMsgs : [toolMsgs]).join("\n");
  const m = joined.match(re);
  return m ? m[0] : "NO-EVIDENCE-IN-RESULT";
}
// Step counters advance ONLY on tool-carrying requests, so title/summary/text-only
// calls that echo transcript markers never consume a script step.
const steps = new Map();
function chainMarker(text) {
  // Most-specific first: resumed sessions carry both the old and the new prompt
  // in user history. Marker-naming ban: no marker may be a substring of
  // HANDOFF/ORIGIN/SCOPE.
  for (const mk of ["KSI-DELEG-P1", "KSI-DELEG-P0",
    "KSI-DELEG-C1", "KSI-DELEG-C0",
    "KSI-DELEG-D2", "KSI-DELEG-D1", "KSI-DELEG-D0",
    "KSI-DELEG-M1", "KSI-DELEG-M0", "KSI-DIRECT-ROOT",
    "KSI-DELEG-X0",
    "KSI-DELEG-R1", "KSI-DELEG-R0",
    "KSI-DELEG-L2", "KSI-DELEG-L1", "KSI-DELEG-L0",
    "KSI-DELEG-VR",
    "KSI-DELEG-H2", "KSI-DELEG-H1", "KSI-DELEG-H0",
    "KSI-DELEG-G2", "KSI-DELEG-G1", "KSI-DELEG-G0",
    "KSI-DELEG-I0B", "KSI-DELEG-I0A", "KSI-DELEG-I1A", "KSI-DELEG-I2", "KSI-DELEG-I3",
    "KSI-DELEG-F2", "KSI-DELEG-F1"]) {
    if (text.includes(mk)) return mk;
  }
  return null;
}
const subPrompt = (marker, extra = "") => `${marker} ${HANDOFF} ${ORIGIN} ${SCOPE_SENTENCE}${extra ? ` ${extra}` : ""}`;
function scriptFor(marker, advertised, { allUser, toolMsgs }) {
  currentMarker = marker;
  const has = (name) => (advertised ?? []).includes(name);
  // A refused mutation surfaces as a tool error, a policy denial, the tool
  // missing from the advertised list entirely (strongest form: unadvertised),
  // or a sandbox-boundary refusal ("Cannot use X to modify files outside...").
  const deniedIn = (msgs) => /"status"\s*:\s*"error"|denied|not permitted|not allowed|no tool named|cannot use \w+ to modify|outside the \S+ directory/i.test((Array.isArray(msgs) ? msgs : [msgs]).join("\n"));
  // P: Build->Plan direct consultation. Plan reads the scope and returns an
  // analysis; it places no subagent calls of its own.
  if (marker === "KSI-DELEG-P0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "plan", description: `analysis ${marker}`, prompt: subPrompt("KSI-DELEG-P1", "Analyze the scope contract and return a short work plan as text. Place no subagent calls.") } }],
      };
    }
    return { kind: "text", text: `P0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-P1") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `NO-READ-ADVERTISED-${marker}` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `P1-PLAN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // C: depth-ceiling proof. The plan child attempts a real subagent->explore
  // call; the Native depth guard must reject it and create no depth-2 child.
  if (marker === "KSI-DELEG-C0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "plan", description: `ceiling probe ${marker}`, prompt: subPrompt("KSI-DELEG-C1", "Place exactly one subagent call to explore and report the exact tool outcome back to Main.") } }],
      };
    }
    return { kind: "text", text: `C0-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-C1") {
    if (stepIs(0)) {
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "explore", description: `ceiling probe ${marker}`, prompt: "This delegated call must be refused by the depth guard; report only." } }],
      };
    }
    return { kind: "text", text: `C1-CEILING-OK ${HANDOFF} ${ORIGIN} ERR:${JSON.stringify(toolMsgs).slice(0, 400)}` };
  }
  // D: Build-owned general unit with same-child repair. D0 (build) -> D1
  // (general: write+read), then the SAME child is resumed for repair.
  if (marker === "KSI-DELEG-D0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `unit worker ${marker}`, prompt: subPrompt("KSI-DELEG-D1", "Write the dev-unit file, read it back, and return the exact read outcome as text.") } }],
      };
    }
    return { kind: "text", text: `D0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-D1") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DEV_FILE, content: `${DEV_LINE}\n` } }] };
    }
    if (stepIs(1)) {
      if (!has("read")) return { kind: "text", text: `D1-UNIT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DEV_FILE } }] };
    }
    return { kind: "text", text: `D1-UNIT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-D2") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: DEV_FILE, oldString: DEV_LINE, newString: DEV_FIXED } }] };
    }
    if (stepIs(1)) {
      if (!has("read")) return { kind: "text", text: `D2-REPAIRED-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DEV_FILE } }] };
    }
    return { kind: "text", text: `D2-REPAIRED-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // M: Build-direct general multi-file task (no consultation stage).
  if (marker === "KSI-DELEG-M0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `direct worker ${marker}`, prompt: subPrompt("KSI-DELEG-M1", "Write both unit files, read them back, and return the exact read outcomes as text.") } }],
      };
    }
    return { kind: "text", text: `M0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-M1") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DIRECT_A_FILE, content: `${DIRECT_A_LINE}\n` } }] };
    }
    if (stepIs(1)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DIRECT_B_FILE, content: `${DIRECT_B_LINE}\n` } }] };
    }
    if (stepIs(2)) {
      if (!has("read")) return { kind: "text", text: `M1-UNIT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DIRECT_A_FILE } }] };
    }
    if (stepIs(3)) {
      return { kind: "tools", calls: [{ name: "read", args: { path: DIRECT_B_FILE } }] };
    }
    return { kind: "text", text: `M1-UNIT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // T: Build direct execution with ZERO subagent calls (the KSI-DIRECT-ROOT
  // marker runs at the build root itself).
  if (marker === "KSI-DIRECT-ROOT") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: BUILD_DIRECT_FILE, content: `${BUILD_DIRECT_LINE}\n` } }] };
    }
    if (stepIs(1)) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: BUILD_DIRECT_FILE, oldString: BUILD_DIRECT_LINE, newString: BUILD_DIRECT_FIXED } }] };
    }
    if (stepIs(2)) {
      if (!has("read")) return { kind: "text", text: `T0-DONE-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: BUILD_DIRECT_FILE } }] };
    }
    return { kind: "text", text: `T0-DONE-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // X: retired-target fresh-call exclusion at REAL call time from the build
  // root (depth 0 can call; a depth-1 plan child would hit the depth guard
  // first, which chain C already proves). Removed engineer/lead must fail
  // closed with agent-not-found (or a denial) and create no child session.
  if (marker === "KSI-DELEG-X0") {
    if (stepIs(0)) {
      return {
        kind: "tools",
        calls: ["engineer", "lead"].map(agent => ({ name: "subagent", args: { agent, description: `exclusion probe ${agent}`, prompt: "This delegated call must not exist; report only." } })),
      };
    }
    return { kind: "text", text: `CHAIN-X-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // R: reserved marker alias for the restricted-verification follow-up; the
  // V chain below carries the actual verification mechanics.
  if (marker === "KSI-DELEG-R0" || marker === "KSI-DELEG-R1") {
    return { kind: "text", text: `R-RESERVED-OK ${HANDOFF} ${ORIGIN}` };
  }
  // V: restricted General reviews the completed unit, attempts the review-note
  // write exactly once, then reports findings with the exact write outcome.
  if (marker === "KSI-DELEG-VR") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `VR-NO-READ ${HANDOFF} ${ORIGIN}` };
      return { kind: "tools", calls: [{ name: "read", args: { path: DEV_FILE } }] };
    }
    if (stepIs(1)) {
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    if (stepIs(2)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: REVIEW_NOTE, content: "restricted review note attempt\n" } }] };
    }
    const ok = deniedIn(toolMsgs);
    return { kind: "text", text: `VR-${ok ? "DENIED-OK" : "UNEXPECTED-SUCCESS"} ${HANDOFF} ${ORIGIN}` };
  }
  // L: parallel fan-out. L0 (build) emits general + explore calls in ONE
  // response; L1 (general) writes+reads its own file while L2 (explore) only
  // reads the shared scope.
  if (marker === "KSI-DELEG-L0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [
          { name: "subagent", args: { agent: "general", description: `parallel worker ${marker}`, prompt: subPrompt("KSI-DELEG-L1", "Write the parallel API file once, read it back, and report the exact read outcome as text.") } },
          { name: "subagent", args: { agent: "explore", description: `parallel reader ${marker}`, prompt: subPrompt("KSI-DELEG-L2", "Read the shared scope note and report its exact bytes as text. Write nothing.") } },
        ],
      };
    }
    return { kind: "text", text: `L0-DONE-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-L1") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: L_API_FILE, content: `${L_API_LINE}\n` } }] };
    }
    if (stepIs(1)) {
      if (!has("read")) return { kind: "text", text: `L1-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: L_API_FILE } }] };
    }
    return { kind: "text", text: `L1-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-L2") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `L2-EXPLORE-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `L2-EXPLORE-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // H: missing-file failure, then same-child resume with a new reference.
  if (marker === "KSI-DELEG-H0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `recovery worker ${marker}`, prompt: subPrompt("KSI-DELEG-H1", "Read the evidence file and report its exact bytes. If it cannot be read, return your limit instead of inventing bytes.") } }],
      };
    }
    return { kind: "text", text: `H0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-H1") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `H1-LIMITED-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: MISSING_EVIDENCE } }] };
    }
    return { kind: "text", text: `H1-LIMITED-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-H2") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `H2-RECOVERED-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `H2-RECOVERED-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // G: same-child continuity across two turns.
  if (marker === "KSI-DELEG-G0") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "general", description: `continuity worker ${marker}`, prompt: subPrompt("KSI-DELEG-G1", "Read the scope note and report its exact bytes as text.") } }],
      };
    }
    return { kind: "text", text: `G0-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-G1") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `G1-RESULT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `G1-RESULT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-G2") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `G2-RESULT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `G2-RESULT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // I: restriction inheritance. I0A is the unrestricted control root;
  // I0B is created with edit+shell denies and fans out to Plan (I2) and
  // General (I3) siblings under the inherited snapshot.
  if (marker === "KSI-DELEG-I0A") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [{ name: "subagent", args: { agent: "plan", description: `control ${marker}`, prompt: subPrompt("KSI-DELEG-I1A") } }],
      };
    }
    return { kind: "text", text: `I0A-ROOT-OK ${HANDOFF} ${ORIGIN}` };
  }
  if (marker === "KSI-DELEG-I0B") {
    if (stepIs(0)) {
      if (!has("subagent")) return { kind: "text", text: `NO-SUBAGENT-ADVERTISED-${marker}` };
      return {
        kind: "tools",
        calls: [
          { name: "subagent", args: { agent: "plan", description: `restricted analysis ${marker}`, prompt: subPrompt("KSI-DELEG-I2") } },
          { name: "subagent", args: { agent: "general", description: `restricted worker ${marker}`, prompt: subPrompt("KSI-DELEG-I3") } },
        ],
      };
    }
    return { kind: "text", text: `I-ROOT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I1A") {
    if (stepIs(0)) {
      if (!has("read")) return { kind: "text", text: `I1A-RESULT-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `I1A-RESULT-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I2") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `I2-PLAN-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  if (marker === "KSI-DELEG-I3") {
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: DENIED_WRITE, content: "mutation attempt, must be denied\n" } }] };
    }
    if (stepIs(1)) {
      return { kind: "tools", calls: [{ name: "edit", args: { path: SCOPE_FILE, oldString: SCOPE_LINE, newString: `${SCOPE_LINE}-MUTATION-ATTEMPT` } }] };
    }
    if (stepIs(2)) {
      if (!has("read")) return { kind: "text", text: `I3-GENERAL-OK ${HANDOFF} ${ORIGIN} NO-READ-ADVERTISED` };
      return { kind: "tools", calls: [{ name: "read", args: { path: SCOPE_FILE } }] };
    }
    return { kind: "text", text: `I3-GENERAL-OK ${HANDOFF} ${ORIGIN} ${evidenceSuffix(toolMsgs)}` };
  }
  // F: forced write/edit attempts by plan (F1) and explore (F2) sessions end
  // in Native deny errors; outcomes are reported, never faked into success.
  if (marker === "KSI-DELEG-F1" || marker === "KSI-DELEG-F2") {
    const target = marker === "KSI-DELEG-F1" ? SCOPE_FILE : DENIED_WRITE;
    if (stepIs(0)) {
      return { kind: "tools", calls: [{ name: "write", args: { path: target, content: "forced attempt, must be denied\n" } }] };
    }
    if (stepIs(1) && marker === "KSI-DELEG-F1") {
      return { kind: "tools", calls: [{ name: "edit", args: { path: SCOPE_FILE, oldString: SCOPE_LINE, newString: `${SCOPE_LINE}-FORCED` } }] };
    }
    const ok = deniedIn(toolMsgs);
    return { kind: "text", text: `${marker === "KSI-DELEG-F1" ? "F1" : "F2"}-${ok ? "DENIED-OK" : "UNEXPECTED-SUCCESS"} ${HANDOFF} ${ORIGIN}` };
  }
  return { kind: "text", text: "ok" };
}
let currentMarker = null;
function stepIs(n) {
  return (steps.get(currentMarker) ?? 0) === n;
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
              steps.set(marker, (steps.get(marker) ?? 0) + 1);
            }
          }
          try {
            fs.appendFileSync(path.join(ROOT, "fake-model-requests.jsonl"), JSON.stringify({
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
              res.end("data: [DONE]\n\n");
              return;
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(jsonBody));
          };
          if (script.kind === "text") {
            const msg = { role: "assistant", content: script.text };
            finishWith(
              [chunk(id, "fixture", { role: "assistant", content: script.text }, null), chunk(id, "fixture", {}, "stop")],
              { id, object: "chat.completion", model: "fixture", choices: [{ index: 0, message: msg, finish_reason: "stop" }] },
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
            id, object: "chat.completion", model: "fixture",
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

  // --- 1. Source contract (no models pinned; four profiles; depth 1). ---
  let srcCfg;
  try {
    srcCfg = JSON.parse(stripJsonc(fs.readFileSync(SRC_JSONC, "utf8")));
  } catch (e) {
    failClosed("CONTRACT-NOT-READY: source opencode.jsonc unreadable", String(e).slice(0, 160));
    return void finish();
  }
  if (srcCfg?.experimental?.subagent_depth !== CONTRACT.depth) {
    failClosed("CONTRACT-NOT-READY: experimental.subagent_depth != 1 in source", `found=${srcCfg?.experimental?.subagent_depth}`);
    return void finish();
  }
  check("source declares experimental.subagent_depth == 1", true);
  const srcAgents = srcCfg.agents ?? {};
  for (const id of ["build", "plan"]) {
    if (!srcAgents[id]) {
      failClosed("CONTRACT-NOT-READY: source agents missing", id);
      return void finish();
    }
  }
  check("source carries the two configured roles (build, plan)", true);
  // Authorized removal: lead plus the four superseded operating files must be
  // ABSENT from source and install (last-approved contents survive only in
  // private backups — receipted in the sandbox manifest below, never
  // re-required on disk).
  let removedOk = true;
  for (const id of RETIRED_IDS) {
    if (Object.hasOwn(srcAgents, id) || fs.existsSync(path.join(SRC_AGENTS, `${id}.md`))) { removedOk = false; }
  }
  check("source carries no removed role definitions (engineer/design/research/critic/lead)", removedOk);
  if (!removedOk) { failClosed("CONTRACT-MISMATCH: removed role definitions present", RETIRED_IDS.join(",")); return void finish(); }
  check("source declares no retired files on disk", true);
  // Exact edge contract from source JSON agents.
  let edgesOk = true;
  const edgeDetail = [];
  for (const [caller, want] of Object.entries(CONTRACT.edges)) {
    const rules = srcAgents[caller]?.permissions ?? null;
    const got = rules ? subagentAllows(rules) : [];
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) { edgesOk = false; edgeDetail.push(`${caller}:[${got}]`); }
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
  check("source declares exact delegation edges", edgesOk, edgeDetail.join(" ") || "all 4 profiles match");
  if (!edgesOk) { failClosed("CONTRACT-MISMATCH: refusing to weaken edges", edgeDetail.join("; ").slice(0, 300)); return void finish(); }
  // Portable source pins no models: build/plan/general/explore and top-level
  // must all be unconfigured. Model choice is local per docs/development.md.
  const modelsOk = srcCfg.model === undefined && srcAgents.build?.model === undefined
    && srcAgents.plan?.model === undefined && srcAgents.general?.model === undefined
    && srcAgents.explore?.model === undefined;
  check("source pins no models (portable; local choice per docs)", modelsOk);
  if (!modelsOk) { failClosed("CONTRACT-MISMATCH: source model drift", "see model drift notes"); return void finish(); }
  check("source forces no model on build root (no top-level or build model)",
    srcCfg.model === undefined && srcAgents.build?.model === undefined,
    `top=${srcCfg.model} build=${srcAgents.build?.model}`);
  check("source preserves Native builtin system prompts",
    ["build", "plan", "general", "explore"].every((id) => srcAgents[id]?.system === undefined));
  if (!fs.existsSync(SRC_AGENTS_MD)) {
    failClosed("CONTRACT-NOT-READY: shared instruction file missing in source", "global/AGENTS.md");
    return void finish();
  }
  const srcAgentsMd = fs.readFileSync(SRC_AGENTS_MD, "utf8");
  check("source shared instructions present (global/AGENTS.md)", true);
  const srcHashes = {
    jsonc: sha256(fs.readFileSync(SRC_JSONC, "utf8")),
    agentsMd: sha256(srcAgentsMd),
  };

  // --- 2. Sandbox (private HOME/XDG; copies actual source, sandbox-only transforms) ---
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(path.join(WORKSPACE, SCOPE_FILE), `${SCOPE_LINE}\n`);
  const cfgDir = path.join(PRIV, ".config", "opencode");
  fs.mkdirSync(cfgDir, { recursive: true });
  // No custom operating files exist in source anymore; the sandbox agents dir
  // is intentionally absent. A plan.md builtin override must never appear.
  check("sandbox carries no custom agents dir (source has no operating files)", !fs.existsSync(path.join(cfgDir, "agents")));
  fs.writeFileSync(path.join(cfgDir, "AGENTS.md"), srcAgentsMd);
  check("sandbox AGENTS.md same bytes as source", sha256(fs.readFileSync(path.join(cfgDir, "AGENTS.md"), "utf8")) === srcHashes.agentsMd);

  const sandboxAgents = JSON.parse(JSON.stringify(srcAgents));
  for (const id of ["build", "plan", "explore"]) {
    // Sandbox-only loopback model for configured roles; unconfigured General
    // inherits its actual fixture parent. Nothing else is rewritten.
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
        models: { fixture: { name: "Scripted fixture", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32768, output: 8192 } } },
      },
    },
    ...(srcCfg.tool_output ? { tool_output: srcCfg.tool_output } : {}),
    ...(srcCfg.compaction ? { compaction: srcCfg.compaction } : {}),
  };
  fs.writeFileSync(path.join(cfgDir, "opencode.json"), JSON.stringify(sandboxCfg, null, 1));
  fs.writeFileSync(path.join(cfgDir, "opencode.jsonc"), JSON.stringify(sandboxCfg, null, 1));
  const cfgText = JSON.stringify(sandboxCfg);
  check("sandbox providers are fixture-only", Object.keys(sandboxCfg.providers).join() === "fixture");
  check("sandbox drops MCP remotes/credentials", !("mcp" in sandboxCfg) && !cfgText.includes("mobbin") && !cfgText.includes("context7"));
  check("sandbox models all fixture-only", !/openai\/|opencode-go\/|anthropic\//.test(cfgText), "no external provider/model refs");
  check("sandbox keeps depth ceiling (not widened)", sandboxCfg.experimental.subagent_depth === 1);
  check("sandbox carries no removed operating definitions (authorized removal)",
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
      sandbox: { config: path.join(cfgDir, "opencode.json") },
      sandboxConfigSha256: sha256(fs.readFileSync(path.join(cfgDir, "opencode.json"), "utf8")),
      native: { version: nativeVersion, bin: OPENCODE_BIN, pid: nativeInfo.pid },
      coverage: ["P", "C", "D", "M", "T", "V", "E", "F", "G", "H", "I", "L", "X"],
      retiredBackup: {
        note: "user-authorized removal; originals recoverable from these private backups only",
        files: {
          engineer: { sha256: "7ba211bec5eb1ac8a23595ef35adc0a0ca77c440b5832a1d7c261b7a9264f03c" },
          design: { sha256: "cff01e0f9d435ea1d0e80f0accb6c50976b9d11ec97be21dfd7b289b6e5807b5" },
          research: { sha256: "e2df56022a47c20c17632ba135f7b73c7f066263b37bd93084cb51acce680854" },
          critic: { sha256: "6b4fa4df05845b312680b9691fef0743938c1e15da3a622cf9bf6132d31c6ac7" },
          lead: { sha256: "a4ad2046181c1669579f1d7e57686bf10a6874556c79344848248f9316121607" },
        },
        note2: "Design is a live review role since the no-lead upgrade; it is not retired.",
        locations: "Private local backup paths are not portable and are omitted from this public source.",
      },
    }, null, 1));

    // --- 3. Scope-aware location readiness + actual role registry. ---
    const LOC_Q = `location[directory]=${encodeURIComponent(WORKSPACE)}`;
    const locInfo = await mustApi("GET", `/api/location?${LOC_Q}`, undefined, "location readiness");
    check("location ready (canonical directory/project shape)", locInfo?.directory === WORKSPACE && typeof locInfo?.project?.id === "string", `dir=${locInfo?.directory}`);
    await mustApi("POST", "/api/location/reload", undefined, "location reload", 204);
    check("location reload accepted (sandbox config loaded)", true);
    const registered = new Set();
    async function createSession(caller, extra = {}) {
      const d = (await mustApi("POST", "/api/session", {
        location: { directory: WORKSPACE }, agent: caller, model: { id: "fixture", providerID: "fixture" }, ...extra,
      }, `session.create ${caller}`))?.data ?? {};
      if (typeof d.id !== "string" || !d.id) throw new Error(`session.create ${caller}: canonical {data.id} shape missing`);
      if (d.agent !== caller) throw new Error(`agent echo mismatch: want=${caller} got=${d.agent}`);
      registered.add(caller);
      return d.id;
    }
    const OPERATING_IDS = ["build", "plan", "general", "explore", "design"];
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
    for (const id of [...RETIRED_IDS, "architect", "design-specialist", "design-architect", "ux-scout", "ui-ux-critic", "product-reviewer"]) {
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
      const m = byId.get(id)?.model;
      check(`sandbox ${id} model selection (catalog)`, ["general", "design"].includes(id) ? m == null : m?.providerID === "fixture" && m?.id === "fixture", `got=${m?.providerID}/${m?.id}`);
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
        try {
          const res = await settleSourceFreeAskProbe({ sessionID: id, probe: d, api: restProbeApi, notice: `own-session cleanup ${caller}/${action}` });
          note(`ask settled ${caller}/${action}`, res.settled);
        } catch (e) {
          check(`ask cleanup ${caller}/${action} needs investigation`, false, String(e?.message ?? e).slice(0, 160));
        }
      }
      return d.effect;
    }

    // --- 4. Runtime policy matrix (no model calls; own sessions only) ---
    // Scope: every contract allow plus self/retired/unknown denies per caller,
    // plus targeted cross-denies. Retired-target denies under every live caller
    // are genuine Native effects — never faked.
    const DENY_RETIRED_ARCHIVED = [...RETIRED_IDS, "architect", "build", UNKNOWN];
    for (const [caller, allows] of Object.entries(CONTRACT.edges)) {
      const targets = [...new Set([...allows, caller, ...DENY_RETIRED_ARCHIVED])];
      for (const t of targets) {
        const want = allows.includes(t) ? "allow" : "deny";
        const got = await probe(caller, "subagent", t);
        check(`policy subagent ${caller} -> ${t}: ${want}`, got === want, `got=${got}`);
      }
    }
    for (const caller of OPERATING_IDS) {
      for (const target of [...RETIRED_IDS, ...RETIRED_ALIASES]) {
        const got = await probe(caller, "subagent", target);
        check(`policy subagent ${caller} -> ${target}: deny (retired/alias)`, got === "deny", `got=${got}`);
      }
    }
    for (const [caller, target] of [["plan", "general"], ["plan", "plan"],
      ["general", "general"], ["general", "explore"], ["general", "plan"],
      ["explore", "explore"], ["explore", "general"], ["explore", "plan"]]) {
      const got = await probe(caller, "subagent", target);
      check(`policy subagent ${caller} -> ${target}: deny`, got === "deny", `got=${got}`);
    }
    // E (policy half): plan edit deny (Native builtin) vs general edit allow;
    // explore edit deny (read-centric). Reads allow everywhere.
    const scopeAbs = path.join(WORKSPACE, "scope-note.txt");
    check("policy plan edit scope-note: deny (native builtin)", (await probe("plan", "edit", scopeAbs)) === "deny");
    check("policy general edit scope-note: allow (execution role)", (await probe("general", "edit", scopeAbs)) === "allow");
    check("policy explore edit scope-note: deny (read-centric)", (await probe("explore", "edit", scopeAbs)) === "deny");
    check("policy plan read scope-note: allow", (await probe("plan", "read", scopeAbs)) === "allow");
    check("policy general read scope-note: allow", (await probe("general", "read", scopeAbs)) === "allow");
    check("policy explore read scope-note: allow", (await probe("explore", "read", scopeAbs)) === "allow");
    for (const caller of ["general", "explore"]) {
      check(`policy ${caller} question: deny (Native leaf)`, (await probe(caller, "question", "*")) === "deny");
    }

    // --- 5. Runtime chains (real Native sessions + real subagent tool calls) ---
    async function runChain(rootAgent, rootText, doneToken, label, settleSecs = 150, extraSession = {}) {
      const id = await createSession(rootAgent, extraSession);
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
      if (!Array.isArray(messages)) throw new Error(`messages turn ${label}: canonical {data:[]} shape never observed`);
      fs.writeFileSync(path.join(ROOT, `messages-${label}.json`), JSON.stringify(messages, null, 1));
      return messages;
    }
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
    function reqLog() {
      return fs.readFileSync(path.join(ROOT, "fake-model-requests.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    }
    function toolTexts(messages) {
      return toolEntries(messages).map((t) => JSON.stringify(t.state?.content ?? t.state ?? ""));
    }
    const receivedIn = (messages, token) => toolTexts(messages).some((t) => t.includes(token));
    // Native default execution: check an actual completed assistant turn instead
    // of treating the session.create echo as selection proof.
    const defaultMessages = await promptTurn(defaultSession.id, "Reply ok without using tools.", "ok", "native-default");
    const defaultReplies = defaultMessages.filter((m) => m.type === "assistant" && m.time?.completed);
    check("Native default execution selects Build without an agent override",
      defaultReplies.length > 0 && defaultReplies.every((m) => m.agent === "build"),
      `agents=${defaultReplies.map((m) => m.agent).join(",")}`);
    // Common-instruction delivery: every scripted request must carry the full
    // shared source (delivery only, never a judgment claim).
    check("full common instructions reach every scripted model input (delivery only)",
      reqLog().filter((r) => r.hasTools).every((r) => r.sharedInstructionsPresent === true));

    // --- P: Build consults Plan directly (analysis only, zero subagent calls). ---
    const p = await runChain("build",
      `${subPrompt("KSI-DELEG-P0")} Ask plan for a short analysis of the scope contract and return its exact outcome to Main.`,
      "P0-ROOT-OK", "chain-p");
    check("P root returns to Main (P0-ROOT-OK)", assistantTexts(p.messages).includes("P0-ROOT-OK"));
    const pKids = await childrenOf(p.id);
    check("P build owns one plan child", pKids.length === 1 && pKids[0].agent === "plan", pKids.map((k) => k.agent).join(","));
    const pPlan = pKids[0]?.id ?? null;
    check("P plan created no child (consultation only, depth 1)", pPlan ? (await childrenOf(pPlan)).length === 0 : false);
    const pPlanMsgs = pPlan ? requireDataArray(await mustApi("GET", `/api/session/${pPlan}/message?limit=100&order=asc`, undefined, "P plan messages"), "P plan messages") : [];
    check("P plan made zero subagent calls", toolEntries(pPlanMsgs).filter((t) => t.name === "subagent").length === 0);
    check("P plan completed a real read (Native part output bytes)",
      toolEntries(pPlanMsgs).filter((t) => t.name === "read" && JSON.stringify(t.state?.input ?? {}).includes(SCOPE_FILE)).length === 1);
    check("P plan outcome returned up (P1-PLAN-OK + bytes in P0 inputs)",
      receivedIn(p.messages, "P1-PLAN-OK") && receivedIn(p.messages, "SCOPE-NOTE-CONTENT"));

    // --- C: depth-ceiling proof. Plan->Explore must fail closed. ---
    const c = await runChain("build",
      `${subPrompt("KSI-DELEG-C0")} Ask plan to place one call to explore and return the exact tool outcome to Main.`,
      "C0-ROOT-OK", "chain-c");
    check("C root returns to Main (C0-ROOT-OK)", assistantTexts(c.messages).includes("C0-ROOT-OK"));
    const cKids = await childrenOf(c.id);
    check("C build owns one plan child", cKids.length === 1 && cKids[0].agent === "plan", cKids.map((k) => k.agent).join(","));
    const cPlan = cKids[0]?.id ?? null;
    const cPlanMsgs = cPlan ? requireDataArray(await mustApi("GET", `/api/session/${cPlan}/message?limit=100&order=asc`, undefined, "C plan messages"), "C plan messages") : [];
    const cCalls = toolEntries(cPlanMsgs).filter((t) => t.name === "subagent");
    check("C plan attempted exactly one explore call", cCalls.length === 1, `calls=${cCalls.length}`);
    const cErr = cCalls.length === 1 ? (cCalls[0].state?.error?.message ?? "") : "";
    check("C nested call failed closed with a depth error (never success)",
      cCalls.length === 1 && cCalls[0].state?.status === "error" && /depth/i.test(cErr),
      `status=${cCalls[0]?.state?.status ?? "none"} err=${cErr.slice(0, 160)}`);
    check("C depth guard created no depth-2 child", cPlan ? (await childrenOf(cPlan)).length === 0 : false);
    check("C subagent tool was advertised to plan (guard, not omission)",
      reqLog().some((r) => r.marker === "KSI-DELEG-C1" && r.hasTools && (r.advertised ?? []).includes("subagent")));

    // --- D: Build-owned general unit with same-child repair. ---
    const d = await runChain("build",
      `${subPrompt("KSI-DELEG-D0")} Have a general worker write the dev-unit file, read it back and return the exact outcome. No independent review is requested.`,
      "D0-ROOT-OK", "chain-d");
    check("D root returns to Main (D0-ROOT-OK)", assistantTexts(d.messages).includes("D0-ROOT-OK"));
    const dKids = await childrenOf(d.id);
    check("D build owns one general child", dKids.length === 1 && dKids[0].agent === "general", dKids.map((k) => k.agent).join(","));
    const dGen = dKids[0]?.id ?? null;
    check("D general created no child of its own (leaf)", dGen ? (await childrenOf(dGen)).length === 0 : false);
    check("D unit evidence returned up (D1-UNIT-OK + bytes in D0 inputs)",
      receivedIn(d.messages, "D1-UNIT-OK") && receivedIn(d.messages, DEV_LINE));
    const dRepairMsgs = dGen ? await promptTurn(dGen, subPrompt("KSI-DELEG-D2", "Repair the dev-unit file to the fixed line, read it back, and return the exact read outcome."), "D2-REPAIRED-OK", "chain-d-resume") : [];
    check("D same child resumed (no new session spawned)", dGen ? (await childrenOf(d.id)).length === 1 : false);
    check("D repair returned from the same child (D2-REPAIRED-OK + fixed bytes)",
      assistantTexts(dRepairMsgs).includes("D2-REPAIRED-OK") && assistantTexts(dRepairMsgs).includes(DEV_FIXED));
    check("D dev-unit file holds the repaired bytes", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);

    // --- M: Build-direct general multi-file task. ---
    const m = await runChain("build",
      `${subPrompt("KSI-DELEG-M0")} Have a general worker write both unit files, read them back and return the exact outcomes.`,
      "M0-ROOT-OK", "chain-m");
    check("M root returns to Main (M0-ROOT-OK)", assistantTexts(m.messages).includes("M0-ROOT-OK"));
    const mKids = await childrenOf(m.id);
    check("M build owns one general child (direct, no consultation stage)", mKids.length === 1 && mKids[0].agent === "general", mKids.map((k) => k.agent).join(","));
    const mGen = mKids[0]?.id ?? null;
    const mGenMsgs = mGen ? requireDataArray(await mustApi("GET", `/api/session/${mGen}/message?limit=100&order=asc`, undefined, "M general messages"), "M general messages") : [];
    const mWrites = toolEntries(mGenMsgs).filter((t) => t.name === "write" && t.state?.status === "completed");
    const mReads = toolEntries(mGenMsgs).filter((t) => t.name === "read" && t.state?.status === "completed");
    check("M general wrote both files (2 completed Native writes)", mWrites.length === 2, `writes=${mWrites.length}`);
    check("M general read both files (2 completed Native reads)", mReads.length === 2, `reads=${mReads.length}`);
    check("M unit evidence returned up (M1-UNIT-OK in M0 inputs)", receivedIn(m.messages, "M1-UNIT-OK"));
    check("M direct-a bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_A_FILE), "utf8") === `${DIRECT_A_LINE}\n`);
    check("M direct-b bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_B_FILE), "utf8") === `${DIRECT_B_LINE}\n`);

    // --- T: Build direct execution with ZERO subagent calls. ---
    const t = await runChain("build",
      `${subPrompt("KSI-DIRECT-ROOT")} Perform the file operations yourself with write, edit and read, making no subagent calls, then report the exact read outcome.`,
      "T0-DONE-OK", "chain-t");
    check("T root returns (T0-DONE-OK)", assistantTexts(t.messages).includes("T0-DONE-OK"));
    const tTools = toolEntries(t.messages);
    check("T build made zero subagent calls", tTools.filter((x) => x.name === "subagent").length === 0);
    check("T build completed write+edit+read itself",
      tTools.filter((x) => x.name === "write" && x.state?.status === "completed").length === 1
      && tTools.filter((x) => x.name === "edit" && x.state?.status === "completed").length === 1
      && tTools.filter((x) => x.name === "read" && x.state?.status === "completed").length === 1);
    check("T build-direct file holds the revised bytes", fs.readFileSync(path.join(WORKSPACE, BUILD_DIRECT_FILE), "utf8") === `${BUILD_DIRECT_FIXED}\n`);

    // --- V: restricted General verification of the completed D unit. ---
    // Fresh session with explicit edit+shell denies (created outside the D
    // tree); the forced review-note write must fail closed with bytes unchanged.
    const vId = await createSession("general", { permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "read", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
    ] });
    const vMsgs = await promptTurn(vId,
      `${subPrompt("KSI-DELEG-VR")} Read the completed dev-unit file. Attempt the review note write exactly once, then return your findings as text with the exact write outcome.`,
      "VR-", "chain-v");
    const vTools = toolEntries(vMsgs);
    const vWrites = vTools.filter((x) => x.name === "write");
    check("V restricted write failed closed exactly once (never success)",
      vWrites.length === 1 && vWrites[0].state?.status === "error", `status=${vWrites[0]?.state?.status ?? "none"}`);
    check("V review note was never created", !fs.existsSync(path.join(WORKSPACE, REVIEW_NOTE)));
    check("V completed unit bytes unchanged", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);
    check("V findings returned with denial evidence (VR-DENIED-OK)", assistantTexts(vMsgs).includes("VR-DENIED-OK"));

    // --- X: retired-target exclusion at REAL call time from the build root. ---
    // A depth-1 plan child would hit the depth guard first (chain C proves
    // that), so the retired-target proof runs where calls can actually route.
    const x = await runChain("build",
      `${subPrompt("KSI-DELEG-X0")} Place one subagent call each to the removed engineer and lead roles and return their exact tool outcomes to Main.`,
      "CHAIN-X-ROOT-OK", "chain-x");
    check("X root returns to Main (CHAIN-X-ROOT-OK)", assistantTexts(x.messages).includes("CHAIN-X-ROOT-OK"));
    for (const target of ["engineer", "lead"]) {
      const calls = toolEntries(x.messages).filter((t) => t.name === "subagent" && t.state?.input?.agent === target);
      const err = calls[0]?.state?.error?.message ?? "";
      const closed = /(not found|unknown agent|denied|not permitted|not allowed)/i.test(err);
      check(`X Build -> ${target} real call rejected exactly once (fail closed, never success)`, calls.length === 1 && calls[0].state?.status === "error" && closed, `status=${calls[0]?.state?.status ?? "none"} err=${err.slice(0, 160)}`);
    }
    check("X forbidden calls created no child session", (await childrenOf(x.id)).length === 0);

    // --- H: missing-file failure, same-child resume with a new reference. ---
    const h = await runChain("build",
      `${subPrompt("KSI-DELEG-H0")} Ask a general worker for the evidence file bytes. If it cannot be read, have it return its limit instead of inventing bytes.`,
      "H0-ROOT-OK", "chain-h");
    check("H root returns to Main (H0-ROOT-OK)", assistantTexts(h.messages).includes("H0-ROOT-OK"));
    const hKids = await childrenOf(h.id);
    check("H build owns one general child (no silent fan-out)", hKids.length === 1 && hKids[0].agent === "general", hKids.map((k) => k.agent).join(","));
    const hGen = hKids[0]?.id ?? null;
    const hGenMsgs = hGen ? requireDataArray(await mustApi("GET", `/api/session/${hGen}/message?limit=100&order=asc`, undefined, "H general messages"), "H general messages") : [];
    const hReads = toolEntries(hGenMsgs).filter((t) => t.name === "read");
    check("H missing-file read failed closed exactly once (never success)",
      hReads.length === 1 && hReads[0].state?.status === "error", `status=${hReads[0]?.state?.status ?? "none"}`);
    check("H child limit returned first (H1-LIMITED-OK seen by root)",
      receivedIn(h.messages, "H1-LIMITED-OK"));
    const hResumeMsgs = hGen ? await promptTurn(hGen, subPrompt("KSI-DELEG-H2", "The scope note is an approved new reference. Read it and report its exact bytes."), "H2-RECOVERED-OK", "chain-h-resume") : [];
    check("H same child resumed (no new session spawned)", hGen ? (await childrenOf(h.id)).length === 1 : false);
    check("H child received the recovered evidence (H2-RECOVERED-OK + bytes)",
      assistantTexts(hResumeMsgs).includes("H2-RECOVERED-OK") && assistantTexts(hResumeMsgs).includes("SCOPE-NOTE-CONTENT"));

    // --- G: same-child continuity across two turns. ---
    const g = await runChain("build",
      `${subPrompt("KSI-DELEG-G0")} Ask a general worker to read the scope note and report its exact bytes.`,
      "G0-ROOT-OK", "chain-g");
    check("G root returns to Main (G0-ROOT-OK)", assistantTexts(g.messages).includes("G0-ROOT-OK"));
    const gKids = await childrenOf(g.id);
    check("G build owns one general child", gKids.length === 1 && gKids[0].agent === "general", gKids.map((k) => k.agent).join(","));
    const gGen = gKids[0]?.id ?? null;
    check("G child evidence returned up (G1-RESULT-OK + bytes in G0 inputs)",
      receivedIn(g.messages, "G1-RESULT-OK") && receivedIn(g.messages, "SCOPE-NOTE-CONTENT"));
    const gTurn2 = gGen ? await promptTurn(gGen, subPrompt("KSI-DELEG-G2", "Scope unchanged. Read the scope note again and report its exact bytes."), "G2-RESULT-OK", "chain-g-turn2") : [];
    check("G turn 2 reused the same child (no new session)", gGen ? (await childrenOf(g.id)).length === 1 : false);
    check("G turn 2 returned new evidence from the same child (G2-RESULT-OK + bytes)",
      assistantTexts(gTurn2).includes("G2-RESULT-OK") && assistantTexts(gTurn2).includes("SCOPE-NOTE-CONTENT"));

    // --- I: restriction inheritance across sibling children. ---
    // I0A control root (unrestricted) -> plan child reads scope (must succeed).
    const i0a = await runChain("build",
      `${subPrompt("KSI-DELEG-I0A")} Ask plan to read the scope note and return its exact bytes.`,
      "I0A-ROOT-OK", "chain-i-control");
    check("I control root returns (I0A-ROOT-OK)", assistantTexts(i0a.messages).includes("I0A-ROOT-OK"));
    check("I control evidence returned up (I1A-RESULT-OK + bytes)",
      receivedIn(i0a.messages, "I1A-RESULT-OK") && receivedIn(i0a.messages, "SCOPE-NOTE-CONTENT"));
    // I0B restricted root (edit+shell denies) -> plan + general siblings.
    // Both children inherit the snapshot: reads succeed, writes/edits fail.
    const i0bId = await createSession("build", { permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "plan", effect: "allow" },
      { action: "subagent", resource: "general", effect: "allow" },
      { action: "subagent", resource: "explore", effect: "allow" },
      { action: "read", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
    ] });
    const i0bMsgs = await promptTurn(i0bId,
      `${subPrompt("KSI-DELEG-I0B")} Fan out to plan (read the scope note) and general (attempt the denied-note write and a scope edit, then read the scope) in one response, and return both outcomes.`,
      "I-ROOT-OK", "chain-i");
    check("I restricted root returns (I-ROOT-OK)", assistantTexts(i0bMsgs).includes("I-ROOT-OK"));
    const iKids = await childrenOf(i0bId);
    const iPlan = iKids.filter((k) => k.agent === "plan").length === 1 ? iKids.find((k) => k.agent === "plan").id : null;
    const iGen = iKids.filter((k) => k.agent === "general").length === 1 ? iKids.find((k) => k.agent === "general").id : null;
    check("I restricted root owns one plan and one general sibling", iKids.length === 2 && typeof iPlan === "string" && typeof iGen === "string", iKids.map((k) => k.agent).join(","));
    const iPlanMsgs = iPlan ? requireDataArray(await mustApi("GET", `/api/session/${iPlan}/message?limit=100&order=asc`, undefined, "I plan messages"), "I plan messages") : [];
    const iGenMsgs = iGen ? requireDataArray(await mustApi("GET", `/api/session/${iGen}/message?limit=100&order=asc`, undefined, "I general messages"), "I general messages") : [];
    check("I plan read succeeded under the inherited snapshot",
      toolEntries(iPlanMsgs).filter((t) => t.name === "read" && t.state?.status === "completed").length === 1);
    const iGenWrites = toolEntries(iGenMsgs).filter((t) => (t.name === "write" || t.name === "edit"));
    check("I general write+edit failed closed under the inherited snapshot (never success)",
      iGenWrites.length === 2 && iGenWrites.every((t) => t.state?.status === "error"),
      `writes=${iGenWrites.map((t) => t.state?.status ?? "none").join(",")}`);
    check("I general read succeeded under the inherited snapshot",
      toolEntries(iGenMsgs).filter((t) => t.name === "read" && t.state?.status === "completed").length === 1);
    check("I sibling results returned up (I2-PLAN-OK + I3-GENERAL-OK in I0B inputs)",
      receivedIn(i0bMsgs, "I2-PLAN-OK") && receivedIn(i0bMsgs, "I3-GENERAL-OK"));
    check("I inherited snapshot preserved scope bytes", fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8") === `${SCOPE_LINE}\n`);
    check("I denied-note was never created", !fs.existsSync(path.join(WORKSPACE, DENIED_WRITE)));

    // --- L: parallel fan-out in ONE response (general writes, explore reads). ---
    const lScopeBefore = sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8"));
    const l = await runChain("build",
      `${subPrompt("KSI-DELEG-L0")} Delegate two independent units concurrently: general writes and reads the parallel API file, explore reads only the shared scope note. Return both findings to Main.`,
      "L0-DONE-OK", "chain-l");
    check("L root returns (L0-DONE-OK)", assistantTexts(l.messages).includes("L0-DONE-OK"));
    const lKids = await childrenOf(l.id);
    check("L root owns exactly two children: general + explore (single fan-out)",
      lKids.length === 2 && JSON.stringify(lKids.map((k) => k.agent).sort()) === JSON.stringify(["explore", "general"]),
      lKids.map((k) => k.agent).join(","));
    const lGen = lKids.find((k) => k.agent === "general")?.id ?? null;
    const lExp = lKids.find((k) => k.agent === "explore")?.id ?? null;
    const lGenMsgs = lGen ? requireDataArray(await mustApi("GET", `/api/session/${lGen}/message?limit=100&order=asc`, undefined, "L general messages"), "L general messages") : [];
    const lExpMsgs = lExp ? requireDataArray(await mustApi("GET", `/api/session/${lExp}/message?limit=100&order=asc`, undefined, "L explore messages"), "L explore messages") : [];
    check("L general completed write+read on its own file (own Native parts)",
      toolEntries(lGenMsgs).filter((t) => t.name === "write" && t.state?.status === "completed").length === 1
      && toolEntries(lGenMsgs).filter((t) => t.name === "read" && t.state?.status === "completed").length === 1);
    check("L explore completed a scope read and wrote nothing",
      toolEntries(lExpMsgs).filter((t) => t.name === "read" && t.state?.status === "completed").length === 1
      && toolEntries(lExpMsgs).filter((t) => t.name === "write" || t.name === "edit").length === 0);
    check("L explore read returned scope bytes (own Native part)",
      JSON.stringify(toolEntries(lExpMsgs).map((t) => t.state?.content ?? t.state ?? "")).includes("SCOPE-NOTE-CONTENT"));
    check("L scope file unchanged by parallel work", sha256(fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8")) === lScopeBefore);
    check("L parallel API file holds the written bytes", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
    check("L both child outcomes returned to the parent turn (L1-GENERAL + L2-EXPLORE in L0 inputs)",
      receivedIn(l.messages, "L1-GENERAL-OK") && receivedIn(l.messages, "L2-EXPLORE-OK"));
    const lReqs = reqLog().filter((r) => r.marker === "KSI-DELEG-L1" || r.marker === "KSI-DELEG-L2");
    const lT1 = lReqs.filter((r) => r.marker === "KSI-DELEG-L1").map((r) => r.t);
    const lT2 = lReqs.filter((r) => r.marker === "KSI-DELEG-L2").map((r) => r.t);
    check("L general/explore model-request windows overlap (real concurrency, not Promise.all only)",
      lT1.length > 0 && lT2.length > 0 && Math.min(...lT2) < Math.max(...lT1) && Math.min(...lT1) < Math.max(...lT2));

    // --- F: forced write/edit attempts by plan and explore end in deny. ---
    const f1Id = await createSession("plan", {});
    const f1Msgs = await promptTurn(f1Id,
      `${subPrompt("KSI-DELEG-F1")} Attempt a write to the scope note and an edit of it, then report the exact tool outcomes as text.`,
      "F1-", "chain-f-plan");
    const f1Writes = toolEntries(f1Msgs).filter((t) => t.name === "write" || t.name === "edit");
    check("F plan write+edit failed closed (never success)",
      f1Writes.length === 2 && f1Writes.every((t) => t.state?.status === "error"),
      `writes=${f1Writes.map((t) => t.state?.status ?? "none").join(",")}`);
    check("F plan reported the denial honestly (F1-DENIED-OK)", assistantTexts(f1Msgs).includes("F1-DENIED-OK"));
    const f2Id = await createSession("explore", {});
    const f2Msgs = await promptTurn(f2Id,
      `${subPrompt("KSI-DELEG-F2")} Attempt a write to the denied note, then report the exact tool outcome as text.`,
      "F2-", "chain-f-explore");
    const f2Writes = toolEntries(f2Msgs).filter((t) => t.name === "write");
    check("F explore write failed closed (never success)",
      f2Writes.length === 1 && f2Writes[0].state?.status === "error", `status=${f2Writes[0]?.state?.status ?? "none"}`);
    check("F explore reported the denial honestly (F2-DENIED-OK)", assistantTexts(f2Msgs).includes("F2-DENIED-OK"));

    // --- Final workspace + evidence integrity. ---
    const wsFilesEnd = fs.readdirSync(WORKSPACE).sort();
    check("final workspace holds only the scope probe plus task-local files",
      JSON.stringify(wsFilesEnd) === JSON.stringify([BUILD_DIRECT_FILE, DEV_FILE, DIRECT_A_FILE, DIRECT_B_FILE, L_API_FILE, SCOPE_FILE].sort()), wsFilesEnd.join(","));
    check("final denied-note was never created", !fs.existsSync(path.join(WORKSPACE, DENIED_WRITE)));
    check("final review note was never created", !fs.existsSync(path.join(WORKSPACE, REVIEW_NOTE)));
    check("final missing-evidence file was never created", !fs.existsSync(path.join(WORKSPACE, MISSING_EVIDENCE)));
    check("final scope bytes unchanged since setup", fs.readFileSync(path.join(WORKSPACE, SCOPE_FILE), "utf8") === `${SCOPE_LINE}\n`);
    check("final dev-unit bytes are the repaired version", fs.readFileSync(path.join(WORKSPACE, DEV_FILE), "utf8") === `${DEV_FIXED}\n`);
    check("final direct-a bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_A_FILE), "utf8") === `${DIRECT_A_LINE}\n`);
    check("final direct-b bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, DIRECT_B_FILE), "utf8") === `${DIRECT_B_LINE}\n`);
    check("final build-direct bytes are the revised unit", fs.readFileSync(path.join(WORKSPACE, BUILD_DIRECT_FILE), "utf8") === `${BUILD_DIRECT_FIXED}\n`);
    check("final parallel API bytes are the written unit", fs.readFileSync(path.join(WORKSPACE, L_API_FILE), "utf8") === `${L_API_LINE}\n`);
  } catch (e) {
    check("fixture completed without harness error", false, String(e?.stack ?? e).slice(0, 600));
  } finally {
    try { serve.kill("SIGTERM"); } catch {}
    try { await new Promise((resolve) => fake.close(resolve)); } catch {}
    try { clearTimeout(watchdog); } catch {}
  }
  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Evidence dir: ${ROOT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(`FATAL ${e?.stack ?? e}`); process.exit(1); });
