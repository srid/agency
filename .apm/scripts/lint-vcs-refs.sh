#!/usr/bin/env bash
# Lint: catch raw `git`, `jj`, and `gh` commands in skill markdown / scripts
# outside the canonical /vcs and /forge skills. Encourages routing through
# the semantic dispatchers so adding a new VCS or forge is a one-skill change.
#
# Usage: lint-vcs-refs.sh [<files-to-check>...]
# Default: lint all .md and shell scripts under .apm/skills/, excluding
# the canonical dispatchers themselves and documented fallback prose.

set -euo pipefail

# Patterns that flag a raw command outside the dispatcher.
#   We catch shell-call patterns; mentions in narrative prose (backticked
#   inline references) are tolerated when the file is in the exemption list.
VCS_PATTERNS=(
  '\bgit (fetch|pull|push|add|commit|checkout|branch|diff|log|rev-parse|status|symbolic-ref|remote)\b'
  '\bjj (git|new|describe|bookmark|diff|log|file)\b'
)
FORGE_PATTERNS=(
  '\bgh (pr|issue|api|repo|run) '
)

# Files exempted from the lint — these are allowed to mention raw VCS/forge
# commands (they're the dispatchers, the lint script itself, README/docs
# that document the abstraction, or sibling skills that document fallback
# git/jj/gh equivalents).
EXEMPT=(
  '.apm/skills/vcs/'
  '.apm/skills/forge/'
  '.apm/skills/forge-pr/SKILL.md'    # documents the gh body-passing pattern
  '.apm/scripts/lint-vcs-refs.sh'
  'README.md'
  'docs/'
  '.apm/skills/code-police/SKILL.md' # may document git fallbacks
  '.apm/skills/fact-check/SKILL.md'
  '.apm/skills/hickey/SKILL.md'
  '.apm/skills/lowy/SKILL.md'
  '.apm/skills/elegance/SKILL.md'
  '.apm/skills/talk/SKILL.md'         # describes forbidden commands as prose
  '.apm/skills/ralph/SKILL.md'        # may reference git operations as prose
)

is_exempt() {
  local f="$1"
  for ex in "${EXEMPT[@]}"; do
    case "$f" in
      *"$ex"*) return 0 ;;
    esac
  done
  return 1
}

if [ $# -eq 0 ]; then
  mapfile -t files < <(find .apm/skills -type f \( -name '*.md' -o -name '*.sh' -o -perm -u+x \) 2>/dev/null)
else
  files=("$@")
fi

violations=0
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  if is_exempt "$f"; then continue; fi

  for pat in "${VCS_PATTERNS[@]}" "${FORGE_PATTERNS[@]}"; do
    if grep -nE "$pat" "$f" >/dev/null 2>&1; then
      echo "vcs-refs lint: $f contains raw VCS/forge command:"
      grep -nE "$pat" "$f" | sed 's/^/  /'
      violations=$((violations + 1))
    fi
  done
done

if [ "$violations" -gt 0 ]; then
  echo "" >&2
  echo "$violations file(s) contain raw VCS/forge commands. Route through .apm/skills/vcs/vcs-op or .apm/skills/forge/forge-op instead." >&2
  exit 1
fi
