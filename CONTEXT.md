# Verktøykasse

A toolbox of skills Claude reads and tools I run myself. The vanilla-* skills
carry a zero-dependency, no-build web toolkit whose files are distributed by
copying, never by packaging.

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
The one-line provenance header on a vendored copy, naming its canon path, a
sha256 of the canon bytes it carries, and the commit it was copied at. The hash
decides stale against forked. The commit is for a human reader.
_Avoid_: banner, watermark

**Stale**:
A vendored copy that is untouched locally but whose canon has since moved.
Resolved by re-copying, and never an error.

**Forked**:
A vendored copy that differs from what its stamp says was copied: a local edit
that violates the `extend-don't-fork` invariant. Always an error.
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

**Test audit**:
The classification, test by test, that `test-audit` produces for a change. One
audit covers every test the change adds.
_Avoid_: test scan, test review

**Battery**:
The set of typed SystemOne questions that `test-audit` asks about one test. All
questions of a battery share one read of the state and travel in one call.

**Check**:
One judgement in the battery: one question, or a paraphrase pair of one
judgement. Each check is one folder in `test-audit/checks/` that holds its
questions, its rubric definition, its sources, and the calibration cases meant
to catch its defect. Not a gate half.
_Avoid_: question (for a check of more than one phrasing)

**Paraphrase pair**:
Two or more logically equivalent phrasings of one question. The tool normalises
their polarity before it compares them. A disagreement beyond the stable band is
instability, not a tie to break.
_Avoid_: reworded question, duplicate question

**Needs-eyes**:
The verdict of a test whose verdict-carrying answers are untrusted, unstable or
show a defect, or whose score is slop or weak. The audit escalates the test to a
human. It never passes the test silently.
_Avoid_: flagged, failed

**Finding**:
What the reader of an audit should do with one test: drop it, fix it, look at
it, or nothing (ok). It carries its reasons, and whether the tool is sure. An
unsure finding may be a false positive. A test that needs eyes is never ok.
_Avoid_: result, recommendation

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
