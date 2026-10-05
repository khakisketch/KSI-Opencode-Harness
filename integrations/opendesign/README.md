# OpenDesign integration (workstation-specific deployment record)

Reproduction assets for the OpenDesign workspace that this harness uses for design work. These files live in
the source repository so the deployment can be rebuilt after a machine change; they are **not** part of the
published npm package (`package.json#files` deliberately excludes `integrations/`).

OpenDesign is a separate application. It is not an agent role in this harness, and this repository does not
vendor, patch, or redistribute any OpenDesign code. Everything here is either a deployment patch for the
user's own checkout or a file that runs beside it.

**Optional and manual; not installed by KSI.** This is a record of one Ubuntu arm64 host, not a turnkey
cross-platform setup. Start with upstream documentation. Do not apply these mounts, UID settings, CLI
shim, or database sync to another host without inspecting them and obtaining approval.

### Security and portability boundaries

- Docker access and host networking are powerful privileges, not a sandbox.
- The full host `~/.codex` and `~/.gemini` stores are mounted **read-write**. Container agents can alter
  host sessions/settings/credentials. Prefer dedicated signed-in stores if isolation is required.
- The compose patch retains a **legacy** `auth.json` mount. It does not provide OpenCode V2 credentials;
  V2 uses the separate container database. Do not assume that mount authenticates anything.
- UID/GID and tmpfs ownership must agree. The patch's tmpfs is fixed at `1000:1000`, despite the service's
  UID variables. Persistent volumes also need matching ownership; the patch does not migrate ownership.
- Credential sync directly edits an internal SQLite schema, stops container OpenCode, replaces all API-key
  rows, and writes secret-bearing SQL temporarily on the host (private mktemp file, removed on exit).
  SQL is streamed to the container without creating a container SQL file. It is an experimental maintenance
  aid, **not a supported sign-in API**. Back up state and never run during a design job. This safer repository
  copy is not automatically installed over an older local script; review and replace your copy separately.
- The shim drops `--pure`; it does **not** recreate the original isolation semantics. Normal design
  generation was tested, not sandbox isolation or every CLI adapter feature.

## Architecture

The diagram below records the **original deployment**, not the current operating-role hierarchy. Current guidance uses OpenDesign's local execution for material design and OpenCode Build/Plan for the outer product-development conversation; see [the current integration contract](../../docs/integrations/opendesign.md). A coding runtime launched inside the design application is an implementation detail, not authority to call or control the outer engineering session. Host MCP/skills/auth are not assumed to be inherited by that inner runtime.

```text
people ──────────────► OpenDesign web UI (local + tailnet)
                            │
                            ├─ daemon spawns OpenCode as the design agent ─┐
                            │                                              │
                            └─ MCP (stdio) ──► OpenCode session ◄──────────┘
                                                    │
                                        reads/writes the live design files
```

- OpenDesign owns design direction, layout, artifacts, and critique.
- OpenCode is spawned by the OpenDesign daemon as the agent that generates designs.
- OpenCode can also call back into OpenDesign through the `opendesign` MCP server registered in its own config.
- The container's OpenCode is a **separate, minimal installation** from the host engineering harness.

## Verified environment

| Component | Version |
| --- | --- |
| Host | Ubuntu 24.04, aarch64 |
| Docker / Compose | 29.2.1 / v5.0.2 |
| OpenDesign image | `ghcr.io/nexu-io/od:0.24.1` |
| OpenDesign checkout | `nexu-io/open-design` at `5b19dfa` |
| OpenCode (shared by both sides) | v2.0.18 |
| Tailscale | 1.102.3 |

## Reproduction

### 1. Install OpenDesign

The following commands describe the original installation. Current upstream `main` may differ from the
tested checkout. The patch is tied to commit `5b19dfa`; pin a reviewed compatible checkout before applying it.
Define `KSI_ASSETS` as the absolute path to this repository's `integrations/opendesign` directory for later steps.

```sh
export KSI_ASSETS=/absolute/path/to/KSI-Opencode-Harness/integrations/opendesign
```

```sh
mkdir -p ~/opendesign && cd ~/opendesign
git clone --depth 1 https://github.com/nexu-io/open-design.git
cd open-design
bash deploy/scripts/install.sh --non-interactive --port 7456 --image ghcr.io/nexu-io/od:0.24.1
```

The installer writes `deploy/.env` (including a generated `OD_API_TOKEN`), pulls the image, starts the
container, and creates a `systemd --user` unit.

### 1b. Raise the memory limit

The installer defaults to a 384 MB container cap with a 192 MB Node heap. A real design run exceeds it:
the container was OOM-killed mid-run and the run failed with
`Transport: The socket connection was closed unexpectedly`. Raise both in `deploy/.env` before running designs:

```sh
sed -i 's|^OPEN_DESIGN_MEM_LIMIT=.*|OPEN_DESIGN_MEM_LIMIT=2g|; s|^NODE_OPTIONS=.*|NODE_OPTIONS=--max-old-space-size=1024|' deploy/.env
```

### 2. Apply the Linux override patch

Upstream's `deploy/docker-compose.linux.yml` is the documented place for Linux CLI mounts, and both
`install.sh` and `update.sh` auto-detect that exact file — a differently named compose file would be silently
dropped on update.

```sh
cd ~/opendesign/open-design
git apply /path/to/integrations/opendesign/docker-compose.linux.patch
```

The patch adds, on top of upstream:

| Change | Why |
| --- | --- |
| `user: "1000:1000"` | Host files are owned by uid 1000 and mode 600; the image default (uid 1001) cannot read them |
| `HOME: /home/open-design` | uid 1000 is named `node` in the image, so `HOME` would resolve to the non-existent `/home/node` |
| `CODEX_HOME` | Codex resolves its home from this variable, not from the mount target |
| aarch64 glibc mounts | Upstream only mounts the amd64 library paths; this host is arm64 |
| `~/.codex`, `~/.gemini` mounts | Codex and Antigravity need their own state and sign-in |
| container-owned OpenCode config | Keeps the host's engineering config out of the container |
| OpenCode state volume, port pin | Isolates sessions and avoids the host service port |

### 3. Install the OpenCode shim

```sh
cp "$KSI_ASSETS/opencode-cli" ~/.opencode/bin/opencode-cli
chmod +x ~/.opencode/bin/opencode-cli
```

The shim translates the argv shape OpenDesign's adapter expects into what OpenCode 2.x accepts:

| Adapter sends | Shim does | Why |
| --- | --- | --- |
| `run --dir <path>` | moves the path to a trailing positional argument | 2.x removed `--dir` |
| `run --pure` | drops it | 2.x has no `--pure`; it is only used for the connection smoke test |
| `models --verbose` | drops `--verbose` | 2.x has no `--verbose`, and without this the daemon falls back to a hardcoded model list |

### 4. Container OpenCode configuration

```sh
mkdir -p ~/opendesign/opencode-config-container
cp "$KSI_ASSETS/opencode-config-container.jsonc" ~/opendesign/opencode-config-container/opencode.jsonc
printf '{\n  "port": 49380\n}\n' > ~/opendesign/opencode-config-container/service.json
```

This config intentionally has no roles, skills, or MCP servers: those belong to the host engineering harness
and cannot run inside the container.

### 5. Share credentials

OpenCode 2.x stores credentials in its SQLite `credential` table, **not** in `auth.json`. The container has its
own database, so it does not inherit the host's providers.

```sh
cp "$KSI_ASSETS/sync-opencode-credentials.sh" ~/opendesign/
bash ~/opendesign/sync-opencode-credentials.sh
```

Only `API key` rows are copied. OAuth rows are excluded on purpose: a rotating refresh token shared between
two stores would invalidate one of them. **Re-run this whenever host credentials change.**

### 6. Register the MCP server in OpenCode

After reviewing the actual server's configuration, merge this **V2** example without replacing unrelated
settings. This Docker command is specific to the recorded image/container, not a universal upstream command.
The tested host retains a compatible older-shaped block; that is not the recommended new configuration.

```jsonc
{
  "mcp": {
    "servers": {
      "opendesign": {
        "type": "local",
        "command": [
          "docker", "exec", "-i",
          "-e", "OD_DAEMON_URL=http://127.0.0.1:7456",
          "-e", "OD_MCP_STDIO_IDLE_EXIT_MS=0",
          "open-design",
          "sh", "-c", "cd /app && node apps/daemon/dist/cli.js mcp"
        ],
        "disabled": false,
        "timeout": { "startup": 60000, "catalog": 60000 }
      }
    }
  }
}
```

The tested upstream MCP wrapper defaults to exiting after **30 minutes without a request**
(`DEFAULT_MCP_STDIO_IDLE_EXIT_MS`). Setting `OD_MCP_STDIO_IDLE_EXIT_MS=0` disables that timer for this
stdio process. It does not keep a killed/restarted container alive or guarantee automatic reconnection.
Verified with real wrapper processes: a 200 ms idle policy closed the transport; zero stayed connected
and returned 22 tools after the same idle interval. The live host config was backed up, changed with
explicit approval, and project-scoped reconnected; process environment and a live project read were checked.
A full 30-minute no-request soak has not been performed.

### 7. Remote access

```sh
tailscale serve --bg --https=7456 http://127.0.0.1:7456
```

Also set `OPEN_DESIGN_ALLOWED_ORIGINS=https://<machine>.<tailnet>.ts.net:7456` in `deploy/.env` so the web UI's
API calls pass the origin check.

### 8. KSI design guidance

```sh
docker cp "$KSI_ASSETS/ksi-design-system/." open-design:/app/.od/design-systems/ksi/
```

It appears in the design-system picker as `user:ksi` and is readable by agents at
`od://design-systems/user%3Aksi/DESIGN.md`. The package is prose-only: a full manifest requires a compiled
`tokens.css`, and inventing a KSI token set is worse than shipping none. Add real tokens later if they exist.

`metadata.json` must be present with `"status": "published"`. A user design system defaults to `draft`, and
projects are rejected with `DESIGN_SYSTEM_NOT_PUBLISHED` until it is published.

## Operations

```sh
systemctl --user status open-design        # service state
docker compose -f docker-compose.yml -f docker-compose.linux.yml logs -f   # from deploy/
bash ~/opendesign/sync-opencode-credentials.sh   # after host credential changes
docker exec -u 1000 -e HOME=/home/open-design open-design sh -c 'opencode auth list'
```

Login to the web UI uses username `open-design` and the `OD_API_TOKEN` from `deploy/.env`.

After editing `.env` or compose mounts, recreate the container deliberately from `deploy/` with both
compose files. Review the generated user-service unit: on this host an invalid user-unit
`Requires=docker.service` needed removal because Docker is a system service. Verify startup, persistent-volume
ownership and agent sign-in, then run `opencode mcp list` **from the consuming project** and exercise a read tool.

## Known limitations

- OpenCode 2.x has no `export --sanitize --pure` or `run --variant`, so those adapter features stay
  unavailable.
- Restarting the OpenDesign container drops the `opendesign` MCP connection held by any live OpenCode session;
  use `/mcps` in the consuming project to disconnect/reconnect, then verify a real read. A new session alone
  was not established as sufficient. Explicit project-scoped reconnect restored 22 tools in the live audit.
- Independently of container restarts, the upstream wrapper's default 30-minute idle exit also closes
  the connection. The example above disables it; keep explicit reconnect available for other failures.
- Artifact reads need explicit project and entry-file arguments in the tested deployment; default entry
  lookup failed. Existing successful runs and reads were checked; restart recovery is not automatic.
- Codex connection tests intermittently failed with a signal/timeout and retries passed; the cause is
  unresolved. Load is a hypothesis, not an established cause. This is not a release blocker per the user.
- Claude Code through this deployment fails on an Anthropic account restriction
  (`organization has disabled Claude subscription access for Claude Code`), not on configuration.
- OpenDesign Cloud and its `vela` CLI are explicitly out of scope: Local AI only.
- Upgrading OpenDesign (`deploy/scripts/update.sh`) may overwrite `docker-compose.linux.yml`; re-apply the
  patch afterwards.
