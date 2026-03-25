#!/usr/bin/env bash
# install-context.sh — Download OAC context files to .claude/context/
#
# Requirements: bash, git (nothing else to install)
#
# Run from project root:
#   bash install-context.sh [--profile=standard] [--force] [--dry-run]

set -euo pipefail

GITHUB_REPO="darrenhinde/OpenAgentsControl"
GITHUB_BRANCH="main"
CONTEXT_SOURCE_PATH=".opencode/context"

# Paths are set in main() after parsing --global flag
PROJECT_ROOT="$(pwd)"
GLOBAL_ROOT="${HOME}/.claude"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error()   { echo -e "${RED}✗${NC} $*" >&2; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Download OAC context files. Requirements: git (nothing else to install)

OPTIONS:
  --profile=NAME    Profile: essential, standard, extended, all (default: standard)
  --global          Install to ~/.claude/context/ (all projects share it)
  --force           Re-download even if already installed
  --dry-run         Show what would be installed without downloading
  --help            Show this help

PROFILES:
  essential/standard  Core context (core + openagents-repo)
  extended/all        Full context (all categories)

SCOPE:
  default (no flag)   Installs to .claude/context/ in the current project
  --global            Installs to ~/.claude/context/ for all projects
EOF
  exit 0
}

get_categories() {
  case "${1:-standard}" in
    essential|standard|core)
      echo "core openagents-repo"
      ;;
    extended|all|full)
      echo "core openagents-repo development ui content-creation data product learning project project-intelligence"
      ;;
    *)
      log_error "Unknown profile: $1"
      log_info "Valid profiles: essential, standard, extended, all"
      exit 1
      ;;
  esac
}

check_dependencies() {
  if ! command -v git >/dev/null 2>&1; then
    log_error "git is required but not installed."
    log_info "Install: brew install git (Mac) or sudo apt install git (Linux)"
    exit 1
  fi
}

download_context() {
  local categories
  read -ra categories <<< "$1"
  local temp_dir
  temp_dir="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '${temp_dir}'" EXIT

  log_info "Cloning repository (sparse)..."
  git clone --depth 1 --filter=blob:none --sparse \
    "https://github.com/${GITHUB_REPO}.git" "${temp_dir}" --quiet 2>&1 | grep -v "^$" || true

  # Get commit SHA from the clone (no second clone needed)
  COMMIT_SHA=$(git -C "${temp_dir}" rev-parse HEAD)

  log_info "Configuring sparse checkout..."
  local sparse_paths=""
  for cat in "${categories[@]}"; do
    sparse_paths="${sparse_paths} ${CONTEXT_SOURCE_PATH}/${cat}"
  done
  sparse_paths="${sparse_paths} ${CONTEXT_SOURCE_PATH}/navigation.md"

  # shellcheck disable=SC2086
  git -C "${temp_dir}" sparse-checkout set --skip-checks ${sparse_paths} 2>/dev/null

  log_info "Copying context files..."
  mkdir -p "${CONTEXT_DIR}"

  local source_dir="${temp_dir}/${CONTEXT_SOURCE_PATH}"
  if [ ! -d "${source_dir}" ]; then
    log_error "Context directory not found in repository"
    exit 1
  fi

  cp -r "${source_dir}/"* "${CONTEXT_DIR}/"

  local file_count
  file_count=$(find "${CONTEXT_DIR}" -type f | wc -l | tr -d ' ')
  log_success "Downloaded ${file_count} files"
}

write_manifest() {
  local profile="$1"
  local categories
  read -ra categories <<< "$2"
  local commit="$3"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  mkdir -p "$(dirname "${MANIFEST_FILE}")"

  # Build JSON without jq — use printf
  local cats_json="["
  local files_json="{"
  local first=true

  for cat in "${categories[@]}"; do
    $first || { cats_json="${cats_json},"; files_json="${files_json},"; }
    cats_json="${cats_json}\"${cat}\""
    local count=0
    [ -d "${CONTEXT_DIR}/${cat}" ] && count=$(find "${CONTEXT_DIR}/${cat}" -type f | wc -l | tr -d ' ')
    files_json="${files_json}\"${cat}\": ${count}"
    first=false
  done

  cats_json="${cats_json}]"
  files_json="${files_json}}"

  printf '{
  "version": "1.0.0",
  "profile": "%s",
  "source": {
    "repository": "%s",
    "branch": "%s",
    "commit": "%s",
    "downloaded_at": "%s"
  },
  "categories": %s,
  "files": %s
}\n' \
    "${profile}" \
    "${GITHUB_REPO}" \
    "${GITHUB_BRANCH}" \
    "${commit}" \
    "${timestamp}" \
    "${cats_json}" \
    "${files_json}" \
    > "${MANIFEST_FILE}"

  log_success "Manifest created: ${MANIFEST_FILE}"
}

main() {
  local profile="standard"
  local global=false
  local force=false
  local dry_run=false

  for arg in "$@"; do
    case "${arg}" in
      --profile=*) profile="${arg#*=}" ;;
      --global)    global=true ;;
      --force)     force=true ;;
      --dry-run)   dry_run=true ;;
      --help|-h)   usage ;;
      *)
        log_error "Unknown option: ${arg}"
        echo ""
        usage
        ;;
    esac
  done

  # Set install targets based on scope
  local context_dir manifest_file oac_json scope_label
  if [ "${global}" = true ]; then
    context_dir="${GLOBAL_ROOT}/context"
    manifest_file="${GLOBAL_ROOT}/.context-manifest.json"
    oac_json=""  # global install: no per-project .oac.json
    scope_label="global (~/.claude/context)"
  else
    context_dir="${PROJECT_ROOT}/.claude/context"
    manifest_file="${PROJECT_ROOT}/.claude/.context-manifest.json"
    oac_json="${PROJECT_ROOT}/.oac.json"
    scope_label="project (.claude/context)"
  fi

  # Export so sub-functions can use them
  CONTEXT_DIR="${context_dir}"
  MANIFEST_FILE="${manifest_file}"

  local categories
  categories=$(get_categories "${profile}")

  # Already installed?
  if [ -f "${MANIFEST_FILE}" ] && [ "${force}" = false ]; then
    log_warning "Context already installed at ${scope_label}. Use --force to reinstall."
    log_info "Manifest: ${MANIFEST_FILE}"
    exit 0
  fi

  check_dependencies

  echo ""
  log_info "Scope:      ${scope_label}"
  log_info "Profile:    ${profile}"
  log_info "Categories: ${categories}"
  log_info "Target:     ${CONTEXT_DIR}"
  echo ""

  if [ "${dry_run}" = true ]; then
    log_info "Dry run — no files downloaded"
    exit 0
  fi

  COMMIT_SHA=""
  download_context "${categories}"

  write_manifest "${profile}" "${categories}" "${COMMIT_SHA}"

  # Write .oac.json for project installs so context-scout uses the fast path
  if [ "${global}" = false ]; then
    if [ ! -f "${oac_json}" ]; then
      printf '{\n  "version": "1",\n  "context": {\n    "root": ".claude/context"\n  }\n}\n' > "${oac_json}"
      log_success ".oac.json created at project root"
    else
      log_info ".oac.json already exists — skipping"
    fi
  else
    log_info "Global install — no .oac.json needed (discovery chain finds ~/.claude/context automatically)"
  fi

  echo ""
  log_success "Context installation complete!"
  log_info "Scope:    ${scope_label}"
  log_info "Context:  ${CONTEXT_DIR}"
  log_info "Manifest: ${MANIFEST_FILE}"
  echo ""
}

main "$@"
