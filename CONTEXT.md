# Verktøykasse

A toolbox of LLM-consumed skills. The vanilla-* skills carry a zero-dependency,
no-build web toolkit whose files are distributed by copying, never by packaging.

## Language

### Distribution

**Canon**:
The single authoritative copy of a shared file. For the web toolkit it lives in
`vanilla-web`, and every other copy is derived from it.
_Avoid_: master copy, upstream, source of truth

**Vendored copy**:
A byte-copy of a canon file carried by a consumer (another skill or an app),
identified by its stamp. Edited only by re-copying from canon.
_Avoid_: fork, snapshot, mirror

**Stamp**:
The one-line provenance header on a vendored copy naming its canon path and the
commit it was copied at.
_Avoid_: banner, watermark

**Stale**:
A vendored copy that is untouched locally but whose canon has since moved.
Resolved by re-copying, and never an error.

**Forked**:
A vendored copy that differs from what its stamp says was copied: a local edit
that violates the extend-do-not-fork invariant. Always an error.
_Avoid_: diverged, dirty

### Quality

**Gate**:
The set of mechanical checks a session must pass before shipping. One command,
same locally and in CI.
_Avoid_: pipeline, checks, lint suite

**Gate half**:
One member check of the gate (typecheck, a `check-*` script, the test run). The
gate discovers its halves, so adding one is a file drop, not a docs change.

**Pinned environment**:
The single environment whose rendering owns the visual-regression baselines
(this repo: CI). Screenshots taken elsewhere are advisory, never authoritative.

**Explore issue**:
An issue whose resolution requires a prototype or measurement before an
implement/close decision. Not committable work as filed.
_Avoid_: spike (the outcome is a decision recorded on the issue, not code)

### Web toolkit

**Declarative face**:
The markup-facing way to reach component behaviour (`<vc-*>` elements, invoker
commands, popovers), as opposed to the factory (JS) contract underneath.

**Interaction hold**:
The condition of a host that a person is mid-interaction inside it: a control
focused, a popover/dialog open, or a text selection touching it. A live
re-render must not swap DOM out from under one.
_Avoid_: render skip, debounce

**Held swap**:
A region render deferred by an interaction hold rather than discarded. Exactly
one party owns landing it: the renderer itself, or the caller that asked only to
be told the host was held. It is dropped rather than landed if a later render
proves the DOM has caught up on its own.
_Avoid_: dropped render, skipped render, stale render

### Documentation language

**Rules file**:
`simplified-technical-english/ste-rules.md`, the single statement of the writing
rules. Symlinked to `~/.claude/rules/`, where its `paths:` frontmatter loads it
whenever Claude touches a markdown file. A consumer points at this path instead
of restating a rule. Today the only consumer is the `ste-review` subagent: no
other skill references it while it is new and unproven.
_Avoid_: style guide, linter config

**Path-scoped rule**:
A file in `.claude/rules/` whose `paths:` frontmatter limits it to matching files,
so it enters context on demand rather than every session. How guidance reaches an
agent here, as opposed to a skill, which the agent must choose to invoke.

**Honest limits of the writing rules**:
The rules fix the form of a text, not its substance. A paragraph with nothing to
say comes out short, clean, and still empty. No published evidence measures this
style as *input* to a model against agent task success, so applying it to files
an agent reads is an experiment. The standard is also in the training set, so
restating it may be partly redundant. This sits here rather than in the rules
file, because a rule file that is injected into context should not tell the model
its own rules might be redundant.

**Guidance, not enforcement**:
The deliberate position of these rules. They shape what an agent writes by being
in its context, and `ste-review` audits on request. Nothing blocks a write or a
commit. A mechanical checker was built and removed: it enforced the rules a
pattern can decide, and those are the least valuable ones.
