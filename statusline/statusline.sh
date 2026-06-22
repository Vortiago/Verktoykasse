#!/usr/bin/env bash
# statusline/statusline.sh — the core Claude Code status line.
# Symlinked to ~/.claude/statusline.sh, run by settings.json -> statusLine.
# Reads the status JSON on stdin, prints ONE line of fixed regions:
#
#   not a git repo →  [user@host dir]
#   git repo       →  <project> ⎇ <branch> (<wt>) │ ◆ github-links │ 🌐 service-links │ <ext>
#
# The core owns the link regions (so links look the same everywhere); core and
# extensions only DECLARE links via cl_addlink. Links are full URLs — clickable
# even where OSC-8 is stripped (tmux over ssh). The extension's status comes last.
# Degrades silently without git / gh / auth / network.
set -uo pipefail

SELF=$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
DIR=$(dirname "$SELF")
# shellcheck source=/dev/null
. "$DIR/lib.sh"

# ── --gh <slug> <branch>: print "<pr>\t<state>\t<issue>" (driven via cl_cache) ─
if [ "${1:-}" = "--gh" ]; then
  slug=${2:-}; branch=${3:-}; prnum=""; prstate=""; issue=""
  GH=(gh); command -v timeout >/dev/null 2>&1 && GH=(timeout 8 gh)
  if command -v gh >/dev/null 2>&1; then
    pj=$("${GH[@]}" pr view "$branch" -R "$slug" \
          --json number,state,closingIssuesReferences 2>/dev/null || true)
    if [ -n "$pj" ]; then
      prnum=$(printf '%s' "$pj"  | jq -r '.number // empty' 2>/dev/null)
      prstate=$(printf '%s' "$pj" | jq -r '.state // empty' 2>/dev/null)
      issue=$(printf '%s' "$pj"  | jq -r '.closingIssuesReferences[0].number // empty' 2>/dev/null)
    fi
  fi
  if [ -z "$issue" ]; then  # else an issue number encoded in the branch name
    if   [[ "$branch" =~ ^([0-9]+)([-_]|$) ]];          then issue=${BASH_REMATCH[1]}
    elif [[ "$branch" =~ (issue|gh|#)[-_/]?([0-9]+) ]];  then issue=${BASH_REMATCH[2]}
    fi
  fi
  printf '%s\t%s\t%s' "$prnum" "$prstate" "$issue"
  exit 0
fi

# ── render ────────────────────────────────────────────────────────────────
input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || true

# One git call for toplevel + common dir (absolute) + branch (three lines).
{ read -r root; read -r common; read -r branch; } \
  < <(git rev-parse --show-toplevel --path-format=absolute --git-common-dir --abbrev-ref HEAD 2>/dev/null)

# Bare repo (the `git worktree` layout: a bare clone whose worktrees live alongside) or
# a plain .git dir has NO worktree here. The combined rev-parse above FAILS entirely in
# that case (--show-toplevel needs a work tree → exit 128), so root/common come back
# empty — re-probe the common dir on its own (that works), and if it exists resolve to
# the repo's PRIMARY worktree (default branch's, else first) so launching Claude from the
# bare/clone dir still gets the full status line instead of the [user@host] fallback.
if [ -z "$root" ] && common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) && [ -n "$common" ]; then
  picks=$(git worktree list --porcelain 2>/dev/null | awk '
    /^worktree /{wt=$2}
    /^bare$/{wt=""}
    /^branch /{b=$2; sub(/^refs\/heads\//,"",b); if (wt!="") print wt"\t"b}')
  bare_wt=$(awk -F'\t' '$2=="main"||$2=="master"{print $1; exit}' <<<"$picks")
  [ -n "$bare_wt" ] || bare_wt=$(printf '%s\n' "$picks" | head -n1 | cut -f1)
  if [ -n "$bare_wt" ] && [ -d "$bare_wt" ]; then
    root=$bare_wt
    branch=$(git -C "$bare_wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
  fi
fi

if [ -z "$root" ]; then
  printf '[%s@%s %s]' "$(whoami)" "$(hostname -s)" "$(basename "${cwd:-$PWD}")"
  exit 0
fi
# project = repo name (strip "/.git" of the worktree case, or ".git" of a bare repo).
project=${common%/.git}; project=${project##*/}; project=${project%.git}
wt=${root##*/}
[ -n "$branch" ] || branch='?'  # unborn HEAD / git error path: never render a dangling glyph

# Repo slug + host from origin (parsed locally, no network, no forks).
ru=$(git remote get-url origin 2>/dev/null || true)
host="github.com"; slug=""
case $ru in
  *://*) host=${ru#*://}; host=${host%%/*}; slug=${ru#*://*/} ;;
  *@*:*) host=${ru#*@};   host=${host%%:*}; slug=${ru#*:}     ;;
esac
slug=${slug%.git}

# Shared links collector — core + extension declare into it; core renders it.
CL_LINKS=$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/cl_links.$$")
export CL_LINKS
trap 'rm -f "$CL_LINKS"' EXIT

# Core's GitHub links: the branch's PR + the issue it closes (background-cached
# gh, so the render never blocks). Needs a real host, else the URLs are malformed.
#
# Deliberately GitHub-specific for now (gh CLI, /issues//pull/ paths) — wrong on
# GitLab/Gitea. When needed, move this into a bundled "gh" extension that declares
# gh-category links, leaving the core to own only region placement.
if [ -n "$slug" ] && [ -n "$host" ]; then
  IFS=$'\t' read -r c_pr c_prstate c_issue \
    <<<"$(cl_cache "gh_${slug}_${branch}" 180 -- bash "$SELF" --gh "$slug" "$branch")"
  [ -n "${c_issue:-}" ] && cl_addlink gh "https://$host/$slug/issues/$c_issue" "◆#$c_issue"
  [ -n "${c_pr:-}" ]    && cl_addlink gh "https://$host/$slug/pull/$c_pr"     "⇡#$c_pr"
fi

head="${CL_BOLD}${project}${CL_RESET} ${CL_DIM}⎇${CL_RESET} ${branch}"
[ "$wt" != "$branch" ] && [ "$wt" != "$project" ] && head="$head ${CL_DIM}(${wt})${CL_RESET}"

# Per-project extension: declares service links (cl_addlink svc …) and prints its
# non-link status segment. in-repo first (shareable), then the personal registry.
ext=""
if   [ -f "$root/.claude/statusline-ext.sh" ]; then ext="$root/.claude/statusline-ext.sh"
elif [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/claude-statusline/projects/$project.sh" ]; then
  ext="${XDG_CONFIG_HOME:-$HOME/.config}/claude-statusline/projects/$project.sh"
fi
extseg=""
if [ -n "$ext" ]; then
  export CL_ROOT="$root" CL_PROJECT="$project" CL_WORKTREE="$wt" \
         CL_BRANCH="$branch" CL_SLUG="$slug" CL_HOST="$host" CL_LIB="$DIR/lib.sh"
  RUN=(bash "$ext"); command -v timeout >/dev/null 2>&1 && RUN=(timeout 5 bash "$ext")
  extseg=$(printf '%s' "$input" | "${RUN[@]}" 2>/dev/null || true)
fi

# Assemble: identity │ GitHub region │ services region │ extension status.
RSEP=" ${CL_DIM}│${CL_RESET} "
printf '%s' "$(cl_join "$RSEP" "$head" "$(cl_render_links gh)" "$(cl_render_links svc)" "$extseg")"
