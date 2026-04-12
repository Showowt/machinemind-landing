#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MACHINEMIND SKILLS INSTALLER
# Installs custom skills into Claude Code's skill system
# Run: bash install-skills.sh
# ═══════════════════════════════════════════════════════════════

echo "⚡ Installing MachineMind Custom Skills..."

SKILL_DIR="$HOME/.claude/skills"
mkdir -p "$SKILL_DIR"

# Also try the user skills location
USER_SKILL_DIR="/mnt/skills/user"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

install_skill() {
  local name=$1
  local source="$SCRIPT_DIR/skills/$name"

  if [ ! -d "$source" ]; then
    echo "  ✗ $name not found at $source"
    return 1
  fi

  # Install to home directory
  mkdir -p "$SKILL_DIR/$name"
  cp -r "$source/"* "$SKILL_DIR/$name/"
  echo "  ✓ $name installed to $SKILL_DIR/$name"

  # Also try user skills if writable
  if [ -w "$USER_SKILL_DIR" ] 2>/dev/null; then
    mkdir -p "$USER_SKILL_DIR/$name"
    cp -r "$source/"* "$USER_SKILL_DIR/$name/"
    echo "  ✓ $name also installed to $USER_SKILL_DIR/$name"
  fi
}

echo ""
echo "Installing skills:"
install_skill "cinema-engine-builder"
install_skill "self-healing-deploy"
install_skill "sofia-client-factory"

echo ""
echo "═══════════════════════════════════════"
echo "⚡ 3 SKILLS INSTALLED"
echo "═══════════════════════════════════════"
echo ""
echo "What they do:"
echo ""
echo "  cinema-engine-builder"
echo "    Triggers: 'build a site', 'landing page', 'client demo'"
echo "    Does: Auto-applies dark theme, gold accents, GSAP, film grain"
echo ""
echo "  self-healing-deploy"
echo "    Triggers: 'deploy', 'ship it', 'push to production'"
echo "    Does: Pre-flight checks, auto-fix errors, verify live URL"
echo ""
echo "  sofia-client-factory"
echo "    Triggers: 'new client', 'set up Sofia for [business]'"
echo "    Does: Demo site + Sofia config + outreach message in one shot"
echo ""
echo "Test: Open Claude Code and say 'build a landing page for a restaurant called Alma in Cartagena'"
echo "Cinema Engine should activate automatically."
