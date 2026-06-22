#!/usr/bin/env bash
# statusline/lib.sh — helpers shared by the core status line and project
# extensions. Sourced, never executed. The core exports its path as $CL_LIB so
# an extension can `. "${CL_LIB:?}"` to get the same colours, links, and cache.

# ── colours (CL_ prefixed so they never collide with an extension's vars) ─────
# CL_DIM is an explicit mid-grey (256-colour), NOT the SGR "faint" attribute
# (\033[2m): many terminals render faint as near-black, which is unreadable on a
# black background (uptime, worktree, machine names all vanish). An explicit grey
# forces a readable, deterministic dim that still reads as subdued vs. CL_BOLD.
CL_RESET=$'\033[0m'; CL_DIM=$'\033[38;5;245m'; CL_BOLD=$'\033[1m'
CL_GREEN=$'\033[32m'; CL_CYAN=$'\033[36m'; CL_PURPLE=$'\033[35m'
CL_RED=$'\033[31m';   CL_YELLOW=$'\033[33m'; CL_BLUE=$'\033[34m'

# cl_link URL TEXT — an OSC-8 terminal hyperlink. Terminals without OSC-8
# support just show TEXT, so it always degrades cleanly.
cl_link() { printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$1" "$2"; }

# cl_dur SECONDS — compact human duration: 7380→"2h3m", 840→"14m", 45→"45s".
cl_dur() {
  local s=${1:-0}
  if   [ "$s" -ge 3600 ]; then printf '%dh%dm' $((s/3600)) $(((s%3600)/60))
  elif [ "$s" -ge 60   ]; then printf '%dm' $((s/60))
  else printf '%ds' "$s"; fi
}

# Links collector. The core owns where links render, so they look the same in
# every status line; core and extensions only DECLARE links. Categories: "gh"
# (GitHub issues/PRs) and "svc" (dashboards / running code), as two regions.
#
# cl_addlink CATEGORY URL [ICON] — declare a link. Appends to $CL_LINKS (set by the
# core); no-op if unset, so running an extension outside the core never errors.
cl_addlink() {
  [ -n "${CL_LINKS:-}" ] || return 0
  printf '%s\t%s\t%s\n' "${1:-svc}" "${3:-🔗}" "$2" >> "$CL_LINKS"
}

# cl_render_links CATEGORY — render that category's links as "ICON <url>" joined
# by two spaces. The visible text IS the URL (so it auto-links even where OSC-8
# isn't honoured, e.g. tmux over ssh), wrapped in OSC-8 too for terminals that do.
cl_render_links() {
  [ -n "${CL_LINKS:-}" ] && [ -f "$CL_LINKS" ] || return 0
  local cat=$1 out="" c icon url
  while IFS=$'\t' read -r c icon url; do
    [ "$c" = "$cat" ] && [ -n "$url" ] || continue
    out="${out}${out:+  }${icon} $(cl_link "$url" "$url")"
  done < "$CL_LINKS"
  printf '%s' "$out"
}

# cl_join SEP PART… — join the non-empty parts with SEP. Used to assemble both
# the core's regions and an extension's status segments, so empty pieces drop out
# cleanly and the separator styling lives in one place.
cl_join() {
  local sep=$1 out="" p; shift
  for p in "$@"; do [ -n "$p" ] && out="${out:+$out$sep}$p"; done
  printf '%s' "$out"
}

# cl_cache KEY TTL -- CMD...  — echo CMD's cached stdout; when older than TTL
# seconds, refresh it in a DETACHED process (the render only reads a file, so it
# stays instant; the fresh value lands next time). Use for anything slow or
# networked (gh, curl). A lock prevents duplicate refreshers; a stale one (>60s)
# is reaped. CMD must print its value to stdout.
cl_cache() {
  local key=$1 ttl=$2; shift 2
  [ "${1:-}" = "--" ] && shift
  local dir="${XDG_CACHE_HOME:-$HOME/.cache}/claude-statusline"
  mkdir -p "$dir" 2>/dev/null || true
  local cf; cf="$dir/$(printf '%s' "$key" | tr '/ :\t' '____')"
  local now; now=$(date +%s)
  if [ -d "$cf.lock" ] && [ $(( now - $(stat -c %Y "$cf.lock" 2>/dev/null || echo "$now") )) -gt 60 ]; then
    rmdir "$cf.lock" 2>/dev/null || true
  fi
  local fresh=0
  [ -f "$cf" ] && [ $(( now - $(stat -c %Y "$cf" 2>/dev/null || echo 0) )) -lt "$ttl" ] && fresh=1
  if [ "$fresh" -eq 0 ] && mkdir "$cf.lock" 2>/dev/null; then
    # $0=_ , $1=cachefile, $2..=CMD — capture CMD's stdout, write atomically,
    # release the lock. setsid/nohup so it outlives this render process.
    local runner='out="$("${@:2}")"; printf "%s" "$out" >"$1.tmp" 2>/dev/null && mv "$1.tmp" "$1" 2>/dev/null; rmdir "$1.lock" 2>/dev/null'
    if command -v setsid >/dev/null 2>&1; then
      setsid bash -c "$runner" _ "$cf" "$@" </dev/null >/dev/null 2>&1 &
    else
      nohup bash -c "$runner" _ "$cf" "$@" </dev/null >/dev/null 2>&1 &
    fi
    disown 2>/dev/null || true
  fi
  [ -f "$cf" ] && cat "$cf"
}
