# 0007: The CSS token vocabulary is gated, not documented

- Status: Accepted
- Date: 2026-09-17
- Deciders: Atle

## Context

The "new CSS system that works better for LLMs" going around in 2026 is **StyleX**, Meta's
compile-time CSS-in-JS. Linear moved to it from styled-components over ~1,000 PRs, and
Cursor moved to it from Tailwind, both announced in late August 2026. Linear's writeup
gives performance as the first driver (main-thread render CPU down 20–35%, CSS rule
injection during navigation from hundreds to zero) but names a second one explicitly:
*agent* ergonomics, because during the migration "it was uncomfortably easy for agents to
output something that looked correct but wasn't". The slogan the discourse settled on is
Lauren Tan's: **agents need constraints**.

The mechanism under the slogan is not the compiler and not the atomic CSS. It is that
StyleX gives an agent a *closed vocabulary with a machine-checkable boundary*: typed
tokens it cannot spell wrong, a deterministic merge order so a local edit cannot reach
into another component, and a compile error the moment it leaves the vocabulary. The
failure it prevents is specific and is the one measured everywhere this gets discussed:
asked for "a card with a subtle accent border", a model emits fluent, runnable CSS with an
invented hex, an invented padding, and a radius matching none of the project's four. It
knows CSS perfectly and knows *this* project's tokens not at all, so it falls back to the
most specific value it can emit. Nothing is broken, so nothing that looks for breakage
notices. The Tailwind-side answer to the same problem is the same shape without the
compiler — `@shadcn/lint`, an "agent-first" linter whose selling point is that it reports
not just what broke but *what to use instead*, grounded in the project's own theme.

None of that is adoptable here. StyleX is a build step, a runtime dependency and a React
component model; this stack's whole premise is none of the three. But the constraint it
sells is not the compiler's to sell. `@scope` already gives this stack the locality StyleX
gets from atomic class names, and `@layer` already gives it the deterministic precedence
StyleX gets from its merge order — both native, both already invariants (`reference/css.md`).
The one piece present as prose and absent as a mechanism was the closed vocabulary.
`tokens.css` has said "Components style ONLY through these tokens (never hard-coded
colors)" since it was written, and `check-css-vars` guards the mirror direction — a
`var(--x)` nobody defines — but nothing failed on a hex written straight into a
declaration. The library was clean by hand, which is the state a rule is cheapest to adopt
in and also the state in which its absence is invisible.

## Decision

- **A colour literal is legal in exactly one place: the value of a custom property.**
  Everywhere else it is `var(--token)`. Stated this way the rule needs no allow-list and
  no registry: the definition site *is* the exemption, so reaching for a colour the palette
  lacks means naming it first, and `tokens.css` stays the only place a colour is decided.
- **`tools/check-css-tokens.mjs` is a gate half**, alongside `check-css-vars`. Four rules,
  each the mechanically checkable half of a line already in `reference/css.md`:
  `raw-color`, `inline-style`, `unscoped-css`, `viewport-media`. Prose does not bind an
  agent that reads the skill once per session; a gate that runs on every check does. This
  is the same argument `check-conventions.mjs` already makes for the JS invariants, and
  the CSS invariants had no equivalent.
- **Every finding names the replacement**, resolved against the properties the tree
  actually defines — the exact token when the literal is a re-spell of one
  ("that value is already `--accent`"), otherwise the tokens defined for that property's
  family, otherwise an honest "no token for this family here". This is the `@shadcn/lint`
  property, and it is the part that earns the check its place: a checker that only says
  "no" costs a round-trip to go discover the vocabulary, which is the cost the rule was
  meant to remove. Advice is derived, never hardcoded, so renaming a token changes the
  advice without touching the checker.
- **The stack's own idioms are not drift.** `color-mix(…, black)` deriving a shade, and
  the `in oklch` colour-space keyword, are `reference/css.md`'s prescribed way to avoid
  five near-duplicate accents. A rule that failed on shipped library code on day one would
  be switched off by the end of the week, so both are asserted clean in the test rather
  than left to a reader's judgement.
- **Elevation becomes three tokens.** `dialog`, `menu` and `tooltip` each hand-rolled a
  `box-shadow` with its own geometry and its own alpha — three near-duplicates arrived at
  independently, which is exactly the drift the rule describes, reached by hand rather than
  by a model. `--shadow-1/2/3` plus `--scrim` carry the full `box-shadow` value, not just a
  colour, so "which elevation is this" is the only decision left at the call site. The
  values are byte-identical to what those three components already rendered, so the visual
  baselines do not move.
- **Escapes are comment-borne and visible**: `/* gate-allow: <rule> */` on the line or in
  the file header, the same dialect `check-conventions.mjs` already uses. A real exception
  should cost a line in the diff, not a silent pass.

## Consequences

- The rule is adopted at zero cost: both trees passed on the first clean run after the
  elevation tokens landed, so nothing in the library had to be restyled to satisfy it. Its
  whole value is prospective — it binds the next component, written by whoever or whatever
  writes it.
- `check-css-tokens` joins the gate by file drop (`check.mjs` globs `tools/check-*.mjs`)
  and reaches scaffolded apps for free (`new-app.mjs` globs `tools/*.mjs`). It is vendored
  into `vanilla-components` through `sync-from-web.sh` like every other shared tool.
- `preview.css` no longer spells colours inline. It was the only canon file that did, and
  three of its eleven literals were the same hairline colour written out three times — the
  near-duplicate problem in miniature, in the file that exists to demonstrate the library.
  Its locally-defined names stay deliberately un-shared with `tokens.css`, because the file
  must keep rendering with or without an app's tokens loaded.
- The checker parses CSS by walking braces rather than by one regex, because a selector
  (`a:hover`) and a declaration (`color: …`) are distinguishable only by whether the text
  ends at a `{` or a `;`. That is ~30 lines that a regex could not replace.
- `--shadow-1/2/3` are a scale by elevation, not by role. A fourth floating surface picks
  the nearest rung rather than adding a rung, or the scale stops being one.

## Alternatives considered

- **Adopt StyleX.** Rejected on the stack's premise, not on its merits: a compiler, a
  runtime dependency and a React component model, against "no build step, no runtime deps".
  Its actual guarantees are already held here by `@scope` and `@layer`, natively.
- **Adopt a utility framework (Tailwind + a token lint) instead.** Rejected for the same
  reason, plus it trades the problem for a worse one: utility chains put the styling
  vocabulary in the markup an agent must re-read on every pass, where `@scope`d CSS keeps
  it in one file per component.
- **Leave it as prose in `reference/css.md`.** Rejected — that is the status quo the
  research says fails. A skill is read once per session and a gate runs every check, and
  the whole finding is that the gap between those two is where drift lives.
- **Also gate the spacing scale.** Rejected *for now*, and not because it is wrong: 32 of
  68 spacing declarations in `vanilla-components` use raw px across ten distinct values
  (2,3,4,5,6,7,8,10,12) where `--space-*` offers four. That is real drift and the same
  argument applies. But unlike colour it cannot be adopted at zero cost — every fix is a
  visual decision with a screenshot baseline behind it, so it is a separate piece of work,
  not a rider on this one.
- **Have the checker suggest a nearest-colour match by computing distance in oklch.**
  Rejected: an exact match is a fact and is worth stating, while "this is 4% off
  `--text-dim`" is a guess that reads as authoritative. The honest fallback is to name the
  family and admit when it is empty.

## Notes

The primary sources for the StyleX material (Linear's engineering post, the StyleX docs,
the daisyUI and `@shadcn/lint` writeups) were not reachable from the session this was
written in — the egress policy allowed search but not fetches — so the Context section
rests on search-result summaries and is recorded here as the *reasoning* this decision was
taken on, not as verified quotation. The decision does not depend on the details: it turns
on a failure mode this repo can observe in its own history (three independently hand-rolled
shadows, eleven inline literals in `preview.css`), and the remedy is one this stack could
have adopted whatever Linear did.

`tools/check-css-tokens.test.mjs` asserts both directions, which is the point of having it:
that the rule fires on an invented hex and on a re-spelled token, and that it stays quiet
on `color-mix(…, black)`, on `in oklch`, on a selector, on a colour word inside a quoted
font family, and on a hex inside a comment.
