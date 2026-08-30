#!/usr/bin/env bash
# Link the live skill paths to this repo (dotfiles pattern). Idempotent.
# A real directory at a live path is backed up to <path>.pre-verktoykasse
# rather than overwritten.
#
# The CALLER decides target + skills; this installer holds NO skill->CLI policy,
# only where each CLI keeps its skills (TARGET_DIR).
#
# Usage:
#   ./install.sh [skill...]                     install (all, or the named) for Claude
#   ./install.sh --target opencode [skill...]   install for OpenCode (plain symlink, no hooks)
#
# Targets: claude (default) | opencode.
# A skill's own <skill>/install.sh (hooks / extra setup) is Claude-specific, so it is
# sourced ONLY for the claude target; every other target gets a plain symlink of the dir.
set -euo pipefail

HERE=$(dirname "$(readlink -f "$0")")

# Git Bash defaults to COPYING on `ln -s`, silently. nativestrict makes ln either
# create a real symlink or fail, so link() can tell the two apart and say which it
# did. No effect off Windows, where MSYS is not read.
export MSYS=winsymlinks:nativestrict

# A copied skill does not track the repo: edit the repo and the live copy is stale
# until the next install. That is worth a warning, but not worth refusing to
# install, so link() falls back to copying and says so. This flag drives the
# summary at the end.
COPIED_ANY=0

# Windows only, and only reached when `ln -s` was refused: a junction is a
# reparse point that tracks its target the way a symlink does, but it is created
# through FSCTL_SET_REPARSE_POINT rather than CreateSymbolicLinkW, so it needs no
# privilege and no Developer Mode. Directories only, and the target must be local
# and absolute — both true of every path this installer links.
#
# NOT the same as MSYS=winsymlinks:junction, which writes an emulated stand-in
# that Windows reads as an ordinary file. This shells out so Windows makes a real
# one, which `test -L` and `readlink -f` then treat exactly like a symlink.
try_junction() { # $1 = target dir, $2 = live path — 0 if a junction now exists
  local target=$1 live=$2
  command -v cygpath >/dev/null 2>&1 || return 1
  [[ -d $target ]] || return 1        # a junction cannot point at a file
  # //J, not /J: MSYS rewrites a lone leading slash into a path.
  cmd //c mklink //J "$(cygpath -w "$live")" "$(cygpath -w "$target")" >/dev/null 2>&1 || return 1
  [[ -L $live ]]
}

# Records that a live path is OUR copy, and of what. Without it a re-run cannot
# tell its own copy from a file that was already there, so it would "back up" the
# copy it wrote last time, once per run, forever.
#
# A directory carries the marker inside it; a file cannot, so it gets a hidden
# sidecar next to it. Two spellings, one question, hence one pair of helpers.
# Keyed on the SOURCE, not on the live path: when refreshing, the live path has
# already been removed, so asking whether IT is a directory would answer for a
# path that no longer exists.
copy_marker() { # $1 = live path, $2 = source — prints where the marker lives
  local live=$1 target=$2
  if [[ -d $target ]]; then echo "$live/.verktoykasse-copy"
  else echo "$(dirname "$live")/.$(basename "$live").verktoykasse-copy"; fi
}
is_our_copy() { # $1 = live path, $2 = expected source — true if we wrote it
  local marker; marker=$(copy_marker "$1" "$2")
  [[ -f $marker ]] && [[ $(cat "$marker") == "$2" ]]
}

# Where each CLI keeps its skills. A function (not a `declare -A` associative
# array) so this runs on macOS's stock bash 3.2, which predates `declare -A`.
target_dir() { # $1 = target name — prints its skills dir, empty if unknown
  case $1 in
    claude)   echo "$HOME/.claude/skills" ;;
    opencode) echo "$HOME/.config/opencode/skills" ;;
  esac
}
KNOWN_TARGETS="claude opencode"
TARGET=claude

link() { # $1 = repo dir, $2 = live path
  local target=$1 live=$2
  local marker ours=0
  marker=$(copy_marker "$live" "$target")
  is_our_copy "$live" "$target" && ours=1
  # A directory's marker lives inside it and goes when the copy goes. A file's
  # sidecar sits alongside, so it would outlive the copy and later misreport a
  # symlink as ours. Drop it now; the copy path below re-writes it if it copies.
  [[ $marker == "$live/"* ]] || rm -f "$marker"

  if [[ -L $live ]]; then
    [[ $(readlink -f "$live") == "$target" ]] && { echo "ok      $live"; return; }
    rm "$live"
  elif [[ $ours -eq 1 ]]; then
    # Our own copy from a previous run. Refresh it in place: backing it up would
    # be filing a stale copy of the repo against the repo it came from.
    rm -rf "$live"
  elif [[ -e $live ]]; then
    # Something we did not put there. Back it up, once: a second run must not fail
    # because the first already took the name, so keep the ORIGINAL backup (the
    # more pristine one) and discard the later arrival.
    if [[ -e $live.pre-verktoykasse ]]; then
      echo "backup  $live.pre-verktoykasse exists, discarding the newer copy"
      rm -rf "$live"
    else
      mv "$live" "$live.pre-verktoykasse"
      echo "backup  $live -> $live.pre-verktoykasse"
    fi
  fi
  mkdir -p "$(dirname "$live")"

  # Three rungs, best first. nativestrict means ln fails rather than copying, so a
  # failure here is the no-Developer-Mode case rather than a broken path.
  if ln -s "$target" "$live" 2>/dev/null && [[ -L $live ]]; then
    echo "linked  $live -> $target"
    return
  fi
  rm -rf "$live"

  # Second rung: a junction still tracks the repo, so an edit here stays live.
  # Only Windows has them, and only for a directory; try_junction returns 1
  # everywhere else, which falls through to the copy.
  if try_junction "$target" "$live"; then
    echo "linked  $live -> $target  (junction)"
    return
  fi
  rm -rf "$live"
  cp -r "$target" "$live"
  printf '%s\n' "$target" > "$(copy_marker "$live" "$target")"
  COPIED_ANY=1
  echo "copied  $live <- $target  (not a symlink)"
}

install_skill() { # $1 = skill name — installed for the current $TARGET
  # NOTE: skills are keyed by DIRECTORY name here; a skill's invocation name comes
  # from its SKILL.md `name:` frontmatter and may differ — e.g. the `statusline/`
  # dir is invoked as `/expand-statusline`.
  local name=$1
  [[ -d "$HERE/$name" ]] || { echo "error: no skill '$name' in $HERE" >&2; return 1; }
  # SKILL.md is what makes a directory a skill, so its absence is what makes one not.
  # Keyed on the file rather than on a list of names: `docs/` (ADRs) and `oclaude/`
  # (a PowerShell launcher the user runs) are both not skills, and neither is
  # whatever lands here next.
  [[ -f "$HERE/$name/SKILL.md" ]] || { echo "skip    $name (no SKILL.md, not a skill)"; return; }
  if [[ $TARGET == claude && -f "$HERE/$name/install.sh" ]]; then
    # Claude-specific hooks / extra setup — only for the claude target.
    # shellcheck source=/dev/null
    source "$HERE/$name/install.sh"
  else
    link "$HERE/$name" "$(target_dir "$TARGET")/$name"
  fi
}

skills=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET=${2:?--target needs a value}; shift 2 ;;
    --target=*) TARGET=${1#*=}; shift ;;
    *) skills+=("$1"); shift ;;
  esac
done
[[ -n $(target_dir "$TARGET") ]] || {
  echo "error: unknown target '$TARGET' (have: $KNOWN_TARGETS)" >&2; exit 1; }

if [[ ${#skills[@]} -eq 0 ]]; then
  for d in "$HERE"/*/; do
    skills+=("$(basename "$d")")
  done
fi

echo "target: $TARGET -> $(target_dir "$TARGET")"
for s in "${skills[@]}"; do
  install_skill "$s"
done

# Last thing printed, because it is the one thing that changes how the install
# behaves from here on: a copy does not follow the repo.
if [[ $COPIED_ANY -eq 1 ]]; then
  cat >&2 <<'EOF'

warn: some paths above were COPIED in rather than linked. A copy does not track
      this repo: edit the source here and the installed copy stays on the old
      version until you re-run ./install.sh.
      On Windows this means a symlink was refused. Skill directories fall back
      to a junction, which does track the repo, so what remains copied is the
      individual files. To link everything, turn on
      Settings > System > For developers > Developer Mode (or run this from an
      elevated shell) and re-run ./install.sh. It replaces each copy with a link.
EOF
fi
