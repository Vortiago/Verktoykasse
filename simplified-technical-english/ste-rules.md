---
paths:
  - "**/*.md"
  - "**/*.markdown"
---

# Simplified Technical English

Write documentation people actually read: short, plain, one word per idea. This
file is the single source of these rules. It loads automatically when you touch a
markdown file, and the `ste-review` agent reviews against it. Nothing restates it,
so there is one place to change a rule.

The rules apply to a commit message body and a PR body too, but no other skill
references this file yet. Ask `ste-review` if you want either checked.

Based on ASD-STE100 Simplified Technical English. Not compliant with it, and no
compliance is claimed. An `[ASD n.n]` tag is a cross-reference, nothing more.

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
e.g.  i.e.  etc.  vs.  via              →  for example  that is  and so on  against  through
```

**No filler opener.** Delete it and start with the point.

```
It should be noted that the gate runs.   →  The gate runs.
In order to build, run make.             →  To build, run make.
At this point in time                    →  Now
Please note that                         →  (delete)
```

**Use the verb, not the noun built from it.** `[ASD 3.7]`

```
make a decision      →  decide
perform a check on   →  check
provide the ability to  →  let
give consideration to   →  consider
```

**One verb, not two.** `[ASD 9.3]`

```
kick off  spin up  tear down             →  start  start  remove
```

## Keep it short

**At most 20 words in a procedure step.** `[ASD 5.1]`
**At most 25 words in a sentence of description.** `[ASD 6.3]`
**At most 6 sentences in a paragraph.** `[ASD 6.6]`

These are limits, not targets. A parenthesised aside, a hyphenated compound, a
number with its unit, quoted text and a code span each count as one word.
`[ASD 8.5 to 8.7]`

## Procedures

**One instruction per step.** `[ASD 5.2]` A `then` inside a step is a second step.

```
2. Install the deps and then run the migration.
   →  2. Install the dependencies.
      3. Run the migration.
```

**Start a step with the action.** `[ASD 5.3]` A step that opens with `The`, `It`,
`There` or `You` plus a verb of being is a description, not an instruction.

```
1. The operator is required to open the console.   →  1. Open the console.
3. You should verify the token.                    →  3. Verify the token.
```

**Put the condition first, then a comma, then the command.** `[ASD 5.4]`

```
If the cache misses, query the datastore.
```

## Words and voice

**One term for one concept.** Pick one word for a thing and keep it for the whole
document. `[ASD 1.11]` This is the most valuable rule here, and the one that no
mechanical check can catch.

```
endpoint / route / URL / path  for one idea   →  pick one and keep it
```

**Active voice, with the actor named.** `[ASD 3.6]` In description, passive is
allowed only when the actor is genuinely unknown.

```
The file is read by the loader.   →  The loader reads the file.
```

**At most three nouns in a row.** `[ASD 2.1]`

```
Widget Service Data Access Layer Configuration Manager
   →  the configuration manager for the widget datastore
```

**One topic per paragraph.** `[ASD 6.5]`

## Rules we deliberately reject

These are real ASD-STE100 rules. Do not apply them here, and this is why.

- **The modal restriction** (approve only `can`, `will`, `must`; rewrite `should`
  to `must`). The worst rule for text an agent reads: it turns a soft default into
  a hard requirement, and destroys the hedging an agent needs. `may have failed`
  is not `failed`.
- **An approved-word allowlist.** Flagging every word outside a fixed list fires
  constantly on ordinary prose, and it fights the advice to write in the words a
  reader actually uses.
- **The ban on compound tenses.** It loses a state distinction that matters:
  `the job has completed` is not `the job completed`.
- **Cutting the rationale.** One Anthropic worked example labels a 4-word
  prohibition less effective than a 27-word sentence that explains itself. Keep
  the reason where a reader needs judgement. Cut it from a mechanical step.
- **American spelling.** Write British English, as the rest of this repo does.

## Not covered by these rules

Never apply the rules to text that is not yours to edit:

- **Fenced code and inline code spans.** A semicolon in JavaScript is syntax.
- **A blockquote.** It is a verbatim quotation, and editing its punctuation would
  falsify it.
- **A quoted error message, a command line, a path, a URL, an identifier.**
- **A table cell** may drop articles and use fragments. It is a label, not prose.

When a rule genuinely fights the meaning, keep the meaning and say why in the
text. These rules serve the reader.

## The honest limits

- The rules fix the form of a text, not its substance. A paragraph with nothing
  to say comes out short, clean, and still empty.
- No published evidence measures this style as **input** to a model against agent
  task success. Applying it to files an agent reads is an experiment.
- A standing critique worth knowing: the standard is in the training set, so
  restating it may be partly redundant.
