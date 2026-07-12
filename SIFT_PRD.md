# Sift — Intelligent Log Aggregator for Local Development

## Product Requirements Document (PRD)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [The Problem in Depth](#2-the-problem-in-depth)
3. [Target User](#3-target-user)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Tech Stack](#5-tech-stack)
6. [Architecture](#6-architecture)
7. [Core Features](#7-core-features)
8. [Commands & CLI Interface](#8-commands--cli-interface)
9. [Log Parsing Engine](#9-log-parsing-engine)
10. [Terminal UI Specification](#10-terminal-ui-specification)
11. [Edge Cases & Handling](#11-edge-cases--handling)
12. [Configuration System](#12-configuration-system)
13. [Performance & Memory Management](#13-performance--memory-management)
14. [MVP Development Roadmap](#14-mvp-development-roadmap)
15. [Testing Strategy](#15-testing-strategy)
16. [Distribution](#16-distribution)
17. [Future Features (Post-MVP)](#17-future-features-post-mvp)

---

## 1. Product Vision

> Sift is the `htop` of local development logging. It aggregates, parses, categorizes, and presents logs from all your running services in a single, beautiful, interactive terminal interface — so you can find what matters without scrolling through five terminal tabs.

**Core Philosophy:**
- **Aggregate** — One pane, all services. No more tab-switching.
- **Parse** — Understands log levels, timestamps, service names, request IDs automatically.
- **Correlate** — Traces a single request across multiple services.
- **Filter** — Search, filter by service, level, or time — in real-time.
- **Pause** — Spacebar pauses the display; logs keep buffering in the background. Nothing is lost while you're away.

> **MVP Note:** True persistence (SQLite storage, session replay) is post-MVP. The ring buffer keeps recent logs in memory (default: 10,000 lines); under high volume, old entries are overwritten. For long-running sessions where log history matters, use pipe mode and redirect to a file: `sift run 2>&1 | tee sift.log`.

---

## 2. The Problem in Depth

### Scenario 1: The Multi-Service Dev Stack
You are running:
```
Terminal 1: npx expo start               (Metro bundler)
Terminal 2: npm run dev                   (Next.js frontend)
Terminal 3: npm run server                (Express API)
Terminal 4: docker logs postgres-db -f    (Database)
Terminal 5: stripe listen --forward-to... (Webhook listener)
```
An error happens. You see a flicker of red in Terminal 3, but by the time you switch, it's scrolled away. You don't know which service caused it, or if it's related to the warning you saw in Terminal 1 thirty seconds ago.

### Scenario 2: The CI Log Dump
Your GitHub Actions workflow fails. The logs are a 4MB text file. You `grep` for "error" and get 200 matches, most of them from `node_modules`. The actual error is a `warning` from your own code that cascaded into a failure three steps later.

### Scenario 3: The Request Trace
A user reports: "Login is slow." You need to see:
1. Frontend request timestamp
2. API gateway log
3. Auth service log
4. Database query log
These are in four different places. Correlating them manually is nearly impossible.

### Existing Tools and Why They Fall Short

| Tool | What It Does | The Gap |
|------|-------------|---------|
| `concurrently` | Runs multiple `npm` scripts, prefixes output | No parsing, no filtering, no UI. Raw interleaved text. |
| `pm2 logs` | Streams PM2-managed process logs | Requires PM2 adoption. No cross-service correlation. |
| `docker compose logs` | Aggregates container logs | Docker-only. No filtering UI. Raw color-coded text. |
| `tail -f` | Follows a single file | One file only. No aggregation. |
| `lnav` | Log file navigator | File-based, not process-based. Steep learning curve. |
| Grafana/Loki | Cloud log aggregation | Overkill for local dev. Requires setup. Not real-time for local. |

**The gap:** No tool provides a real-time, interactive, aggregated log viewer specifically designed for the multi-service local development workflow.

---

## 3. Target User

**Primary:** Full-stack and mobile developers running 3+ services locally.

**Profile (like you):**
- Runs a mobile app (Expo/React Native), a web frontend, and a backend API simultaneously
- Uses `package.json` scripts to start services (`npm run dev`, `npx expo start`, etc.)
- Has tried `concurrently` but found the output unreadable
- Wants to see errors immediately without switching terminal tabs
- Works on a team where understanding the full request flow matters

**Secondary:**
- DevOps engineers testing multi-service setups locally
- Backend developers debugging microservices
- QA engineers reproducing issues with full stack traces

**Adoption Challenge:**
`concurrently` is already in 4M+ projects and developers' muscle memory. The hardest part of a tool like Sift isn't building it — it's getting someone to change a working habit. Sift addresses this by:
- Pipe mode (`docker compose logs -f | sift`) — works with existing setups, zero config change
- Drop-in replacement for `concurrently` with `sift run` — same script-based approach, better output
- Immediate visible value: one glance shows errors across all services, no tab-switching

---

## 4. Competitive Landscape

### Direct: Partial

Two tools overlap with parts of Sift's surface area:

| Tool | What It Does | Where Sift Differs |
|------|-------------|-------------------|
| **mprocs** | TUI that runs multiple commands in separate named panels, with per-process scrollback, start/stop/restart, and YAML config. | mprocs gives each process its own panel. Sift merges all output into a single, parsed, level-tagged, filterable stream. |
| **process-compose** | Process runner with dependency graph, `process_log_ready` condition (waits for a log line), interactive/TTY support, health checks. | process-compose solves *running* services. Sift solves *reading across* them as one intelligent, parsed stream. |

### Sift's Genuine Differentiation

Neither mprocs nor process-compose addresses the core problem: **understanding what happened across all your services as one timeline**. They are process *runners* with log *display*. Sift is a log *processor* with process *management*.

The specific gaps Sift fills:
- **Unified parsed stream** — One scrolling view with log levels, timestamps, and service tags, not N separate panels
- **Intelligent parsing** — Auto-detects log levels, timestamps, request IDs across different frameworks
- **Search and filter** — Filter by level ("show me only errors"), by service, or free-text search across all services
- **Request correlation** — If your services emit trace IDs, Sift links related logs across services (opt-in, requires structured logging)
- **Zero-config detection** — Reads `package.json` scripts, auto-detects services, assigns colors
- **Pause without loss** — Spacebar pauses display; logs keep buffering in the background

### Indirect:
- **concurrently** — Most common alternative (4M+ projects). Runs scripts, prefixes output. No parsing, no UI, interleaved raw text. Sift's primary adoption target.
- **pm2 logs** — Requires PM2 adoption. No cross-service correlation.
- **docker compose logs** — Docker-only. Raw interleaved text. No filtering UI.
- **lnav** — File-oriented, not process-oriented. Complex keybindings.

### Why Sift Wins:
- Zero config for common setups (auto-detects from `package.json`)
- Beautiful terminal UI (not raw text)
- Intelligent parsing (understands log levels, not just text)
- Request correlation (trace IDs across services)
- Paused buffer (never miss logs)
- Language/framework agnostic

---

## 5. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | TypeScript | Type safety, familiar ecosystem |
| **CLI Framework** | `commander` | Argument parsing, subcommands |
| **Terminal UI** | `ink` (React for terminals) | You know React. Rich component ecosystem. |
| **React** | `react` | Peer dependency of `ink` |
| **Ink Components** | `ink-text-input`, `ink-select-input`, `ink-spinner` | Common UI patterns |
| **Process Management** | `node:child_process` | Spawn, kill, stream processes |
| **Stream Processing** | `node:readline` | Line-by-line processing of process stdout/stderr |
| **Log Parsing** | Custom + regex | Framework-specific log format detection |
| **Config** | `conf` | Cross-platform config storage |
| **ANSI Handling** | `strip-ansi`, `ansi-regex` | Preserve or strip color codes from child processes |
| **File Watching** | `node:fs` `watch` | Watch log files in file-follow mode |
| **Build** | `tsup` | Fast ESM bundling (all deps are ESM-only) |
| **Test** | `vitest` | Fast, native TypeScript support |
| **Distribution** | `npm` | Global install: `npm i -g sift-logs` |

---

## 6. Architecture

### Directory Structure

```
sift/
├── src/
│   ├── cli/
│   │   ├── index.ts                    # Entry point (#!/usr/bin/env node)
│   │   └── commands/
│   │       ├── run.ts                  # sift run (main command)
│   │       ├── config.ts              # sift config (init, show)
│   │       ├── attach.ts              # sift attach <pid>
│   │       └── version.ts             # sift --version
│   │
│   ├── core/
│   │   ├── detector.ts                # Auto-detect services from package.json
│   │   ├── spawner.ts                 # Spawn processes, manage streams
│   │   ├── parser.ts                  # Parse log lines (level, timestamp, msg)
│   │   ├── correlator.ts             # Correlate logs by request ID
│   │   ├── buffer.ts                 # Ring buffer for log storage
│   │   ├── config.ts                 # Config file read/write
│   │   └── service.ts                # Service definition and state
│   │
│   ├── ui/
│   │   ├── App.tsx                    # Root Ink component
│   │   ├── components/
│   │   │   ├── LogStream.tsx         # Main scrolling log view
│   │   │   ├── ServiceSidebar.tsx    # Service list with status
│   │   │   ├── StatusBar.tsx         # Bottom status bar
│   │   │   ├── SearchOverlay.tsx     # Search input + results
│   │   │   ├── FilterPanel.tsx       # Filter by service/level
│   │   │   ├── DetailView.tsx        # Expanded log detail (stack traces)
│   │   │   └── HelpOverlay.tsx       # Keyboard shortcuts help
│   │   └── theme.ts                   # Colors, styles
│   │
│   ├── parsers/
│   │   ├── json-line.ts              # JSON structured logs (Pino, Winston, Bunyan, Zap, structlog)
│   │   ├── bracketed.ts              # [LEVEL] message format (Metro, env_logger, many CLIs)
│   │   ├── logfmt.ts                 # key=value pairs (logrus, Heroku, systemd)
│   │   ├── access-log.ts             # HTTP access logs (morgan, Apache CLF, Nginx, Uvicorn)
│   │   ├── prefixed.ts               # LEVEL: message or TIMESTAMP LEVEL message
│   │   ├── language.ts               # Language/framework logs (Python, Go, Rust, Ruby, Elixir)
│   │   ├── docker.ts                 # Docker container prefix format
│   │   ├── generic.ts                # Fallback: plain text with best-effort detection
│   │   └── index.ts                  # Parser registry, dispatch, and format auto-detection
 │   │
│   ├── utils/
│   │   ├── ansi.ts                   # ANSI code handling
│   │   ├── time.ts                   # Timestamp parsing/normalization
│   │   ├── fs.ts                     # File system helpers
│   │   └── logger.ts                 # Sift's own internal logging
│   │
│   └── types/
│       └── index.ts                  # All shared types
│
├── tests/
│   ├── fixtures/
│   │   ├── expo-logs.txt             # Sample Expo/Metro logs
│   │   ├── express-logs.txt          # Sample Express logs
│   │   ├── docker-logs.txt           # Sample Docker logs
│   │   ├── mixed-logs.txt            # Mixed service interleaved
│   │   ├── json-logs.txt             # Structured JSON logs
│   │   └── ansi-logs.txt             # Logs with ANSI color codes
│   ├── detector.test.ts
│   ├── parser.test.ts
│   ├── correlator.test.ts
│   ├── buffer.test.ts
│   └── ui.test.tsx
│
├── sift.config.json                  # Example config file
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### Data Flow

```
User runs: sift run
    |
    v
Service Detector (reads package.json, finds scripts)
    |
    v
Process Spawner (spawns each service as child_process)
    |
    v
stdout/stderr streams ──> Line Parser (detects format, extracts metadata)
    |
    v
Parsed Log Entry ──> Ring Buffer (stores with index)
    |
    v
Correlator (matches request IDs across services)
    |
    v
Ink UI (renders: sidebar + log stream + status bar)
    |
    v
User Input (keyboard) ──> Filter / Search / Pause / Scroll
```

---

## 7. Core Features

### 7.1 Service Auto-Detection

Sift reads your `package.json` and automatically detects runnable services:

**Detection rules:**
```javascript
// Standard scripts that indicate services:
const SERVICE_PATTERNS = [
  { script: 'dev',        name: 'web',     type: 'server' },
  { script: 'start',      name: 'server',  type: 'server' },
  { script: 'server',     name: 'api',     type: 'server' },
  { script: 'api',        name: 'api',     type: 'server' },
  { script: 'web',        name: 'web',     type: 'client' },
  { script: 'app',        name: 'app',     type: 'client' },
  { script: 'expo',       name: 'mobile',  type: 'mobile' },
  { script: 'android',    name: 'android', type: 'mobile' },
  { script: 'ios',        name: 'ios',     type: 'mobile' },
  { script: 'metro',      name: 'metro',   type: 'bundler' },
  { script: 'db',         name: 'db',      type: 'database' },
  { script: 'postgres',   name: 'db',      type: 'database' },
  { script: 'redis',      name: 'redis',   type: 'cache' },
  { script: 'stripe',     name: 'stripe',  type: 'webhook' },
  { script: 'tunnel',     name: 'tunnel',  type: 'network' },
];
```

**Example `package.json` and what Sift detects:**
```json
{
  "scripts": {
    "dev": "next dev",
    "server": "nodemon src/index.js",
    "expo": "expo start --clear",
    "db": "docker compose up postgres",
    "stripe": "stripe listen --forward-to localhost:3000/webhook"
  }
}
```

```
$ sift run
  Detected 5 services from package.json:
    ✓ web     → next dev
    ✓ api     → nodemon src/index.js
    ✓ mobile  → expo start --clear
    ✓ db      → docker compose up postgres
    ✓ stripe  → stripe listen --forward-to localhost:3000/webhook

  Starting all services...
  Press [h] for help, [q] to quit
```

### 7.2 Log Parsing

Every log line goes through the parser pipeline:

**Pipeline stages:**

1. **Structured Detection (STEP 1)** — If the line is valid JSON, parse it immediately.
   Extract `level`, `message`, `timestamp`, `requestId` from known fields.
   Skip all regex processing for structured lines.

   Known field mappings for JSON logs:
   - Level: `level`, `severity`, `log_level` (numeric or string)
   - Message: `message`, `msg`, `text`, `@message`
   - Timestamp: `timestamp`, `time`, `ts`, `@timestamp`, `datetime`
   - Service: `service`, `source`, `logger`, `component`, `app`
   - Request ID: `requestId`, `traceId`, `correlationId`, `rid`, `request_id`

2. **ANSI Handling** — Strip color codes for parsing, preserve for display.
   Handle 256-color (`\x1b[38;5;196m`) and True Color (`\x1b[38;2;255;82;82m`).
   Filter cursor movement codes (`\r`, `\x1b[K`, `\x1b[2J`, `\x1b[A/B`).

3. **Format Dispatch** — Route to the appropriate format parser:
   - JSON-line → already handled in step 1
   - Bracketed → `[LEVEL] message` or `[timestamp] LEVEL message`
   - Logfmt → `key=value key2=value2`
   - Access-log → HTTP method/path/status/time
   - Prefixed → `LEVEL: message` or `TIMESTAMP LEVEL message`
   - Docker → `container_name | message`
   - Generic → best-effort regex probing

4. **Timestamp Extraction** (per format):
   | Format | Example |
   |--------|---------|
   | ISO 8601 | `2026-01-15T09:32:15.123Z` |
   | Simple time | `09:32:15` |
   | Time with ms | `09:32:15.123` |
   | Bracketed | `[09:32:15]` |
   | Prefix | `2026-01-15 09:32:15` |
   | Unix ms | `1705312335123` |
   | Relative | `+45ms` |

5. **Log Level Detection:**
   | Level | Patterns |
   |-------|----------|
   | ERROR | `ERROR`, `ERR`, `FATAL`, `CRITICAL`, `✗`, `[error]`, `level:50`, HTTP 5xx |
   | WARN | `WARN`, `WARNING`, `⚠`, `[warn]`, `level:40`, HTTP 4xx |
   | INFO | `INFO`, `LOG`, `ℹ`, `✓`, `[info]`, `level:30`, HTTP 2xx/3xx |
   | DEBUG | `DEBUG`, `DBG`, `[debug]`, `level:20`, `verbose` |
   | TRACE | `TRACE`, `[trace]`, `level:10` |

6. **Request ID Extraction** — From known patterns (see types).

**Parsed Log Entry Type:**
```typescript
interface ParsedLogEntry {
  id: number;                    // Monotonic sequence number
  raw: string;                   // Original line (with ANSI preserved)
  stripped: string;              // Line with ANSI stripped
  service: string;               // Source service name
  stream: 'stdout' | 'stderr';   // Which stream
  timestamp?: Date;              // Parsed timestamp (or undefined)
  level: LogLevel;               // error | warn | info | debug | trace | unknown
  message: string;               // Clean message text
  requestId?: string;            // Correlation ID if found
  metadata?: Record<string, any>; // Extra fields from JSON logs
  display: DisplayEntry;         // Pre-formatted display data
}
```

### 7.3 Request Correlation

When a request flows through multiple services, Sift links them:

```
[09:32:15] web     → POST /api/login            [req:abc-123]
[09:32:15] api     → Login attempt for user@example.com  [req:abc-123]
[09:32:15] api     → SELECT * FROM users WHERE...        [req:abc-123]
[09:32:15] db      → Query executed in 12ms              [req:abc-123]
[09:32:16] api     → JWT generated, expiry 24h           [req:abc-123]
[09:32:16] web     → 200 OK, token sent                  [req:abc-123]
```

**How to view correlated logs:**
- Press `Enter` on a log line with a request ID → shows only that request's trace
- Press `Backspace` → return to full view
- Request traces are shown with a subtle left-border in the service's color

**Important limitation:** Request correlation only works if all your services already emit a shared request/trace ID in a format Sift recognizes. A vanilla Next.js frontend, Express API, and Postgres do NOT share a request ID unless you instrumented distributed tracing (OpenTelemetry, or manual header propagation). This feature requires structured logging with trace IDs — it is not magic. If your stack doesn't emit trace IDs, this feature shows nothing. Consider it an enhancement for teams that already use structured logging, not a zero-config feature.

### 7.4 Ring Buffer

Sift uses a fixed-size ring buffer to store logs in memory:

```typescript
class LogBuffer {
  private entries: ParsedLogEntry[];
  private head: number = 0;
  private size: number = 0;
  private capacity: number = 10000; // Default: 10,000 lines
  private reorderWindowMs: number = 500; // Allow 500ms out-of-order reordering
  private pendingReorder: ParsedLogEntry[] = []; // Buffer for reorder window

  // O(1) append — entries are stored in arrival order
  // A small reorder window handles minor clock skew between services
  append(entry: ParsedLogEntry): void {
    // If entry has a timestamp, hold it briefly for potential reordering
    // This handles the common case: service A and B both log at T,
    // but A's line arrives 200ms before B's due to process scheduling
    //
    // For entries without timestamps, arrival time IS the ordering
    // (see Section 11.10: missing timestamps fallback)
  }

  // O(n) get visible (with filters) — virtual scrolling renders only visible slice
  getVisible(filters: Filters, offset: number, limit: number): ParsedLogEntry[];

  // O(n) search
  search(query: string): ParsedLogEntry[];

  // O(1) count by level
  countByLevel(): Record<LogLevel, number>;
}
```

Note: The buffer stores entries in **arrival order**, not strict timestamp-sorted order. A bounded reorder window (default 500ms) handles minor cross-service clock skew. Full timestamp sorting is deferred to display-time for the visible slice only.

**Key design decision:** Arrival-ordered storage with bounded reorder window.
- Arrival order is O(1) append — fast, correct for the common case
- The 500ms reorder window handles minor clock skew between services
- Cross-process timestamp sorting is unreliable (clock skew, missing timestamps, different formats)
- The visible slice is sorted at display-time (O(k log k) for k visible lines, where k ≈ terminal height)

When the buffer is full, oldest entries are overwritten. This prevents memory leaks during long-running sessions.

### 7.5 Pause / Resume

Press `Space` to pause the stream. While paused:
- New logs are buffered (not lost)
- A "Paused — 23 new logs" indicator appears
- You can scroll, search, and filter existing logs freely
- Press `Space` again to resume — buffered logs are flushed and displayed

### 7.6 Search

Press `/` to open search overlay:
- Type query, results highlighted in real-time
- `n` / `N` to navigate between matches
- Search across: raw text, service name, request ID
- Regex support: `/error|fail|crash/i`
- Escape to close search

---

## 8. Commands & CLI Interface

### `sift run` (Main Command)

```
$ sift run [options]

Options:
  -c, --config <path>    Path to sift.config.json (default: auto-detect)
  -p, --package <path>   Path to package.json (default: ./package.json)
  --buffer <number>      Max log lines to keep in memory (default: 10000)
  --follow <services>    Comma-separated list of services to follow
  --exclude <services>   Comma-separated list of services to exclude
  --json                 Output raw JSON (non-interactive, for piping)
  --file <path>          Read from a log file instead of spawning processes
  --no-detect            Don't auto-detect services, use config only
  -h, --help             Show help
```

### `sift config init`

Creates a `sift.config.json` file in the current directory:

```json
{
  "$schema": "https://sift.dev/schema.json",
  "version": 1,
  "services": [
    {
      "name": "web",
      "command": "npm run dev",
      "cwd": "./frontend",
      "color": "cyan",
      "parser": "javascript"
    },
    {
      "name": "api",
      "command": "npm run server",
      "cwd": "./backend",
      "color": "green",
      "parser": "javascript",
      "env": { "NODE_ENV": "development", "PORT": "3001" }
    },
    {
      "name": "mobile",
      "command": "npx expo start --clear",
      "cwd": "./mobile",
      "color": "magenta",
      "parser": "javascript"
    },
    {
      "name": "db",
      "command": "docker compose up postgres",
      "color": "yellow",
      "parser": "docker"
    }
  ],
  "settings": {
    "bufferSize": 10000,
    "showTimestamp": true,
    "showServiceName": true,
    "stripAnsi": false,
    "defaultFilter": "all",
    "autoScroll": true
  }
}
```

### `sift --file -` (Pipe Mode) — PRIMARY ENTRY POINT

The most reliable way to use Sift: pipe output from any command or existing process.

```bash
# Pipe docker compose logs
docker compose logs -f | sift --file -

# Pipe kubectl logs
kubectl logs -f deployment/api | sift --file -

# Pipe from a running service you didn't start
tail -f /var/log/myapp.log | sift --file -

# Pipe from another tool
concurrently "npm:dev" "npm:server" 2>&1 | sift --file -
```

This sidesteps process spawning entirely — Sift focuses on what it does best: parsing and displaying.

**Why pipe mode is the honest MVP:**
- Works with any existing setup (no need to change how you start services)
- No process lifecycle management (no orphan processes, no restart logic)
- Works on every platform (macOS, Linux, Windows with WSL)
- No `node-pty`, no TTY allocation, no signal handling complexity

### `sift --version`

```
$ sift --version
sift 1.0.0
```

---

## 9. Log Parsing Engine

### Parser Registry

Each parser handles one **format shape**, not one language. The registry auto-selects based on:
1. Explicit assignment in config (`parser: "json-line"`)
2. Service name heuristics (`docker` → docker parser)
3. Content-based detection (per-line adaptive, not "first 10 lines")
4. Fallback to generic parser

**Why by format, not language:**
Pino, Winston, and Bunyan are all "JavaScript" but have completely different shapes. Meanwhile Pino JSON, Go's Zap JSON, and Python structlog JSON are nearly identical across languages. Organizing by format shape collapses parser sprawl.

**Format detection strategy (per-line, adaptive):**
1. Try JSON-line first (structured — cheapest to identify)
2. Try known prefix patterns (bracketed, logfmt, access-log)
3. Fall back to generic regex probing
4. Once a format is identified for a service, compile a combined regex and stop probing

**Note on detection:** "First 10 lines" sampling is unreliable because startup banners (Next.js, Vite, Nest) look nothing like steady-state logs. Detection is per-line and re-evaluates after the initial banner settles.

### JSON-Line Parser

Handles all structured JSON logs regardless of language:
- **Pino** (JS): `{ "level": 30, "msg": "request completed", "responseTime": 45 }`
- **Winston** (JS): `{ "level": "info", "message": "Server started", "timestamp": "2026-01-15T09:32:15.123Z" }`
- **Bunyan** (JS): `{ "name": "myapp", "level": 30, "msg": "hello" }`
- **Zap** (Go): `{"level":"info","ts":1705312335.123,"msg":"request","duration":45}`
- **structlog** (Python): `{"level": "info", "message": "request", "timestamp": "2026-01-15T09:32:15Z"}`

Extracts: `level`, `message`/`msg`, `timestamp`/`time`/`ts`, `service`, `requestId`/`traceId`

### Bracketed Parser

Handles `[LEVEL]` and `[timestamp]` formats:
- **env_logger** (Rust): `[2026-01-15T09:32:15Z INFO mycrate] Server started`
- **Metro** (React Native): ` BUNDLE  ./index.js ▓▓▓▓▓▓▓▓░░░░ 67% (120/180)`
- **Console**: `[09:32:15] GET /api/users 200 45ms`
- **Many CLIs**: `[INFO] Server started on port 3000`

### Logfmt Parser

Handles `key=value` pairs:
- **Logrus** (Go): `time="2026-01-15T09:32:15Z" level=info msg="request"`
- **Heroku**: `app=web status=200 elapsed=45ms`
- **systemd**: `PRIORITY=6 SYSLOG_IDENTIFIER=myapp MESSAGE=Server started`

### Access-Log Parser

Handles HTTP request logs:
- **morgan** (Express): `::1 - - [15/Jan/2026:09:32:15 +0000] "GET /api/users HTTP/1.1" 200 45ms`
- **Apache CLF**: `127.0.0.1 - - [15/Jan/2026:09:32:15 +0000] "GET / HTTP/1.1" 200 1234`
- **Nginx**: `127.0.0.1 - - [15/Jan/2026:09:32:15 +0000] "GET /api HTTP/1.1" 200 45 "-" "curl/7.68.0"`
- **Uvicorn** (Python): `INFO:     127.0.0.1:1234 - "GET /health HTTP/1.1" 200 OK`
- **Django**: `[15/Jan/2026 09:32:15] "GET /api/users HTTP/1.1" 200 45`

**HTTP status code → level mapping:**
- 5xx → error
- 4xx → warn
- 3xx → info
- 2xx → info

### Prefixed Parser

Handles `LEVEL: message` and `TIMESTAMP LEVEL message` formats:
- **Next.js**: ` GET /dashboard 200 in 45ms`
- **Vite**: `9:32:15 AM [vite] hmr update /src/App.tsx`
- **Python standard**: `2026-01-15 09:32:15,123 - myapp - INFO - Server started`
- **Go standard**: `2026/01/15 09:32:15 http: GET /api/users 200 45ms`

### Docker Parser

Handles:
- **Standard Docker logs**: `web_1  | [09:32:15] GET /users 200`
- **Docker Compose**: `api-web-1   | {"level":"info","message":"request"}`
- **Container ID prefix**: `a1b2c3d4e5f6 [INFO] Server started`

### Generic Parser (Fallback)

When no specific parser matches:
1. Look for timestamp at start of line
2. Look for level keywords anywhere in the line
3. Treat the rest as the message
4. Attempt JSON parsing if the line starts with `{` or `[

---

## 10. Terminal UI Specification

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Sift v1.0.0                                          [h] Help [q] │
│                                                                      │
│  ┌─ Services ──────────────┐                                         │
│  │ ▶ web     ● 142 logs    │  [09:32:15] web     GET /api/users 200 │
│  │   api     ● 89 logs     │  [09:32:15] api     SELECT users 12ms │
│  │   mobile  ● 234 logs    │  ⚠ [09:32:16] api   Deprecation warn  │
│  │   db      ● 12 logs     │  [09:32:16] mobile  BUNDLE complete   │
│  │   stripe  ● 3 logs      │  [09:32:17] web     HMR update /App   │
│  │                           │  ✗ [09:32:18] api   ERROR: Timeout    │
│  │  3 errors  2 warnings    │  [09:32:18] db      Connection pool   │
│  │                           │  [09:32:19] api     Retry attempt 2   │
│  └───────────────────────────┘  [09:32:20] api     200 OK (retry)   │
│                                                                      │
│  ── Filters: [all] [error] [warn] [info] ── Search: /timeout ─────── │
│                                                                      │
│  Paused — 23 new logs                    5 services  480 total       │
└──────────────────────────────────────────────────────────────────────┘
```

### Color Scheme

```typescript
// src/ui/theme.ts
export const theme = {
  // Service colors — distinct hues, avoiding red/green confusion
  // Selected for protanopia/deuteranopia (red-green) accessibility
  services: [
    '#00BCD4', // Cyan
    '#2196F3', // Blue
    '#9C27B0', // Purple
    '#FF9800', // Orange
    '#607D8B', // Blue-grey
    '#E91E63', // Pink
    '#3F51B5', // Indigo
    '#795548', // Brown
    '#009688', // Teal
    '#FFC107', // Amber
  ],

  // Log levels — shape + color, not color alone
  // Each level has a unique prefix symbol for non-color identification
  levels: {
    error:   { fg: '#F44336', bg: '#3A1A1A', bold: true, symbol: '✗' },
    warn:    { fg: '#FF9800', bg: '#3A2A0A', bold: false, symbol: '⚠' },
    info:    { fg: '#E0E0E0', bg: undefined, bold: false, symbol: 'ℹ' },
    debug:   { fg: '#90A4AE', bg: undefined, bold: false, symbol: '◆' },
    trace:   { fg: '#78909C', bg: undefined, bold: false, symbol: '···' },
    unknown: { fg: '#B0BEC5', bg: undefined, bold: false, symbol: '?' },
  },

  // UI chrome
  sidebar:      { fg: '#E0E0E0', bg: '#263238' },
  statusBar:    { fg: '#FFFFFF', bg: '#37474F' },
  statusError:  { fg: '#FFFFFF', bg: '#D32F2F' },
  statusWarn:   { fg: '#000000', bg: '#FBC02D' },
  highlight:    { fg: '#212121', bg: '#FFEB3B' },
  selection:    { fg: '#FFFFFF', bg: '#1565C0' },
  border:       { fg: '#455A64' },
  muted:        { fg: '#78909C' },
};
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll through logs (1 line) |
| `PgUp` / `PgDn` | Scroll (10 lines) |
| `Home` / `End` | Jump to first / last log |
| `Space` | Pause / resume stream |
| `/` | Open search overlay |
| `n` / `N` | Next / previous search match |
| `f` | Toggle filter panel |
| `e` | Filter: show only errors |
| `w` | Filter: show only warnings |
| `i` | Filter: show only info |
| `a` | Filter: show all |
| `s` + number | Toggle service visibility (s1, s2, etc.) |
| `Enter` | On log with requestId → show trace view |
| `Backspace` / `Esc` | Exit trace view / close overlay |
| `d` | Show detail view for selected log |
| `c` | Copy selected log to clipboard |
| `1-9` | Jump to service N in sidebar |
| `r` | Restart selected service |
| `k` | Kill selected service |
| `o` | Open service's cwd in terminal |
| `l` | Toggle line wrapping |
| `t` | Toggle timestamps |
| `h` / `?` | Show help overlay |
| `q` / `Ctrl+C` | Quit Sift |

### Service Sidebar

- Shows all services with their status indicator
- `●` = running, `○` = stopped, `◐` = starting, `✗` = crashed
- Service name in its assigned color
- Log count per service
- Bottom of sidebar: error count + warning count

### Status Bar

Shows (left to right):
1. **Status**: `Running` (green) / `Paused` (yellow) / `N services crashed` (red)
2. **Filters**: Currently active filters
3. **Search**: Active search query (if any)
4. **Stats**: `5 services | 480 logs | 3 errors | 2 warnings`
5. **Help hint**: `h for help`

---

## 11. Edge Cases & Handling

This section is comprehensive. Every edge case Sift must handle is documented here.

### 11.1 Very High Log Volume

**Problem:** A service outputs thousands of lines per second (e.g., debug mode, request spam). The UI can't render that fast.

**Solution:**
- Implement a **render throttle**: maximum 60 UI updates per second (16ms interval)
- During high-volume bursts, batch log entries: update the buffer continuously, but only render the latest snapshot
- Show a brief indicator: `⚡ High volume — 1,247 lines/s`
- The ring buffer still captures all lines (up to capacity), just the display throttles
- If volume exceeds parsing capacity, switch that service to "raw passthrough" mode (show lines without full parsing)

### 11.2 Multi-Line Log Entries

**Problem:** Stack traces, SQL queries, JSON objects span multiple lines.

```
Error: Cannot read property 'id' of undefined
    at validateUser (/app/src/auth.js:45:12)
    at /app/src/routes.js:23:10
    at Layer.handle (/app/node_modules/express/router.js:96:5)
```

**Solution:**
- Detect continuation lines by:
  1. Lines starting with whitespace + `at ` (stack traces)
  2. Lines that are valid JSON continuation (unclosed `{` or `[`)
  3. Lines without a detected timestamp AND without a detected log level
  4. Indentation > 2 spaces from the previous line
- Multi-line entries are stored as a single `ParsedLogEntry` with `message` containing all lines
- In the UI, show the first line collapsed, `Enter` to expand
- Stack traces are syntax-highlighted (file paths in cyan, line numbers in yellow)

### 11.3 ANSI Color Code Handling

**Problem:** Child processes output ANSI color codes. Sift must either strip them (for parsing) or preserve them (for display).

**Solution:**
- **Never strip ANSI from the `raw` field** — always preserve the original
- Strip ANSI only for parsing (using the `stripped` field)
- For display: if the log has ANSI codes, render them. If not, apply Sift's own coloring based on detected level
- Services that already color-code their output look correct
- Services that don't get Sift's intelligent coloring
- Handle 256-color codes (`\x1b[38;5;196m`) and True Color (`\x1b[38;2;255;82;82m`)
- Handle cursor movement codes (ignore them — they break layout):
  - `\r` (carriage return) → treat as line overwrite, keep the last segment
  - `\x1b[K` (clear to end of line) → ignore
  - `\x1b[2J` (clear screen) → ignore, don't clear Sift's buffer
  - `\x1b[A`, `\x1b[B` (cursor up/down) → ignore

### 11.4 Service Crash & Restart

**Problem:** A service crashes (exits with non-zero code). What should Sift do?

**Solution:**
1. Detect process exit via `child.on('exit')` or `child.on('close')`
2. Log the exit in Sift's own stream: `✗ api exited with code 1 (after 4m 23s)`
3. Update service status to `✗ crashed`
4. Show a prominent banner: `api has crashed. Press [r] to restart.`
5. If `--restart` flag is set (or config has `autoRestart: true`), automatically restart after 2 seconds
6. Track restart count: if a service crashes 3 times within 30 seconds, mark it as `unstable` and stop auto-restarting
7. Preserve the crashed service's logs in the buffer (they're still valuable for debugging)

### 11.5 Services Started Outside Sift — Pipe Mode (Recommended)

**Problem:** A developer already has services running (e.g., Docker started separately, PM2, systemd). They want to use Sift without restarting.

**Solution:** Use pipe mode — the most reliable entry point:
```bash
docker compose logs -f | sift --file -
kubectl logs -f deployment/api | sift --file -
tail -f /var/log/myapp.log | sift --file -
```

This sidesteps process spawning entirely. Sift focuses on parsing and displaying, not process lifecycle management.

**Why pipe mode over attach:**
Reading `/proc/<pid>/fd/1` does not passively tee another process's output — that fd is a shared file description, so if stdout is a terminal you'll be racing for bytes (stealing them). `dtrace` on macOS is blocked by SIP on normal machines. Pipe mode works everywhere Unix pipes work, with no OS-level tricks.

### 11.6 Binary Data in stdout

**Problem:** A process accidentally writes binary data to stdout (e.g., a corrupted Buffer.toString()). This can break the terminal.

**Solution:**
- Check each chunk for non-printable characters (>10% non-printable bytes)
- If binary detected: replace the line with `[binary data: 2.4KB] — non-printable output suppressed`
- Log a warning in Sift's internal stream: `⚠ api output non-printable data (2.4KB), suppressed`
- Do NOT pass binary data to the Ink renderer (will crash)
- Offer a `--hex-dump` flag for debugging: show hex representation of suppressed data

### 11.7 Interleaved Output

**Problem:** With 5+ services, logs arrive asynchronously and would interleave chaotically.

**Solution:**
- Each service has its own readable stream handler
- All parsed entries go into a single, timestamp-sorted ring buffer
- The UI renders from the buffer (which is sorted), not directly from streams
- If timestamps are missing, use arrival time as the timestamp
- If two entries have the same timestamp, sort by service definition order (config order)

### 11.8 Terminal Resize

**Problem:** User resizes the terminal window. UI must adapt.

**Solution:**
- Listen for `SIGWINCH` (Unix) or `process.stdout.on('resize')` (Node.js)
- Recalculate layout dimensions on resize:
  - Terminal width < 80: hide sidebar, full-width log stream
  - Terminal width 80-120: sidebar 25%, log stream 75%
  - Terminal width > 120: sidebar 20%, log stream 80%
  - Terminal height < 15: show only log stream (no status bar, no filter bar)
- Re-render immediately on resize
- Persist scroll position relative to bottom

### 11.9 Unicode and Emoji in Logs

**Problem:** Logs may contain emoji, CJK characters, or other wide Unicode.

**Solution:**
- Use a Unicode-aware string width library (like `string-width`) for correct alignment
- Emoji take 2 columns — account for this in layout calculations
- Don't truncate mid-emoji or mid-grapheme-cluster
- Normalize NFC for consistent comparison in search

### 11.10 Services Without Timestamps

**Problem:** Some services don't output timestamps (e.g., `echo` in a script, simple Python print).

**Solution:**
- If no timestamp is detected, use the arrival time (when Sift received the line)
- Display as `[--:--:--]` in a muted color to indicate it's inferred
- Config option: `injectTimestamps: true` — Sift prepends `[HH:MM:SS]` to lines without timestamps

### 11.11 Process Stderr vs Stdout

**Problem:** A service may write errors to stdout and info to stderr (yes, this happens), or vice versa.

**Solution:**
- Read both `stdout` and `stderr` streams for each process
- Tag each line with its source stream (`stdout` or `stderr`)
- Default heuristic: stderr lines are treated as one level higher (stdout INFO → stderr WARN)
- But still parse the actual content for level detection (stderr might just have info logs)
- Show a small indicator: `⌁` for stderr lines (in muted color)

### 11.12 Zombie / Orphan Processes

**Problem:** Sift crashes or is killed with `kill -9`. Child processes keep running as orphans.

**Solution:**
- Use `process.on('exit')` and `process.on('SIGINT')` to kill all children before exiting
- Use Node.js `child.unref()` carefully — only on services that should outlive Sift
- On Sift startup, check for previously orphaned processes (match by command pattern) and offer to kill them
- Use process groups (`detached: false` by default) so SIGINT propagates
- Support `sift kill` command to find and kill Sift-managed processes

### 11.13 Log Lines Without Newlines

**Problem:** A process writes output without a trailing newline (e.g., progress bars, `process.stdout.write`).

**Solution:**
- Buffer incoming chunks until a newline is received
- For chunks without a newline, append to a pending buffer
- If the pending buffer exceeds 4096 bytes without a newline, force-flush it as a complete line
- Progress bar lines (ending in `\r`) are handled specially: store the latest version, overwrite in display

### 11.14 Empty Services (No Output)

**Problem:** A service starts but produces no output for a long time (e.g., a background worker). User doesn't know if it's running.

**Solution:**
- Show a heartbeat indicator in the sidebar: `◐ starting...` → `● running` → `○ idle` (after 30s of no output)
- Show last-output time: `● api (idle 2m)`
- Configurable idle timeout

### 11.15 Circular JSON in Logs

**Problem:** A service logs a JavaScript object with circular references. `JSON.stringify` fails.

**Solution:**
- The parser attempts `JSON.parse` on each line
- If parse fails, treat as plain text (generic parser)
- If a partial JSON is detected (starts with `{` but never closes), wait for continuation lines
- Circular references in logged JSON are the service's problem — Sift can't fix that

### 11.16 Very Long Single Lines

**Problem:** A single log line is 5,000+ characters (e.g., a massive SQL query, a dumped JSON object).

**Solution:**
- Default: truncate display at terminal width, show `…` at the end
- Press `l` to toggle line wrapping
- In detail view (`d`), show the full line with scrolling
- Store the full line in the buffer regardless (truncation is display-only)

### 11.17 Keyboard Input Conflicts

**Problem:** Services that read from stdin (e.g., interactive CLIs, REPLs) will conflict with Sift's keyboard handling.

**Solution:**
- Sift captures all keyboard input by default
- Press `Shift+Tab` to "focus" a service — keyboard input is then forwarded to that service's stdin
- A prominent indicator shows which service has focus: `Input focused on: api`
- Press `Shift+Tab` again to cycle through services
- Press `Esc` to return focus to Sift
- Services marked as `interactive: true` in config are never auto-focused

### 11.18 Log File Rotation

**Problem:** When using `--file` mode, the log file may be rotated (moved/archived, new file created).

**Solution:**
- Use `fs.watch` on the log file directory
- If the file is renamed or deleted, attempt to reopen it
- If a new file with the same name appears, start reading from it
- Show a notification: `📄 Log file rotated, re-opened`

### 11.19 Multiple Services with Same Name

**Problem:** A monorepo has multiple `package.json` files, each with a `dev` script. Auto-detection would name them all "web".

**Solution:**
- Use the directory name as a prefix: `web` (from `./frontend/`) and `web-dashboard` (from `./dashboard/`)
- Config allows explicit naming to disambiguate
- Detection walks subdirectories for additional `package.json` files (up to 2 levels deep)

### 11.20 Services with Interactive TUI

**Problem:** A service has its own terminal UI (e.g., `vitest --ui`, `htop`, `npm init`).

**Solution:**
- Detect interactive TUIs by checking if the process requests a TTY (`process.stdin.isTTY`)
- Services requesting a TTY are started in a separate pseudo-terminal (using `node-pty`)
- Render their output in a dedicated panel (like a terminal within Sift)
- Config option: `tty: true` to force TTY allocation

### 11.21 Logs Containing Secrets or PII

**Problem:** Logs routinely carry JWTs, API keys, connection strings, credit card numbers, and personally identifiable information.

**MVP handling:**
- Sift stores whatever it receives in the ring buffer (in memory only, no disk persistence in MVP)
- Buffer is overwritten on rotation — secrets don't accumulate indefinitely
- No log sharing/export in MVP (the hardest part of anonymization)

**Post-MVP:**
- Optional secret redaction via configurable regex patterns
- PII masking for shared log exports
- These features require careful design; they are explicitly not in MVP

---

## 12. Configuration System

### Config File Resolution Order

Sift looks for config in this order (first found wins):
1. `--config <path>` (CLI flag)
2. `./sift.config.json` (current directory)
3. `./.siftrc` (dotfile alternative)
4. `~/.config/sift/config.json` (global config)
5. Auto-detect from `package.json` (if found)
6. Built-in defaults (show help and exit if no services found)

### Service Definition Schema

```typescript
interface ServiceConfig {
  name: string;                    // Unique identifier
  command: string;                 // Shell command to run
  cwd?: string;                    // Working directory (default: .)
  env?: Record<string, string>;    // Extra environment variables
  color?: string;                  // Override auto-assigned color
  parser?: string;                 // Parser to use (auto-detected if omitted)
  dependsOn?: string[];            // Start after these services are ready
  // Validation: Sift detects dependency cycles on startup and exits with an error.
  // Example of a cycle: A depends on B, B depends on C, C depends on A.
  readyPattern?: string;           // Regex to detect "service is ready"
  readyTimeout?: number;           // Seconds to wait for readyPattern (default: 30)
  restart?: 'never' | 'on-failure' | 'always';  // Auto-restart policy
  maxRestarts?: number;            // Max restarts in 30s before giving up
  tty?: boolean;                   // Allocate pseudo-terminal
  interactive?: boolean;           // Reads from stdin
  suppress?: boolean;              // Hide from UI sidebar (logs still go to ring buffer)
  prefix?: string;                 // Custom log prefix (default: service name)
}

interface SiftConfig {
  $schema?: string;
  version: number;
  services: ServiceConfig[];
  settings?: {
    bufferSize?: number;           // Default: 10000
    showTimestamp?: boolean;       // Default: true
    showServiceName?: boolean;     // Default: true
    showStreamIndicator?: boolean; // Default: false
    stripAnsi?: boolean;           // Default: false
    injectTimestamps?: boolean;    // Default: false
    autoScroll?: boolean;          // Default: true
    autoRestart?: boolean;         // Default: false
    theme?: 'dark' | 'light';      // Default: dark
    sidebarWidth?: number;         // Default: 25 (% of terminal)
    dateFormat?: string;           // Default: 'HH:MM:SS'
  };
}
```

### Service Dependency Graph

```json
{
  "services": [
    { "name": "db", "command": "docker compose up postgres" },
    { "name": "redis", "command": "redis-server" },
    { "name": "api", "command": "npm run server", "dependsOn": ["db", "redis"], "readyPattern": "Server listening on port" },
    { "name": "web", "command": "npm run dev", "dependsOn": ["api"] }
  ]
}
```

Sift starts services in topological order. `api` waits until `db` and `redis` have output their `readyPattern` (or timeout).

---

## 13. Performance & Memory Management

### Memory Budget

| Component | Budget | Strategy |
|-----------|--------|----------|
| Log buffer | ~20MB (10,000 lines avg) | Ring buffer, overwrites old entries |
| Parsed entries | 30MB | Object pooling for repeated strings |
| UI render state | 5MB | Only render visible portion |
| Process handles | 2MB | Lazy spawn, eager cleanup |
| **Total** | **~60MB** | Acceptable for a dev tool |

**Memory note:** The real memory risk is storing multiple copies of the same text. `ParsedLogEntry` stores both `raw` (with ANSI) and `stripped` (without ANSI), plus a pre-formatted `display` field. That's 2-3 copies per line. The optimization target is deduplicating the message text, not string interning (which only helps for repeated tokens like service/level names).

### Performance Targets

| Metric | Target |
|--------|--------|
| Startup time | < 500ms (all services spawned, UI rendered) |
| Log ingestion | > 5,000 lines/second (per service) |
| UI render | Throttled to 16ms max | Batched updates, virtual scrolling |
| Search | < 100ms for 10,000 lines |
| Filter toggle | < 50ms |
| Scroll | Throttled to 16ms max | Virtual scrolling, no jank |

### Optimizations

1. **Virtual scrolling**: Only render visible log lines (±5 buffer), not the entire buffer
2. **String interning**: Common strings (service names, level names) are interned
3. **Lazy parsing**: Full parsing happens on ingestion, but heavy operations (correlation graph) are deferred
4. **Render batching**: Group UI updates, render at most once per frame
5. **Backpressure**: If a service produces logs faster than they can be parsed, show raw lines with a warning indicator until parsing catches up

---

## 14. MVP Development Roadmap

### Phase 1: Foundation (Days 1-5)

**Day 1: Project Scaffold**
- [ ] Initialize Node.js + TypeScript project with `"type": "module"`
- [ ] Install dependencies (commander, ink, ink-text-input, chalk, strip-ansi, conf, vitest, tsup)
- [ ] Write all TypeScript types
- [ ] Set up ESM project structure and tsup config
- [ ] First commit: `scaffold: ESM project structure`

**Day 2: Core Engine**
- [ ] `detector.ts` — Auto-detect services from `package.json` scripts
- [ ] `spawner.ts` — Spawn processes, manage stdout/stderr streams
- [ ] `parser.ts` — Core parsing pipeline (format-first: JSON, bracketed, prefixed)
- [ ] Tests for core modules
- [ ] Commit: `feat: core engine`

**Day 3: Format Parsers**
- [ ] `json-line.ts` — JSON structured logs
- [ ] `bracketed.ts` — [LEVEL] message format
- [ ] `prefixed.ts` — LEVEL: message format
- [ ] `access-log.ts` — HTTP access logs with status→level mapping
- [ ] `generic.ts` — Fallback parser
- [ ] Parser registry and auto-detection
- [ ] Commit: `feat: format parsers`

**Day 4-5: Basic UI**
- [ ] `App.tsx` — Root Ink component with layout
- [ ] `ServiceSidebar.tsx` — Service list with status
- [ ] `LogStream.tsx` — Virtual scrolling log view
- [ ] `StatusBar.tsx` — Stats display
- [ ] Pause/resume, basic scroll
- [ ] Commit: `feat: basic terminal UI`

### Phase 2: Interactions (Days 6-10)

**Day 6-7: Search & Filter**
- [ ] Search overlay with real-time highlight
- [ ] Filter by service (s1, s2, etc.)
- [ ] Filter by level (e/w/i)
- [ ] Show all / clear filters

**Day 8-9: Edge Cases**
- [ ] ANSI preservation for display
- [ ] Multi-line entry detection (stack traces)
- [ ] Terminal resize handling
- [ ] High-volume render throttling

**Day 10: Polish**
- [ ] Detail view for stack traces
- [ ] Service crash detection
- [ ] Keyboard shortcuts help overlay
- [ ] Config file support (`sift.config.json`)

### Phase 3: Ship (Days 11-15)

**Day 11-12: Pipe Mode & Config**
- [ ] `sift --file -` pipe mode (primary entry point)
- [ ] `sift config init` interactive generator
- [ ] Config validation and schema

**Day 13-14: Testing**
- [ ] Test fixtures for all supported formats
- [ ] Integration tests against fixtures
- [ ] Performance tests (high-volume ingestion)

**Day 15: Distribution**
- [ ] README with screenshots
- [ ] `package.json` with ESM config, bin, keywords
- [ ] Build and test install
- [ ] GitHub repo, LICENSE, first release

### Phase 4: Marketing Website (Days 16-20)

**Goal:** Build a public-facing website that explains Sift, showcases its features, and drives adoption — especially among developers currently using `concurrently` or raw `docker compose logs`.

**Day 16: Design & Content**
- [ ] Define site structure: Hero, Features, Demo, Docs, Install, GitHub link
- [ ] Write marketing copy from the PRD (problem, differentiation, target users)
- [ ] Create wireframes / design direction (single-page landing, terminal aesthetic)
- [ ] Gather assets: screenshots, GIFs/asciinema of Sift in action
- [ ] Commit: `docs: marketing site content and wireframes`

**Day 17: Site Scaffold**
- [ ] Initialize website project (e.g., `site/` with Next.js or Vite + static export)
- [ ] Set up Tailwind or equivalent styling that matches Sift's terminal UI palette
- [ ] Build reusable components: TerminalWindow, FeatureCard, CodeBlock, Nav, Footer
- [ ] Commit: `feat: marketing site scaffold and base components`

**Day 18: Pages & Demo**
- [ ] Implement landing page with animated terminal demo (video or embedded player)
- [ ] Implement `/docs` with quickstart, commands reference, and config examples
- [ ] Implement `/install` with copy-paste install commands for npm/pnpm/yarn
- [ ] Add responsive navigation and mobile layout
- [ ] Commit: `feat: marketing site pages and demo`

**Day 19: Polish & Integrations**
- [ ] Add SEO metadata, Open Graph / Twitter card tags, favicon and Star on Github button
- [ ] Add dark/light mode toggle (default dark to match terminal aesthetic)
- [ ] Set up GitHub link, npm badge, license badge
- [ ] Commit: `feat: marketing site polish and SEO`

**Day 20: Deploy**
- [ ] Configure static export / build for hosting (Vercel, Netlify, Cloudflare Pages, or GitHub Pages)
- [ ] Set up custom domain or subdomain (e.g., `sift.dev`)
- [ ] Add CI workflow to deploy on push to `main`
- [ ] Verify deployment, links, and Lighthouse score
- [ ] Commit: `chore: deploy marketing website`

**Explicitly OUT of MVP:**
- Request correlation (requires pre-instrumented tracing)
- `sift attach` (infeasible as specified)
- Interactive TTY panels (node-pty is its own multi-week project)
- Service dependency graph with topological ordering
- Auto-restart with backoff
- Log export / JSON mode
- Metrics dashboard
- SQLite persistence
- Plugin system
- Remote SSH tailing
- CI mode

---

## 15. Testing Strategy

### Test Fixtures

```
tests/fixtures/
├── express-combined.log      # Morgan combined format
├── express-dev.log           # Morgan dev format
├── winston-json.log          # Winston JSON output
├── pino.log                  # Pino output
├── bunyan.log                # Bunyan output
├── metro-bundler.log         # React Native Metro
├── nextjs.log                # Next.js dev server
├── vite.log                  # Vite HMR logs
├── docker-compose.log        # Docker Compose multi-service
├── python-standard.log       # Python standard logging
├── python-uvicorn.log        # Uvicorn/FastAPI
├── go-standard.log           # Go standard log
├── go-logrus.log             # Logrus format
├── rust-env_logger.log       # Rust env_logger
├── rust-tracing.log          # Rust tracing
├── multiline-stacktrace.log  # Multi-line stack traces
├── ansi-colored.log          # Logs with ANSI codes
├── high-volume.log           # 10,000 lines of rapid output
├── json-structured.log       # Generic JSON structured logs
└── mixed-interleaved.log     # Multiple services interleaved
```

### Test Coverage Goals

| Module | Target | Key Cases |
|--------|--------|-----------|
| `detector.ts` | 90% | Auto-detect from package.json, subdirectories, missing package.json |
| `spawner.ts` | 85% | Spawn, kill, restart, crash detection, TTY allocation |
| `parser.ts` | 95% | All timestamp formats, all level patterns, JSON, multi-line, ANSI |
| `buffer.ts` | 95% | Ring buffer wrap, filtering, search, memory limits |
| `correlator.ts` | 90% | Request ID extraction, cross-service matching, trace view |
| `ui/` | 70% | Render without crash, keyboard handling, resize |

---

## 16. Distribution

### Package

```json
{
  "name": "sift-logs",
  "version": "1.0.0",
  "description": "Intelligent log aggregator for local development — the htop of dev logs",
  "type": "module",
  "bin": { "sift": "./dist/cli.js" },
  "exports": {
    ".": {
      "import": "./dist/cli.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/cli/index.ts --format esm --minify --clean",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["logs", "logging", "developer-tools", "cli", "terminal", "monitoring", "devops"],
  "author": "Abdul-Qudus Rufai",
  "license": "MIT",
  "engines": { "node": ">=18.0.0" }
}
```

### Build Config

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  minify: true,
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

### Install

```bash
npm install -g sift-logs
```

### Run

```bash
sift run                    # Auto-detect from package.json
sift run -c sift.config.json  # Use custom config
sift --file -               # Pipe mode (read from stdin)
sift config init            # Create config file
```

**Platform Support:**
- macOS: Full support (primary development platform)
- Linux: Full support
- Windows: Via WSL2. Native Windows support is not in MVP (relies on Unix signals and process model).

**Node Version:** Requires Node.js 18+ (ESM native). Install via `nvm` or official installer.

---

## 17. Future Features (Post-MVP)

**North Star:** Everything in this section serves the local multi-service development loop. Features that don't (CI mode, remote monitoring) are parked here as notes, not commitments. Sift is a local dev tool first.

### 17.1 Language Parsers

Implemented in `src/parsers/language.ts`:

- [x] Python full support (standard logging, Django dev server, Flask/Werkzeug, FastAPI/Uvicorn)
- [x] Go full support (native `log`, Logrus key=value, Zap production/development)
- [x] Rust full support (`env_logger`, `tracing`, `slog`)
- [x] Ruby (Rails logger)
- [x] Elixir (Phoenix logger)

### 17.2 Metrics Dashboard

Implemented in `src/core/metrics.ts` and `src/utils/http.ts`:

- [x] Request rate per service (requests/minute)
- [x] Error rate over time (sparkline in status bar)
- [x] Average response time
- [x] Service health indicators (green/yellow/red based on error ratio)

### 17.3 Log Persistence
- [x] Save session to SQLite database
- [x] Query past sessions: `sift replay --session yesterday`
- [x] Compare two sessions: `sift diff session1 session2`
- [x] Update it on the site also, the commands and all

### 17.6 CI Mode (Parked — Contradicts Local-Dev Focus)

> **Why parked:** CI mode contradicts Sift's core positioning as a local dev tool. Non-interactive JSON output is a different product. If needed, use `sift --file -` piped to `jq` instead.

- `sift ci` — non-interactive, outputs JSON/JUnit
- Fails on error threshold (e.g., > 0 errors)
- Integrates with GitHub Actions annotations

### 17.7 Remote Services
- `sift remote ssh://server.prod` — tail logs from remote servers
- Supports SSH tunneling for secure access

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-15 | Abdul-Qudus Rufai | Initial comprehensive PRD with 20 edge cases |
| 1.1 | 2026-07-10 | Abdul-Qudus Rufai | Post-review fixes: competitive landscape, ESM build, realistic MVP, pipe mode, parser reorganization, colorblind palette, attach removal |

---

*End of PRD*
