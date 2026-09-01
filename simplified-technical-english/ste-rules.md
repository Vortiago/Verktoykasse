---
paths:
  - "**/*.md"
  - "**/*.markdown"
---

# Simplified Technical English

Write documentation people actually read: short, plain, one word per idea. This
file is the single source of these rules. It loads when you touch a markdown
file, and the `ste-review` subagent reviews against it. The rules cover a commit
message body and a PR body too.

Based on ASD-STE100 Simplified Technical English. It claims no compliance, and an
`[ASD n.n]` tag is a cross-reference, nothing more.

## Always

**Delete the semicolon.** Use two sentences. `[ASD 8.1]`

```
The gate runs; the hook does not.        →  The gate runs. The hook does not.
```

**No em dash.** Use a comma, a colon, or two sentences.

```
One command — same locally and in CI.    →  One command, same locally and in CI.
```

**No contraction.** Write the full form. `[ASD 4.2]`

```
don't  isn't  can't  it's  won't         →  do not  is not  cannot  it is  will not
```

A possessive is not a contraction. `the user's call` is correct.

**No Latin abbreviation.** `[ASD GR-6]`

```
e.g.  i.e.  etc.  vs.                    →  for example  that is  and so on  versus
```

**Write `through` or `with`, not `via`.** Pick whichever reads as English.

```
install via npm  →  install with npm      routed via  →  routed through
```

**No filler opener.** Delete it and start with the point.

```
It should be noted that the gate runs.   →  The gate runs.
In order to build, run make.             →  To build, run make.
At this point in time                    →  Now
Please note that                         →  (delete)
```

**Delete a claim word that carries no fact.** State the fact or say nothing.

```
simply  easily  seamlessly  just  →  (delete)
robust  powerful  comprehensive   →  name what it does
```

**Use the plain verb.** An inflated verb hides how small the action is.

```
utilise  leverage  facilitate  →  use  use  help
```

**Use the verb, not the noun built from it.** `[ASD 3.7]`

```
make a decision  →  decide      perform a check on  →  check
```

**Use a single-word verb.** `[ASD 9.3]`

```
kick off  spin up  tear down             →  start  start  remove
```

**Present tense for behaviour.** Reserve the future for a future event.

```
This will create a config file.          →  This creates a config file.
```

**Write British English.**

```
utilize  behavior  center  analyze       →  utilise  behaviour  centre  analyse
```

## Keep it short

**At most 20 words in a procedure step.** `[ASD 5.1]`
**At most 25 words in a sentence of description.** `[ASD 6.3]`
**At most 6 sentences in a paragraph.** `[ASD 6.6]`

These are limits, not targets. A parenthesised aside, a hyphenated compound, a
number with its unit, quoted text and a code span each count as one word.
`[ASD 8.5 to 8.7]`

## Shape of a document

**Open with the point.** The first sentence says what the thing is and does.

```
This document provides an overview of the gate.
   →  The gate is the set of checks a session must pass before shipping.
```

**End when the content ends.** A closing summary restates the body, so delete it.

**A list is for parallel items.** Write an argument, or a chain of reasoning, as
prose.

**Spell out an abbreviation at first use**, unless the field owns it. `API`,
`CI` and `URL` need none here.

## Procedures

**One instruction per step.** `[ASD 5.2]` A `then` inside a step is a second step.

```
2. Install the deps and then run the migration.
   →  2. Install the dependencies.
      3. Run the migration.
```

**Start a step with the action.** `[ASD 5.3]` A step that opens with `The`, `It`,
`There` or `You` plus a verb of being or a modal is a description.

```
1. The operator is required to open the console.   →  1. Open the console.
3. You should verify the token.                    →  3. Verify the token.
```

**Put the condition first, then a comma, then the command.** `[ASD 5.4]`

```
If the cache misses, query the datastore.
```

**Put the warning before the step it guards.** `[ASD 7]` A reader who meets the
prohibition after the action has already taken it. Start the warning with the
command, not with the reason.

```
3. Run `vendor.sh` to refresh the copy. Do not edit a vendored copy.
   →  3. Do not edit a vendored copy. Run `vendor.sh` to refresh it.
```

## Words and voice

**One term for one concept.** Pick one word for a thing and keep it for the whole
document. `[ASD 1.11]` This is the most valuable rule here, and the one that no
mechanical check can catch. It covers the reader as much as the subject.

```
endpoint / route / URL / path  for one idea    →  pick one and keep it
you / the user / the operator  for one reader  →  pick one and keep it
```

**Active voice, with the actor named.** `[ASD 3.6]` In description, use the
passive only when the actor is genuinely unknown.

```
The file is read by the loader.   →  The loader reads the file.
```

**At most three nouns in a row.** `[ASD 2.1]`

```
Widget Service Data Access Layer Configuration Manager
   →  the configuration manager for the widget datastore
```

**One topic per paragraph.** `[ASD 6.5]`

**Keep the reason where a reader needs judgement.** Cut it from a mechanical
step. A prohibition with no reason leaves the reader guessing what to do instead.

## The rest of the standard

This file adopts a subset of ASD-STE100 and rejects the rest. Apply no other
rule from the standard. Do not restrict modals: `should` stays `should`, and
`may have failed` is not `failed`. Do not ban compound tenses: `the job has
completed` is not `the job completed`. Do not check words against the STE
approved-word list. `docs/adr/0003-ste-rules-adopt-a-subset.md`, in this
file's repo, records why.
