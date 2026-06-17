# Testing a status-line extension

Run the extension two ways: directly (fast feedback on the status segment and the
links it declares) and through the core (the full line exactly as the bar renders
it).

```bash
# Direct: feed env + stdin; see the status segment AND the links it declared.
links=$(mktemp); CL_LINKS=$links CL_LIB="$PWD/lib.sh" CL_ROOT=/path/to/repo \
  CL_PROJECT=Foo CL_BRANCH=main CL_SLUG=owner/foo CL_HOST=github.com \
  bash /path/to/repo/.claude/statusline-ext.sh <<<'{"cwd":"/path/to/repo"}'
echo; cat "$links"   # declared links: <category> <icon> <url>

# Through the core: the full line (regions + status), exactly as the bar runs it.
echo '{"cwd":"/path/to/repo"}' | bash ~/.claude/statusline.sh

# Confirm links are full URLs + OSC-8 wrapped: pipe the above to `cat -v`.
```
