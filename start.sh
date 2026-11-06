#!/bin/bash
# Inkloom AI — Full Stack Startup Script
# Starts: cloudflared tunnels + backend server + frontend dev server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[Inkloom]${NC} $1"; }
warn() { echo -e "${YELLOW}[Inkloom]${NC} $1"; }
err() { echo -e "${RED}[Inkloom]${NC} $1" >&2; }
step() { echo -e "${CYAN}[→]${NC} $1"; }

# PIDs for cleanup
TUNNEL_MODEL_PID=""
TUNNEL_AI_PID=""
BACKEND_PID=""
WORKER_PID=""
FRONTEND_PID=""

# Cleanup function
cleanup() {
  echo ""
  log "Shutting down services..."
  local killed=0

  for pid in $TUNNEL_MODEL_PID $TUNNEL_AI_PID $BACKEND_PID $WORKER_PID $FRONTEND_PID; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      killed=$((killed + 1))
    fi
  done

  # Extra cleanup for any stray processes
  pkill -f "cloudflared.*config-inkoom" 2>/dev/null || true
  pkill -f "uvicorn.*app.main:app.*8000" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true

  if [ $killed -gt 0 ]; then
    log "Stopped $killed process(es)"
  fi
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Check if a process is running
is_running() {
  kill -0 "$1" 2>/dev/null
}

# Wait for a process to start
wait_for_start() {
  local pid=$1
  local name=$2
  local max_wait=10
  local waited=0
  while ! is_running "$pid" && [ $waited -lt $max_wait ]; do
    sleep 1
    waited=$((waited + 1))
  done
  if is_running "$pid"; then
    log "$name started (PID: $pid)"
    return 0
  else
    err "$name failed to start"
    return 1
  fi
}

# Check prerequisites
check_prereqs() {
  step "Checking prerequisites..."

  if ! command -v cloudflared &> /dev/null; then
    err "cloudflared not found. Install from: https://github.com/cloudflare/cloudflared"
    exit 1
  fi

  if ! command -v npm &> /dev/null; then
    err "npm not found"
    exit 1
  fi

  # Check tunnel configs exist
  if [ ! -f ~/.cloudflared/config-inkoom-model.yml ]; then
    err "Missing ~/.cloudflared/config-inkoom-model.yml"
    exit 1
  fi
  if [ ! -f ~/.cloudflared/config-inkoom-ai.yml ]; then
    err "Missing ~/.cloudflared/config-inkoom-ai.yml"
    exit 1
  fi

  # Setup Python venv if needed
  if [ ! -d "$SCRIPT_DIR/server/.venv" ]; then
    warn "Python venv not found, setting up..."
    cd "$SCRIPT_DIR/server"
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt >/dev/null 2>&1
    cd "$SCRIPT_DIR"
  fi

  log "All prerequisites satisfied"
}

# Stop any existing processes on our ports
stop_existing() {
  step "Stopping existing processes..."
  pkill -f "cloudflared.*config-inkoom" 2>/dev/null || true
  pkill -f "uvicorn.*app.main:app.*8000" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  sleep 1
  log "Done"
}

# Start cloudflared tunnels
start_tunnels() {
  step "Starting Cloudflare tunnels..."

  cloudflared tunnel --config ~/.cloudflared/config-inkoom-model.yml run >/dev/null 2>&1 &
  TUNNEL_MODEL_PID=$!

  cloudflared tunnel --config ~/.cloudflared/config-inkoom-ai.yml run >/dev/null 2>&1 &
  TUNNEL_AI_PID=$!

  # Wait for tunnels to establish
  sleep 4

  if is_running "$TUNNEL_MODEL_PID" && is_running "$TUNNEL_AI_PID"; then
    log "Tunnels running"
    cloudflared tunnel list | grep -E "inkoom" || true
  else
    err "Failed to start tunnels"
    exit 1
  fi
}

# Start backend server
start_backend() {
  step "Starting backend server (FastAPI on :8000)..."

  cd "$SCRIPT_DIR/server"

  .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1 &
  BACKEND_PID=$!

  .venv/bin/python -m app.worker >/dev/null 2>&1 &
  WORKER_PID=$!

  cd "$SCRIPT_DIR"

  sleep 2
  log "Backend: PID $BACKEND_PID, Worker: PID $WORKER_PID"
}

# Start frontend dev server
start_frontend() {
  step "Starting frontend (Next.js on :3000)..."

  npm run dev >/dev/null 2>&1 &
  FRONTEND_PID=$!

  sleep 3
  log "Frontend: PID $FRONTEND_PID"
}

# Print status
print_status() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Inkloom AI is running!                                ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Frontend:${NC}   https://inkoom-ai.shubelhos.com"
  echo -e "              http://localhost:3000"
  echo ""
  echo -e "  ${CYAN}Backend:${NC}    https://inkoom-model.shubelhos.com"
  echo -e "              http://localhost:8000"
  echo ""
  echo -e "  ${CYAN}Health:${NC}     https://inkoom-model.shubelhos.com/api/v1/health"
  echo ""
  echo -e "  ${YELLOW}Ctrl+C${NC} to stop all services"
  echo ""
}

# Print tunnel connection status
check_tunnels() {
  echo ""
  step "Tunnel status:"
  cloudflared tunnel list 2>/dev/null | grep -E "inkoom.*inkloom" || echo "  Checking..."
}

# Main
main() {
  echo ""
  log "Inkloom AI — Starting full stack..."
  echo ""

  check_prereqs
  stop_existing
  start_tunnels
  start_backend
  start_frontend

  print_status
  check_tunnels

  # Keep script running and wait for all child processes
  wait
}

main "$@"