# test-audit references

Each source has a home beside the code that relies on it. This file is the index
to those homes, plus the background reading that no one file relies on.

## Where the sources are

- **A check:** the header comment of `checks/<check>/check.mjs` names each
  source. For each source it gives the citation, the URL, and what the check
  relies on. The header is the only list. `checks/checks.test.mjs` makes sure
  that each source has a URL, or is named as an inference.
- **A calibration case:** the header comment of
  `checks/<check>/cases/<case>/case.mjs` says what the case shows and names its
  source with a URL. The header is the only list: `calibration/labels.mjs`
  reads it, and the benchmark prints it. The model never sees the header,
  because the tool sends only the test call.
- **The twin rule and the position swap:** the header comment of
  [`classifier/verdict.mjs`](classifier/verdict.mjs). These are self-consistency,
  prompt sensitivity, position bias, and escalation instead of a vote.
- **The endpoint:** the header comment of
  [`classifier/systemone.mjs`](classifier/systemone.mjs). The SystemOne protocol
  and the reading of `mass` and `confidence` are in-house.
- **The house catalogue:**
  [`../verify-prd-implemented/test-patterns.md`](../verify-prd-implemented/test-patterns.md).
  It names the defects and holds the mutation check, which stays the proof. This
  tool only suspects a defect.

A source that a header calls an inference, or a house choice, is a design choice
of this tool. No source states it.

## Background reading

- Gerard Meszaros, xUnit Test Patterns (2007), the Test Smells index: code
  smells, behaviour smells, and project smells.
  http://xunitpatterns.com/Test%20Smells.html
- Anthony Peruma et al., tsDetect (FSE 2020). The tool behind testsmells.org.
  This page was not opened directly.
  https://testsmells.org/pages/testsmelldetector.html
- Kent Beck, Test Desiderata (2019), the original posts.
  https://medium.com/@kentbeck_7670/test-desiderata-94150638a4b3
- Birgitta Böckeler, Harness engineering for coding agent users (2026). Guides
  (feedforward) against sensors (feedback), and hooks as the enforcement path.
  This tool is a sensor. https://martinfowler.com/articles/harness-engineering.html

## Verification

The URLs in the check headers, the engine headers, and this file were opened or
resolved when they were added, except the tsDetect page, which is marked.
