#!/usr/bin/env bash
# CleverReply - Full Vencord + Plugin Installer for Linux
# Usage: bash install.sh

set -euo pipefail

PLUGIN_NAME="CleverReply"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENCORD_DIR="$HOME/Vencord"

# ── Colors ────────────────────────────────────────────────────────────────────

bold='\033[1m'
cyan='\033[0;36m'
green='\033[0;32m'
yellow='\033[0;33m'
red='\033[0;31m'
reset='\033[0m'

step()  { echo -e "\n${cyan}[*] $1${reset}"; }
ok()    { echo -e "    ${green}$1${reset}"; }
warn()  { echo -e "    ${yellow}$1${reset}"; }
err()   { echo -e "    ${red}$1${reset}"; }

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${cyan}============================================${reset}"
echo -e "${cyan}   ${PLUGIN_NAME}  -  Full Installer (Linux)${reset}"
echo -e "${cyan}============================================${reset}"
echo ""
echo "This script will:"
echo "  1. Check for Git, Node.js & pnpm"
echo "  2. Clone Vencord to $VENCORD_DIR"
echo "  3. Install Vencord dependencies"
echo "  4. Copy CleverReply plugin files"
echo "  5. Build Vencord"
echo "  6. Inject Vencord into Discord"
echo ""
read -rp "Continue? (Y/n) " go
[[ "${go,,}" == "n" ]] && exit 0

# ── 1. Prerequisites ─────────────────────────────────────────────────────────

step "Checking prerequisites..."

missing=()
command -v git  &>/dev/null || missing+=("git")
command -v node &>/dev/null || missing+=("nodejs")

if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing: ${missing[*]}"

    if command -v pacman &>/dev/null; then
        warn "Installing via pacman..."
        sudo pacman -S --needed --noconfirm "${missing[@]}"
    elif command -v apt &>/dev/null; then
        warn "Installing via apt..."
        sudo apt update && sudo apt install -y "${missing[@]}"
    elif command -v dnf &>/dev/null; then
        warn "Installing via dnf..."
        sudo dnf install -y "${missing[@]}"
    else
        err "Could not detect package manager. Please install: ${missing[*]}"
        exit 1
    fi
fi
ok "git is ready."
ok "node is ready ($(node --version))."

if ! command -v pnpm &>/dev/null; then
    warn "pnpm not found. Installing via npm..."
    sudo npm install -g pnpm
fi
ok "pnpm is ready ($(pnpm --version))."

# ── 2. Clone Vencord ─────────────────────────────────────────────────────────

step "Setting up Vencord..."

if [[ -d "$VENCORD_DIR/src" ]]; then
    ok "Vencord already exists at $VENCORD_DIR, pulling latest..."
    git -C "$VENCORD_DIR" pull --ff-only 2>/dev/null || true
else
    warn "Cloning Vencord to $VENCORD_DIR..."
    git clone "https://github.com/Vendicated/Vencord.git" "$VENCORD_DIR"
    ok "Cloned."
fi

# ── 3. Install dependencies ──────────────────────────────────────────────────

step "Installing Vencord dependencies (pnpm install)..."

cd "$VENCORD_DIR"
if ! pnpm install --frozen-lockfile 2>/dev/null; then
    warn "Frozen lockfile failed, trying regular install..."
    pnpm install
fi
ok "Dependencies installed."

# ── 4. Copy plugin files ─────────────────────────────────────────────────────

step "Copying $PLUGIN_NAME plugin files..."

USERPLUGINS="$VENCORD_DIR/src/userplugins"
DEST_DIR="$USERPLUGINS/$PLUGIN_NAME"

# If installed via AUR, files are in /usr/share; otherwise next to this script
if [[ -f "/usr/share/vencord-clever-reply/index.tsx" ]]; then
    SRC_DIR="/usr/share/vencord-clever-reply"
else
    SRC_DIR="$SCRIPT_DIR"
fi

mkdir -p "$DEST_DIR"

for file in index.tsx cleverbot.ts native.ts; do
    if [[ ! -f "$SRC_DIR/$file" ]]; then
        err "Missing $file in $SRC_DIR"
        exit 1
    fi
    cp "$SRC_DIR/$file" "$DEST_DIR/$file"
    ok "Copied $file"
done

# ── 5. Build ─────────────────────────────────────────────────────────────────

step "Building Vencord..."

cd "$VENCORD_DIR"
pnpm build
ok "Build complete."

# ── 6. Inject into Discord ───────────────────────────────────────────────────

step "Injecting Vencord into Discord..."
warn "CLOSE DISCORD COMPLETELY before continuing."
echo ""
read -rp "Is Discord fully closed? (Y/n) " ready

if [[ "${ready,,}" == "n" ]]; then
    warn "Please close Discord, then run: cd $VENCORD_DIR && sudo pnpm inject"
else
    # Kill any lingering Discord processes
    pkill -f "[Dd]iscord" 2>/dev/null || true
    sleep 2

    cd "$VENCORD_DIR"
    if sudo pnpm inject; then
        ok "Injection complete."
    else
        err "Injection failed. Try manually: cd $VENCORD_DIR && sudo pnpm inject"
    fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${green}============================================${reset}"
echo -e "${green}   All done!${reset}"
echo -e "${green}============================================${reset}"
echo ""
echo "  1. Open Discord"
echo "  2. Go to Settings -> Vencord -> Plugins"
echo "  3. Search for '$PLUGIN_NAME' and enable it"
echo "  4. Hover any message -> click the robot button"
echo ""
