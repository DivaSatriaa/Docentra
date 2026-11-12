#!/usr/bin/env bash
#
# Docentra dev launcher.
#
#   ./dev.sh           start everything, each service in its own terminal tab
#   ./dev.sh --bg      start everything in the background (logs in .dev/)
#   ./dev.sh stop      stop the three services (add --db to stop Postgres too)
#   ./dev.sh status    show what is running
#
# Starts: Postgres (docker) -> DB migrations -> AI service (:8000)
#         -> backend (:8080) -> frontend (:5173)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$ROOT/.dev"

AI_PORT=8000
API_PORT=8080
WEB_PORT=5173

# name|port|directory|command
SERVICES=(
  "AI service|$AI_PORT|ai-service|source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port $AI_PORT"
  "Backend|$API_PORT|backend|go run ./cmd/server"
  "Frontend|$WEB_PORT|.|npm run dev"
)

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }
fail() { printf '\033[31mx %s\033[0m\n' "$*" >&2; exit 1; }

port_pids() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u; }
port_busy() { [ -n "$(port_pids "$1")" ]; }

# ---------------------------------------------------------------- preflight

preflight() {
  bold "Checking setup"

  for dir in backend ai-service; do
    [ -f "$ROOT/$dir/.env" ] || fail "$dir/.env is missing. Copy $dir/.env.example to $dir/.env and fill it in."
  done

  [ -d "$ROOT/ai-service/.venv" ] || fail "ai-service/.venv is missing. See ai-service/requirements.txt for setup."
  [ -d "$ROOT/node_modules" ]     || { info "Installing frontend dependencies..."; (cd "$ROOT" && npm install --silent); }

  command -v docker >/dev/null || fail "docker is not installed."
  command -v go >/dev/null     || fail "go is not installed."
  command -v ss >/dev/null     || fail "'ss' (iproute2) is required."

  if ! curl -s -m 2 http://localhost:11434/api/tags >/dev/null; then
    warn "Ollama isn't answering on :11434. Local models won't work (API models still do)."
  fi
}

start_database() {
  bold "Database"

  if ! docker compose -f "$ROOT/docker-compose.yml" up -d 2>/tmp/docentra-docker.err; then
    cat /tmp/docentra-docker.err >&2
    fail "docker compose failed. If it says 'permission denied': sudo usermod -aG docker \$USER, then log out and in."
  fi

  local tries=0
  until docker exec docentra-postgres pg_isready -U docentra -d docentra >/dev/null 2>&1; do
    tries=$((tries + 1))
    [ "$tries" -le 30 ] || fail "Postgres didn't become ready in 30s (docker logs docentra-postgres)."
    sleep 1
  done
  info "Postgres is ready"

  info "Running migrations"
  (cd "$ROOT/backend" && go run ./cmd/migrate up 2>&1 | sed 's/^/    /')
}

# ---------------------------------------------------------------- launching

# Command that keeps the tab open after the service exits, so errors stay visible.
tab_command() {
  local dir="$1" cmd="$2"
  printf 'cd %q && %s; echo; echo "[stopped] press Enter to close this tab"; read -r' "$ROOT/$dir" "$cmd"
}

open_tabs() {
  local first=1 name port dir cmd

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"

    if port_busy "$port"; then
      warn "$name: port $port is already in use, skipping (already running?)"
      continue
    fi

    local script
    script="$(tab_command "$dir" "$cmd")"

    if command -v ptyxis >/dev/null; then
      if [ "$first" = 1 ]; then
        ptyxis --new-window -T "$name" -d "$ROOT" -- bash -ic "$script" >/dev/null 2>&1 &
        sleep 1.5
      else
        ptyxis --tab -T "$name" -d "$ROOT" -- bash -ic "$script" >/dev/null 2>&1 &
        sleep 0.6
      fi
    elif command -v gnome-terminal >/dev/null; then
      if [ "$first" = 1 ]; then
        gnome-terminal --window --title="$name" -- bash -ic "$script" >/dev/null 2>&1 &
        sleep 1.5
      else
        gnome-terminal --tab --title="$name" -- bash -ic "$script" >/dev/null 2>&1 &
        sleep 0.6
      fi
    else
      warn "No supported terminal found (ptyxis / gnome-terminal). Falling back to background mode."
      open_background
      return
    fi

    first=0
    info "$name -> new tab (port $port)"
  done
}

open_background() {
  mkdir -p "$STATE"
  local name port dir cmd file

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"

    if port_busy "$port"; then
      warn "$name: port $port is already in use, skipping (already running?)"
      continue
    fi

    file="$STATE/$(echo "$name" | tr 'A-Z ' 'a-z-').log"
    # exec: the subshell becomes the service, so nothing lingers holding our stdout.
    (
      cd "$ROOT/$dir" || exit 1
      exec setsid nohup bash -ic "$cmd" >"$file" 2>&1 </dev/null
    ) &
    info "$name -> background (port $port, log: ${file#"$ROOT"/})"
  done
}

wait_for_ports() {
  bold "Waiting for services"
  local name port dir cmd tries

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"
    tries=0

    until port_busy "$port"; do
      tries=$((tries + 1))
      if [ "$tries" -gt 90 ]; then
        warn "$name didn't open port $port within 90s, check its tab or log"
        continue 2
      fi
      sleep 1
    done

    info "$name is up on :$port"
  done
}

# ---------------------------------------------------------------- commands

cmd_start() {
  local mode="${1:-tabs}"

  preflight
  start_database

  bold "Services"
  if [ "$mode" = "bg" ]; then open_background; else open_tabs; fi

  wait_for_ports

  echo
  bold "Docentra is running"
  info "App:     http://localhost:$WEB_PORT"
  info "API:     http://localhost:$API_PORT/health"
  info "AI docs: http://localhost:$AI_PORT/docs"
  echo
  info "Stop with: ./dev.sh stop"
}

cmd_stop() {
  bold "Stopping services"
  local name port dir cmd pids

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"
    pids="$(port_pids "$port")"

    if [ -z "$pids" ]; then
      info "$name: not running"
      continue
    fi

    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    info "$name: stopped (pid $(echo $pids))"
  done

  if [ "${1:-}" = "--db" ]; then
    docker compose -f "$ROOT/docker-compose.yml" stop
    info "Postgres: stopped"
  else
    info "Postgres left running (use './dev.sh stop --db' to stop it too)"
  fi
}

cmd_status() {
  local name port dir cmd

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name port dir cmd <<<"$entry"

    if port_busy "$port"; then printf '  %-11s up    :%s\n' "$name" "$port"
    else                        printf '  %-11s DOWN  :%s\n' "$name" "$port"; fi
  done

  if docker exec docentra-postgres pg_isready -U docentra >/dev/null 2>&1; then
    printf '  %-11s up    :5432\n' "Postgres"
  else
    printf '  %-11s DOWN  :5432\n' "Postgres"
  fi
}

case "${1:-}" in
  ""|tabs)  cmd_start tabs ;;
  --bg|bg)  cmd_start bg ;;
  stop)     cmd_stop "${2:-}" ;;
  status)   cmd_status ;;
  -h|--help|help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
  *)        fail "Unknown option '$1'. Try ./dev.sh --help" ;;
esac
