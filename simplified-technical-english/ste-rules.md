# Simplified Technical English

Apply these rules to all text you write for a reader: a markdown file, a plan
file, a commit or PR body, and your replies in this terminal. Apply them while
you write. Apply them to text you paste or copy in too.

## Before you write

**Use one word for one thing.** Pick one word for a thing and use it in the
whole document. This is the most important rule. It applies to the reader too:
`endpoint / route / URL` for one thing is one word, and so is
`you / the user / the operator` for one reader.

**Start with the point.** The first sentence says what the thing is and does.
`This document provides an overview of the gate.` → `The gate is the set of
checks a session must pass before shipping.`

**Leave the text cleaner than you found it.** Apply the rules to the text
around your change too.

## Always

**Use two sentences where a semicolon would go.** `The gate runs; the hook does
not.` → `The gate runs. The hook does not.`

**Use a comma, a colon or two sentences where an em dash would go.**

**Write the full form of a verb.** `don't isn't can't it's won't` → `do not is
not cannot it is will not`. A possessive stays: `the user's call`.

**Write the English words for a Latin abbreviation.** `e.g. i.e. etc. vs.` →
`for example`, `that is`, `and so on`, `versus`.

**Write `through` or `with` where `via` would go.** Pick the one that reads as
English.

**Start the sentence with its content.** `It should be noted that` and
`Please note that` go. `In order to` → `To`. `At this point in time` → `Now`.

**Replace a word that praises with the fact.** `simply easily seamlessly just`
go. `robust powerful comprehensive` → say what it does.

**Use the plain verb.** `utilise leverage facilitate` → `use use help`.

**Use the verb, not the noun made from it.** `make a decision` → `decide`.
`perform a check on` → `check`.

**Use a one-word verb.** `kick off spin up tear down` → `start start remove`.

**Use the present tense for behaviour.** `This will create a file.` → `This
creates a file.` Use the future only for a future event.

**Write British English.** `utilize behavior center analyze` → `utilise
behaviour centre analyse`.

## Keep it short

**At most 20 words in a procedure step.**
**At most 25 words in a sentence of description.**
**At most 6 sentences in a paragraph.**

These are limits, not targets. Each of these counts as one word: a text in
brackets, a hyphenated word, a number with its unit, a quote and a code span.

## Shape of a document

**Stop after the last fact.** A closing summary only repeats the body.

**Use a list for items of the same kind.** Write an argument, or a chain of
reasons, as prose.

**Spell out an abbreviation the first time you use it.** A common one needs
nothing: `API`, `CI` and `URL`.

## Procedures

**Give one instruction in each step.** A `then` inside a step starts a second
step. `2. Install the deps and then run the migration.` → two numbered steps.

**Start a step with its verb.** `1. You should verify the token.` →
`1. Verify the token.`

**Put the condition first, then a comma, then the command.**
`If the cache misses, query the datastore.`

**Put the warning before the step it is for.** Start with the command, then the
reason. `Run vendor.sh to refresh the copy. Do not edit a vendored copy.` →
`Do not edit a vendored copy. Run vendor.sh to refresh it.`

## Words and voice

**Use the active voice, and name who does it.** `The file is read by the
loader.` → `The loader reads the file.` Use the passive only when nobody knows
who does it.

**Use at most three nouns in a row.** `Widget Service Data Access Layer
Configuration Manager` → `the configuration manager for the widget datastore`.

**Keep one topic in each paragraph.**

**Give the reason when the reader must decide something.** Leave it out of a
simple step. A warning without a reason leaves the reader unsure what to do.

**Keep the word that says how sure you are.** `should` stays `should`, and
`may have failed` stays `may have failed`.

**Keep a tense that describes a state.** `the job has completed` stays
`the job has completed`.
