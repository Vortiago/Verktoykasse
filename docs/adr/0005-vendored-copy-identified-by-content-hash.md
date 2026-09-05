# 0005: A vendored copy is identified by a hash of its bytes, not by a commit

- Status: Accepted
- Date: 2026-09-04
- Deciders: Atle

## Context

**Issue #74.** ADR 0001 made a vendored copy a committed, generated artifact carrying a
provenance stamp. The stamp named a git rev, and `tools/check-vendored.mjs` classified on
it: bytes equal to the stamped rev meant the copy was untouched and merely `stale`, and
anything else meant `forked`, the extend-don't-fork violation and the only classification
that exits non-zero.

The rev cannot carry that weight. The documented order is edit canon, sync, `git add`,
commit. At stamping time the canon edit is uncommitted, so `git rev-parse HEAD` names the
commit before the one whose bytes the copy receives. No command run at sync time can name
the right commit, because that commit does not exist yet. Squash merge widens the gap: a
branch rev may never reach `main` at all.

The error is invisible while canon sits still, because the checker compares content first
and reports `up-to-date`. It surfaces the moment canon moves again. The copy then matches
neither current canon nor the stamped rev, so the checker reports an untouched copy as
`forked`. That verdict prints a diffstat, exits non-zero, and offers a remedy that does
not apply.

## Decision

- **The stamp carries `sha256:<hex>` of the canon bytes**, and the checker classifies on
  that hash. A hash answers "which canon bytes is this", which is the question. A rev
  answers it only when commit timing happens to line up, which under the documented order
  it never does.
- **The rev stays, as provenance for a human**, documented as the toolkit HEAD at copy
  time. It also remains the fallback for a stamp written before this record, so an old
  copy still classifies instead of erroring.
- **The stamp is one line.** Every stripper is a substring filter: `grep -v "$strip"` in
  `lib-stamp.sh` and `sync-from-web.sh`, and a line-level regular expression in
  `check-vendored.mjs`. A second line without the strip substring survives stripping and
  breaks the body comparison. A second line carrying it restores the hazard the
  `stripStamp` pattern was shaped to avoid, of deleting a body line that mentions the
  prefix.
- **All three writers agree**: `sync-from-web.sh`, `vendor.sh` and `new-app.mjs` write the
  same shape, with the same ` - ` separator. `new-app.mjs` hashes the `Buffer` rather than
  a decoded string, because its copied set is wider and the guarantee must not rest on
  every future canon file being valid UTF-8.
- **A sync keeps a rev whose bytes have not moved.** The writer re-stamps a copy only when
  the recomputed hash differs from the recorded one. Without this rule every sync rewrites
  all 15 stamps, so a one-file canon change lands as a 15-file diff in which 14 files
  change only a rev that no longer decides anything.
- **A current body under a stamp that names other bytes is `stale`.** A re-copy that
  leaves the stamp line alone matches canon today, so a content-first verdict calls it
  up-to-date and says nothing. It reads as `forked` the moment canon moves next, which is
  this record's own failure with the hash in the rev's place. The remedy is the stamp
  alone, so the verdict is `stale` and the exit stays zero.
- **`sync-from-web.sh --check` verifies the hash as well as the body.** The checker that
  classifies is `gate: off` and runs nowhere in CI, so without this the stamp's own claim
  would never be tested. A body can match canon while the stamp records a hash of
  something else.

## Consequences

- A re-stamp is correct after the fact. A hash is computed from bytes, so the migration of
  every existing copy is correct by construction, which a rev re-stamp could never be.
- A `stale` line prints the exact values the new stamp needs, hash included, because the
  sync dialect has no re-stamping tool on the app side.
- The checker names a rev as "the stamped original" only when the bytes at that rev hash to
  the stamp. Otherwise it says so and diffs against current canon.
- The stamp line is long, about 150 characters. No checker measures line length.
- A `.json` copy carries no stamp and no hash. It cannot hold a comment, and the checker
  does not scan it.

## Alternatives considered

- **Widen the checker to search canon's history for matching bytes.** Rejected: it cannot
  separate "stale from a rev nobody recorded" from "forked", because in both cases the
  bytes are absent from the searched history.
- **Stamp from a git hook.** Rejected: the commit object does not exist before the commit,
  so `prepare-commit-msg` is too early and `post-commit` means amending.
- **Drop the rev from the classification and put nothing in its place.** Rejected: the
  `forked` verdict then has no basis at all, and that verdict is why the stamp exists.
- **Two lines, with the hash on its own line.** Rejected on the strip-substring argument
  above. It also leaves a shebang file's hash on line 3, the last line `parseStamp` reads.

## Notes

`tools/check-vendored.test.mjs` runs the checker against throwaway git checkouts. Its
first case is the reported shape: canon edited, then synced, then committed, then moved
again. It is verified to report `forked` against the pre-#74 checker and `stale` after.
