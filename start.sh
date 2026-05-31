#!/usr/bin/env bash
# =============================================================================
#  start.sh — PrepAgent Full Stack Launcher
#  Starts: ChromaDB → FastAPI Backend → Next.js Dev Server
#
#  Usage:
#    chmod +x start.sh   (first time only)
#    ./start.sh          (normal start)
#    ./start.sh --stop   (stop all Docker services)
#    ./start.sh --reset  (stop + wipe ChromaDB data volume, then start fresh)
# =============================================================================

set -euo pipefail

# ── Color palette ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
LOG_DIR="$PROJECT_DIR/.logs"
BACKEND_URL="http://localhost:8000"
CHROMADB_URL="http://localhost:8001"
NEXTJS_URL="http://localhost:3000"
HEALTH_TIMEOUT=60   # seconds to wait for each service
NEXTJS_PID_FILE="$LOG_DIR/nextjs.pid"

mkdir -p "$LOG_DIR"

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ██████╗ ██████╗ ███████╗██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗"
  echo "  ██╔══██╗██╔══██╗██╔════╝██╔══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝"
  echo "  ██████╔╝██████╔╝█████╗  ██████╔╝    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   "
  echo "  ██╔═══╝ ██╔══██╗██╔══╝  ██╔═══╝     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   "
  echo "  ██║     ██║  ██║███████╗██║         ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   "
  echo "  ╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝         ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   "
  echo -e "${RESET}"
  echo -e "  ${DIM}AI Study Assistant — Full Stack Launcher${RESET}"
  echo ""
}

# ── Logging helpers ───────────────────────────────────────────────────────────
log_step()    { echo -e "${BOLD}${BLUE}▶ $1${RESET}"; }
log_ok()      { echo -e "  ${GREEN}✔  $1${RESET}"; }
log_warn()    { echo -e "  ${YELLOW}⚠  $1${RESET}"; }
log_error()   { echo -e "  ${RED}✖  $1${RESET}"; }
log_info()    { echo -e "  ${DIM}   $1${RESET}"; }
log_section() { echo ""; echo -e "${MAGENTA}${BOLD}━━━ $1 ━━━${RESET}"; echo ""; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  log_section "Shutting Down"

  # Kill Next.js dev server
  if [[ -f "$NEXTJS_PID_FILE" ]]; then
    local pid
    pid=$(cat "$NEXTJS_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log_step "Stopping Next.js (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      rm -f "$NEXTJS_PID_FILE"
      log_ok "Next.js stopped"
    fi
  fi

  # Stop Docker services
  log_step "Stopping Docker services..."
  cd "$PROJECT_DIR"
  docker-compose stop 2>/dev/null && log_ok "Docker services stopped" || log_warn "Docker stop had warnings"

  echo ""
  echo -e "${CYAN}${BOLD}  PrepAgent stopped. Goodbye! 👋${RESET}"
  echo ""
  exit 0
}

trap cleanup INT TERM

# ── --stop flag ───────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--stop" ]]; then
  print_banner
  log_section "Stopping All Services"
  if [[ -f "$NEXTJS_PID_FILE" ]]; then
    local_pid=$(cat "$NEXTJS_PID_FILE")
    kill "$local_pid" 2>/dev/null && log_ok "Next.js stopped" || true
    rm -f "$NEXTJS_PID_FILE"
  fi
  cd "$PROJECT_DIR"
  docker-compose down && log_ok "Docker services stopped"
  exit 0
fi

# ── --reset flag ──────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--reset" ]]; then
  print_banner
  log_section "⚠  Full Reset — Wipes ChromaDB Volume"
  echo -e "  ${YELLOW}This will delete ALL indexed knowledge from ChromaDB.${RESET}"
  read -r -p "  Are you sure? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    cd "$PROJECT_DIR"
    docker-compose down -v && log_ok "Containers + volumes removed"
  else
    log_warn "Reset cancelled."
    exit 0
  fi
fi

# =============================================================================
# MAIN STARTUP SEQUENCE
# =============================================================================
print_banner
cd "$PROJECT_DIR"

# ── Step 1: Check Prerequisites ───────────────────────────────────────────────
log_section "Checking Prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    log_ok "$1 found ($(command -v "$1"))"
  else
    log_error "$1 is required but not installed."
    echo -e "  ${DIM}Install: $2${RESET}"
    exit 1
  fi
}

check_cmd "docker"       "https://docs.docker.com/get-docker/"
check_cmd "docker-compose" "brew install docker-compose"
check_cmd "node"         "https://nodejs.org/"
check_cmd "npm"          "bundled with Node.js"

# Check Docker daemon is actually running
if ! docker info &>/dev/null; then
  log_error "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi
log_ok "Docker daemon is running"

# ── Step 2: Validate .env ─────────────────────────────────────────────────────
log_section "Environment Configuration"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  if [[ -f "$PROJECT_DIR/.env.example" ]]; then
    log_warn ".env not found. Copying from .env.example..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    log_ok ".env created from template"
    log_warn "You should set GEMINI_API_KEY in .env for full AI features."
  else
    log_error ".env file is missing and no .env.example found."
    exit 1
  fi
else
  log_ok ".env file found"
fi

# Check for Gemini API key
GEMINI_KEY=$(grep -E "^GEMINI_API_KEY=" "$PROJECT_DIR/.env" | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
if [[ -z "$GEMINI_KEY" || "$GEMINI_KEY" == "your_gemini_api_key_here" ]]; then
  log_warn "GEMINI_API_KEY is not set in .env"
  log_info "The app will work but AI formatting and quiz generation will be limited."
  log_info "Get a free key at: https://aistudio.google.com/app/apikey"
else
  log_ok "Gemini API key detected (${GEMINI_KEY:0:8}...)"
fi

# Check for node_modules
if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  log_section "Installing Node.js Dependencies"
  npm install --silent && log_ok "npm install complete" || {
    log_error "npm install failed"
    exit 1
  }
else
  log_ok "node_modules present"
fi

# ── Step 3: Start Docker Services ────────────────────────────────────────────
log_section "Starting Docker Services"

log_step "Pulling / building Docker images (first run may take 2–3 minutes)..."
docker-compose up chromadb backend --build --detach \
  >"$LOG_DIR/docker.log" 2>&1 &
DOCKER_BUILD_PID=$!

# Animated wait while Docker builds
SPIN_CHARS='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
i=0
while kill -0 $DOCKER_BUILD_PID 2>/dev/null; do
  char="${SPIN_CHARS:$((i % ${#SPIN_CHARS})):1}"
  printf "\r  ${CYAN}%s  Building Docker images...${RESET}" "$char"
  sleep 0.1
  ((i++))
done
wait $DOCKER_BUILD_PID
DOCKER_EXIT=$?
printf "\r                                        \r"

if [[ $DOCKER_EXIT -ne 0 ]]; then
  log_error "Docker build/start failed. Check logs:"
  log_info  "  cat $LOG_DIR/docker.log"
  tail -20 "$LOG_DIR/docker.log"
  exit 1
fi
log_ok "Docker services launched"

# ── Step 4: Wait for ChromaDB ────────────────────────────────────────────────
log_step "Waiting for ChromaDB to be ready..."
ELAPSED=0
until curl -sf "$CHROMADB_URL/api/v2/heartbeat" &>/dev/null; do
  if [[ $ELAPSED -ge $HEALTH_TIMEOUT ]]; then
    log_error "ChromaDB did not start within ${HEALTH_TIMEOUT}s."
    log_info  "Check: docker logs prepagent-chromadb"
    exit 1
  fi
  printf "\r  ${DIM}⏳ Waiting for ChromaDB... ${ELAPSED}s${RESET}"
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
printf "\r                                          \r"
log_ok "ChromaDB is ready  →  $CHROMADB_URL"

# ── Step 5: Wait for FastAPI ──────────────────────────────────────────────────
log_step "Waiting for FastAPI backend to be ready..."
ELAPSED=0
until curl -sf "$BACKEND_URL/health" &>/dev/null; do
  if [[ $ELAPSED -ge $HEALTH_TIMEOUT ]]; then
    log_error "FastAPI backend did not start within ${HEALTH_TIMEOUT}s."
    log_info  "Check: docker logs prepagent-backend"
    docker logs prepagent-backend --tail 30
    exit 1
  fi
  printf "\r  ${DIM}⏳ Waiting for FastAPI...   ${ELAPSED}s${RESET}"
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
printf "\r                                          \r"

# Get and display health details
HEALTH_JSON=$(curl -sf "$BACKEND_URL/health" 2>/dev/null || echo '{}')
CHROMA_STATUS=$(echo "$HEALTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('chromadb',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
AI_PROVIDER=$(echo "$HEALTH_JSON"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ai_provider','unknown'))" 2>/dev/null || echo "unknown")

log_ok "FastAPI backend is ready  →  $BACKEND_URL"
log_info "  AI provider : $AI_PROVIDER"
log_info "  ChromaDB    : $CHROMA_STATUS"

# ── Step 6: Start Next.js ─────────────────────────────────────────────────────
log_section "Starting Next.js Dev Server"

log_step "Launching Next.js on port 3000..."
npm run dev >"$LOG_DIR/nextjs.log" 2>&1 &
NEXTJS_PID=$!
echo "$NEXTJS_PID" > "$NEXTJS_PID_FILE"
log_info "PID: $NEXTJS_PID  |  Logs: $LOG_DIR/nextjs.log"

# Wait for Next.js to be ready
ELAPSED=0
until curl -sf "$NEXTJS_URL" &>/dev/null; do
  if [[ $ELAPSED -ge $HEALTH_TIMEOUT ]]; then
    log_error "Next.js did not start within ${HEALTH_TIMEOUT}s."
    log_info  "Check: cat $LOG_DIR/nextjs.log"
    tail -20 "$LOG_DIR/nextjs.log"
    cleanup
    exit 1
  fi
  printf "\r  ${DIM}⏳ Waiting for Next.js...   ${ELAPSED}s${RESET}"
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
printf "\r                                          \r"
log_ok "Next.js is ready"

# ── Step 7: Print Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          ✅  PrepAgent is Running!                   ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo -e "  ║  🌐  App           →  ${CYAN}http://localhost:3000${GREEN}          ║"
echo -e "  ║  🐍  FastAPI       →  ${CYAN}http://localhost:8000${GREEN}          ║"
echo -e "  ║  📖  API Docs      →  ${CYAN}http://localhost:8000/docs${GREEN}     ║"
echo -e "  ║  🔵  ChromaDB      →  ${CYAN}http://localhost:8001${GREEN}          ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║  📋  Logs:                                           ║"
echo -e "  ║     Next.js  →  ${DIM}.logs/nextjs.log${GREEN}                   ║"
echo -e "  ║     Docker   →  ${DIM}.logs/docker.log${GREEN}                   ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║  Press  Ctrl+C  to stop all services                 ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

if [[ -z "$GEMINI_KEY" || "$GEMINI_KEY" == "your_gemini_api_key_here" ]]; then
  echo -e "  ${YELLOW}${BOLD}⚠  Reminder:${RESET}${YELLOW} Add your GEMINI_API_KEY to .env and run:${RESET}"
  echo -e "  ${DIM}  docker-compose restart backend${RESET}"
  echo ""
fi

# ── Keep alive — tail Next.js logs ────────────────────────────────────────────
echo -e "  ${DIM}Streaming Next.js logs (Ctrl+C to stop everything):${RESET}"
echo ""
tail -f "$LOG_DIR/nextjs.log" &
TAIL_PID=$!

# Wait for Next.js process to exit (or Ctrl+C)
wait "$NEXTJS_PID" 2>/dev/null || true
kill "$TAIL_PID" 2>/dev/null || true

# If Next.js crashed, show logs and clean up
if ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
  log_error "Next.js exited unexpectedly."
  log_info "Last 30 lines of .logs/nextjs.log:"
  tail -30 "$LOG_DIR/nextjs.log"
fi

cleanup
