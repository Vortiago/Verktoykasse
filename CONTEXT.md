# Verktøykasse

A toolbox of LLM-consumed skills; the vanilla-* skills carry a zero-dependency,
no-build web toolkit whose files are distributed by copying, never by packaging.

## Language

### Distribution

**Canon**:
The single authoritative copy of a shared file. For the web toolkit it lives in
`vanilla-web`; every other copy is derived from it.
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
Resolved by re-copying; never an error.

**Forked**:
A vendored copy that differs from what its stamp says was copied — a local edit
that violates the extend-don't-fork invariant. Always an error.
_Avoid_: diverged, dirty

### Quality

**Gate**:
The set of mechanical checks a session must pass before shipping; one command,
same locally and in CI.
_Avoid_: pipeline, checks, lint suite

**Gate half**:
One member check of the gate (typecheck, a `check-*` script, the test run). The
gate discovers its halves; adding one is a file drop, not a docs change.

**Pinned environment**:
The single environment whose rendering owns the visual-regression baselines
(this repo: CI). Screenshots taken elsewhere are advisory, never authoritative.

**Explore issue**:
An issue whose resolution requires a prototype or measurement before an
implement/close decision — not committable work as filed.
_Avoid_: spike (the outcome is a decision recorded on the issue, not code)

### Web toolkit

**Declarative face**:
The markup-facing way to reach component behaviour — `<vc-*>` elements, invoker
commands, popovers — as opposed to the factory (JS) contract underneath.

**Interaction hold**:
`renderRegion`'s refusal to swap DOM while focus, an open popover/dialog, or a
text selection is live inside the host; the swap is deferred, not dropped.
_Avoid_: render skip, debounce
