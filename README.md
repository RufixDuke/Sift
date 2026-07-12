# Sift — Intelligent Log Aggregator for Local Development

Sift is the `htop` of local development logging. It aggregates, parses, categorizes, and presents logs from all your running services in a single, beautiful, interactive terminal interface — so you can find what matters without scrolling through five terminal tabs.

**Core Philosophy:**

- **Aggregate** — One pane, all services. No more tab-switching.
- **Parse** — Understands log levels, timestamps, service names, and request IDs automatically.
- **Correlate** — Traces a single request across multiple services (when trace IDs are present).
- **Filter** — Search, filter by service, level, or time — in real-time.
- **Pause** — Spacebar pauses the display; logs keep buffering in the background.

## Installation

```bash
npm install -g sift-logs
```

Requires Node.js 18+.

## Quick Start

### Pipe mode (recommended)

The most reliable way to use Sift with any existing setup:

```bash
# Docker Compose
docker compose logs -f | sift run --file -

# Kubernetes
kubectl logs -f deployment/api | sift run --file -

# Existing tool output
concurrently "npm:dev" "npm:server" 2>&1 | sift run --file -
```

### Run services directly

From a project with a `package.json`, Sift auto-detects runnable services:

```bash
sift run
```

## CLI Commands

```bash
sift run [options]          # Run detected services and aggregate logs
sift replay [options]       # Replay a persisted log session
sift diff <sessionA> <sessionB>  # Compare two persisted sessions
sift config init            # Create sift.config.json
sift --version              # Show version
```

### `sift run` options

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to `sift.config.json` |
| `-p, --package <path>` | Path to `package.json` |
| `--buffer <number>` | Max log lines in memory (default: 10000) |
| `--follow <services>` | Comma-separated list of services to follow |
| `--exclude <services>` | Comma-separated list of services to exclude |
| `--no-detect` | Do not auto-detect services |
| `--file <path>` | Read from log file or stdin (`-`) |
| `--strip-ansi` | Strip ANSI color codes from output |
| `--session-name <name>` | Name for the saved session |
| `--no-save` | Do not persist this session to SQLite |

## Log persistence

Every `sift run` session is saved to a local SQLite database at `~/.config/sift/sift.db`
(unless you pass `--no-save`). Replay previous sessions or compare two runs:

```bash
sift replay --session yesterday
sift diff session1 session2
```

Session identifiers can be a name, id, or alias (`last`, `today`, `yesterday`).

## Example `sift.config.json`

```json
{
  "$schema": "https://sift.dev/schema.json",
  "version": 1,
  "services": [
    {
      "name": "web",
      "command": "npm run dev",
      "cwd": "./frontend",
      "color": "cyan"
    },
    {
      "name": "api",
      "command": "npm run server",
      "cwd": "./backend",
      "color": "green"
    }
  ],
  "settings": {
    "bufferSize": 10000,
    "showTimestamp": true,
    "showServiceName": true,
    "theme": "dark"
  }
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll logs |
| `PgUp` / `PgDn` | Scroll 10 lines |
| `Space` | Pause / resume |
| `/` | Search |
| `n` / `N` | Next / previous search match |
| `e` | Filter errors |
| `w` | Filter warnings |
| `i` | Filter info |
| `a` | Show all levels |
| `s1` … `s9` | Toggle service visibility |
| `d` | Detail view |
| `h` / `?` | Help overlay |
| `q` / `Ctrl+C` | Quit |

## Supported Log Formats

- JSON structured logs (Pino, Winston, Bunyan, Zap, structlog)
- Bracketed logs (`[INFO] message`, Metro, env_logger)
- Prefixed logs (`ERROR: message`, Next.js, Vite, Python standard)
- HTTP access logs (morgan, Apache CLF, Nginx, Uvicorn)
- Docker / Docker Compose prefixed logs
- logfmt (`key=value`)
- Python (Django, Flask/Werkzeug, FastAPI/Uvicorn, standard logging)
- Go (native `log`, Logrus, Zap)
- Rust (env_logger, tracing, slog)
- Ruby (Rails logger)
- Elixir (Phoenix logger)
- Generic plain text with best-effort timestamp/level detection:

## Metrics Dashboard

Sift extracts live metrics from HTTP access logs while you work:

- **Request rate** — requests per minute per service
- **Error rate** — rolling error ratio shown as a status-bar sparkline
- **Average response time** — per service, when response times are present in logs
- **Health indicators** — green / yellow / red dot per service based on error ratio

No configuration is required. Pipe any service that emits HTTP access logs and the metrics appear automatically.

## Platform Support

- macOS: full support
- Linux: full support
- Windows: via WSL2 (native Windows not in MVP)

## Build tools for SQLite persistence

Sift uses `better-sqlite3` for session persistence. It ships with prebuilt binaries for common platforms, but if no prebuilt binary is available for your system, npm will need to compile it from source.

Install the required build tools for your platform:

- **macOS**: `xcode-select --install`
- **Ubuntu / Debian**: `sudo apt-get install build-essential python3`
- **Fedora / RHEL**: `sudo dnf install gcc-c++ make python3`
- **Windows**: Install Visual Studio Build Tools or use WSL2

If you skip this, `sift run` still works but sessions are not saved to disk, and `sift replay` / `sift diff` are unavailable.

## Marketing Website

The public-facing website lives in [`site/`](./site). It is a Vite + React + TypeScript single-page app with a warm editorial design system, built to explain Sift and drive adoption.

```bash
cd site
npm install
npm run dev      # local development
npm run build    # static export to site/dist
npm run preview  # preview the production build
```

Deploys are handled by [`.github/workflows/site.yml`](./.github/workflows/site.yml) to GitHub Pages whenever `main` changes under `site/`. To use it, enable Pages in the repository settings and set the source to **GitHub Actions**.

## License

MIT © Abdul-Qudus Rufai
