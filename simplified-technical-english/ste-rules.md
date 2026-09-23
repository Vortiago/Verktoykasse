# Simplified Technical English

Apply these rules to everything you write for a reader: a markdown file, a plan
file, a commit or PR body, and your own replies in this terminal. Apply them as
you write, not in a review pass after, and to text you paste or port in as much
as to text you compose.

## Before you write

**One term for one concept.** Pick one word for a thing and keep it for the whole
document. This is the most valuable rule here. It covers the reader as much as
the subject: `endpoint / route / URL`
for one idea, or `you / the user / the operator` for one reader, is one word.

**Open with the point.** The first sentence says what the thing is and does.
`This document provides an overview of the gate.` → `The gate is the set of
checks a session must pass before shipping.`

**Write the new line to the rules, even where the lines around it predate them.**
The lines you did not touch stay as their author wrote them.

## Always

**Delete the semicolon.** `The gate runs; the hook does not.` becomes two
sentences.

**No em dash.** Use a comma, a colon, or two sentences.

**No contraction.** `don't isn't can't it's won't` → `do not is not cannot it is
will not`. A possessive is not a contraction: `the user's call` is correct.

**No Latin abbreviation.** `e.g. i.e. etc. vs.` → `for example`, `that is`,
`and so on`, `versus`.

**Write `through` or `with`, not `via`.** Pick whichever reads as English.

**No filler opener.** `It should be noted that` and `Please note that` go.
`In order to` → `To`. `At this point in time` → `Now`.

**Delete a claim word that carries no fact.** `simply easily seamlessly just`
go. `robust powerful comprehensive` → name what it does.

**Use the plain verb.** `utilise leverage facilitate` → `use use help`.

**Use the verb, not the noun built from it.** `make a decision` → `decide`.
`perform a check on` → `check`.

**Use a single-word verb.** `kick off spin up tear down` → `start start remove`.

**Present tense for behaviour.** `This will create a file.` → `This creates a
file.` Reserve the future for a future event.

**Write British English.** `utilize behavior center analyze` → `utilise
behaviour centre analyse`.

## Keep it short

**At most 20 words in a procedure step.**
**At most 25 words in a sentence of description.**
**At most 6 sentences in a paragraph.**

These are limits, not targets. A parenthesised aside, a hyphenated compound, a
number with its unit, quoted text and a code span each count as one word.

## Shape of a document

**End when the content ends.** A closing summary restates the body, so delete it.

**A list is for parallel items.** Write an argument, or a chain of reasoning, as
prose.

**Spell out an abbreviation at first use**, unless the field owns it. `API`,
`CI` and `URL` need none here.

## Procedures

**One instruction per step.** A `then` inside a step is a second step.
`2. Install the deps and then run the migration.` becomes two numbered steps.

**Start a step with the action.** A step opening with `The`, `It`, `There` or
`You` plus a verb of being or a modal is a description.
`1. You should verify the token.` → `1. Verify the token.`

**Put the condition first, then a comma, then the command.**
`If the cache misses, query the datastore.`

**Put the warning before the step it guards.** A reader who meets the
prohibition after the action has already taken it. Start with the command, not
the reason. `Run vendor.sh to refresh the copy. Do not edit a vendored copy.` →
`Do not edit a vendored copy. Run vendor.sh to refresh it.`

## Words and voice

**Active voice, with the actor named.** `The file is read by the loader.` →
`The loader reads the file.` In description, use the passive only when the actor
is genuinely unknown.

**At most three nouns in a row.** `Widget Service Data Access Layer
Configuration Manager` → `the configuration manager for the widget datastore`.

**One topic per paragraph.**

**Keep the reason where a reader needs judgement.** Cut it from a mechanical
step. A prohibition with no reason leaves the reader guessing what to do instead.

**Keep the modal that says how sure you are.** `should` stays `should`, and
`may have failed` stays `may have failed`.

**Keep a compound tense that names a state.** `the job has completed` stays
`the job has completed`.
