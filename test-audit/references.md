# test-audit references

What grounds each question in the battery and each named defect. The classifier is
an inferential sensor: it suspects, it does not prove. The mutation check in
[`../verify-prd-implemented/test-patterns.md`](../verify-prd-implemented/test-patterns.md)
stays the proof.

## 1. Source map

### Battery questions

| Key | What it asks | Source(s) |
| --- | --- | --- |
| `can_fail_a` | could a change to the code under test make this fail? | Beck, Test Desiderata (`Behavioral`); WPT checklist, "fails when it's supposed to fail"; Meszaros, `Erratic Test`; Google mutation testing; Just et al. 2014 |
| `can_fail_b` | does it pass regardless of correctness? (negated twin) | the same sources as `a`; self-consistency (Wang et al. 2022) and prompt sensitivity (Sclar et al. 2024) for the twin |
| `can_fail_c` | if the behaviour regresses, will it fail? | the same sources as `a`; WPT checklist |
| `asserts_a` | behaviour, hardcoded-data, shape-only, interaction-only, nothing | testsmells.org (`Redundant Assertion`, `Unknown Test`, `Magic Number Test`, `Sensitive Equality`); Meszaros, `Obscure Test` (`Hard-Coded Test Data`, `Indirect Testing`); Fowler, "Mocks Aren't Stubs"; house catalogue |
| `asserts_b` | the same, with the answer order reversed (position control) | MT-Bench (Zheng et al. 2023), position and verbosity bias; "Large Language Models are not Fair Evaluators" (Wang et al. 2023), balanced position calibration |
| `type` | unit, integration, regression, e2e, smoke, characterization | Meszaros, `Test Organization` and `Test Strategy`; Feathers, characterization testing. The exact six labels are house choice (inference) |
| `deterministic` | no time, order, network, or sleep | Beck, `Deterministic` and `Isolated`; Meszaros, `Erratic Test` (`Nondeterministic Test`, `Resource Optimism`, `Interacting Tests`, `Test Run War`); testsmells.org (`Sleepy Test`, `Mystery Guest`, `Resource Optimism`, `Conditional Test Logic`) |
| `one_thing` | one behaviour, not an eager test | Meszaros, `Eager Test` (under `Obscure Test` and `Assertion Roulette`); testsmells.org, `Eager Test` |
| `name_matches` | does the body assert what the name states? | WPT checklist, "testing what it thinks it's testing"; testsmells.org, `Unknown Test`; Meszaros, `Obscure Test`; house catalogue, name-only |
| `observable` | behaviour, not internals, call order, or collaborator interactions | Meszaros, `Indirect Testing`; Fowler, "Mocks Aren't Stubs"; testsmells.org, `Redundant Assertion` |
| `conditional` | the assertion always runs, no branch, loop, or catch skips it | Meszaros, `Conditional Test Logic`; testsmells.org, `Conditional Test Logic` |
| `isolated` | passes alone and in any order, no shared mutable state | Beck, `Isolated`; Meszaros, `Interacting Tests`, `Test Run War`, `Unrepeatable Test` |
| `controlled` | controls time, network, filesystem, and environment | Meszaros, `Resource Optimism`, `Mystery Guest`; testsmells.org, `Mystery Guest` |
| `specific` | the most specific assertion for the failure | WPT checklist, "the most specific asserts possible"; testsmells.org, `Sensitive Equality` |
| `named` | the name states the behaviour and expected result | Meszaros, `Obscure Test`; testsmells.org, `Unknown Test` |
| `verdict` | slop, weak, good, strong | synthesis of the rows above; the four levels and the cross-question rule are house (inference) |

### Static flags

| Flag | Defect | Source(s) |
| --- | --- | --- |
| `skipped` / `focused` | ignored or focused test | testsmells.org, `Ignored Test`; house catalogue |
| `empty` | empty body | testsmells.org, `Empty Test` |
| `unknown` | no assertion at all | testsmells.org, `Unknown Test` |
| `commented-assert` | a comment-borne deleted check | WPT checklist, "The test does not contain commented-out code"; house catalogue |
| `roulette` | several assertions, no message | Meszaros, `Assertion Roulette`; testsmells.org, `Assertion Roulette` |
| `non-deterministic`, `eager`, `name-mismatch` | descriptive flags, no escalation | the rows above |

### Named defects

| Defect | Source(s) |
| --- | --- |
| tautology / self-reference | testsmells.org, `Redundant Assertion`; house catalogue |
| vacuous / passes-with-zero | house catalogue; WPT checklist, "fails when it's supposed to fail"; Beck, `Behavioral` |
| shape-not-value | house catalogue; testsmells.org, `Sensitive Equality`, `Redundant Assertion` |
| interaction-only / mock-only | Fowler, "Mocks Aren't Stubs" (behaviour against state verification); house catalogue |
| hardcoded-data / magic number | Meszaros, `Hard-Coded Test Data`; testsmells.org, `Magic Number Test`; house catalogue |
| nothing asserted | testsmells.org, `Unknown Test`; house catalogue |
| name-only | WPT checklist, "testing what it thinks it's testing"; testsmells.org, `Unknown Test`; house catalogue |
| only-negative / no positive pair | house catalogue (inference from the mutation check) |
| passes-for-the-wrong-reason | house catalogue, mutation check; Meszaros, `Obscure Test`; Google mutation testing |
| obscure test | Meszaros, `Obscure Test` |
| eager test | Meszaros, `Eager Test`; testsmells.org, `Eager Test` |
| assertion roulette | Meszaros, `Assertion Roulette`; testsmells.org, `Assertion Roulette` |
| conditional test logic | Meszaros, `Conditional Test Logic`; testsmells.org, `Conditional Test Logic` |
| erratic / non-deterministic test | Meszaros, `Erratic Test`; Beck, `Deterministic`, `Isolated` |
| sleepy test | testsmells.org, `Sleepy Test` |
| mystery guest | Meszaros, `Mystery Guest`; testsmells.org, `Mystery Guest` |
| slow test (related, not a battery item) | Meszaros, `Slow Tests` |

## 2. Sources

### Test quality and design

- **Kent Beck, Test Desiderata**. https://kentbeck.github.io/TestDesiderata/
  Grounds falsifiability (`Behavioral`), determinism (`Deterministic`),
  independence (`Isolated`), and the readable and specific properties.
  Original papers: https://medium.com/@kentbeck_7670/test-desiderata-94150638a4b3
- **Gerard Meszaros, xUnit Test Patterns** (2007). http://xunitpatterns.com/
  The test-smell taxonomy: code smells, behaviour smells, project smells.
- **Obscure Test** (holds `Eager Test`, `Mystery Guest`, `General Fixture`,
  `Irrelevant Information`, `Hard-Coded Test Data`, `Indirect Testing`).
  http://xunitpatterns.com/Obscure%20Test.html
- **Erratic Test** (holds `Nondeterministic Test`, `Unrepeatable Test`,
  `Interacting Tests`, `Resource Optimism`, `Test Run War`).
  http://xunitpatterns.com/Erratic%20Test.html
- **Assertion Roulette** (holds `Eager Test` and `Missing Assertion Message`).
  http://xunitpatterns.com/Assertion%20Roulette.html
- **Conditional Test Logic**. http://xunitpatterns.com/Conditional%20Test%20Logic.html
- **Test Smells index** (the three categories). http://xunitpatterns.com/Test%20Smells.html
- **testsmells.org, Open Catalog of Test Smells** (19 smells with a detection
  strategy each). https://testsmells.org/pages/testsmells.html
  Site home: https://testsmells.org/
  Tool paper: Peruma et al., tsDetect, FSE 2020,
  https://testsmells.org/pages/testsmelldetector.html (page listed by the site;
  not opened directly).
- **Michael Feathers, Characterization Testing** (2016).
  https://michaelfeathers.silvrback.com/characterization-testing
  Grounds the `characterization` test type.

### Falsifiability and the review checklists

- **Web Platform Tests, Review Checklist**.
  https://web-platform-tests.org/reviewing-tests/checklist.html
  The exact phrasings "The test fails when it's supposed to fail", "The test is
  testing what it thinks it's testing", "The test uses the most specific asserts
  possible", and "The test does not contain commented-out code".
- **Google, State of Mutation Testing at Google** (Petrovic and Ivankovic,
  ICSE-SEIP 2018). https://research.google/pubs/state-of-mutation-testing-at-google/
  Mutation testing as test-suite efficacy at industrial scale.
- **Just et al., Are Mutants a Valid Substitute for Real Faults in Software
  Testing?** (FSE 2014). https://doi.org/10.1145/2635868.2635929
  Mutation score as a proxy for real-fault detection.
- **Jia and Harman, An Analysis and Survey of the Development of Mutation
  Testing** (IEEE TSE 2011). https://doi.org/10.1109/TSE.2010.62

### Interaction and mocking

- **Martin Fowler, Mocks Aren't Stubs** (2007).
  https://martinfowler.com/articles/mocksArentStubs.html
  State against behaviour verification: grounds `interaction-only`.

### Guides against tools/hooks

- **Birgitta Böckeler, Maintainability sensors for coding agents** (27 May 2026).
  https://www.martinfowler.com/articles/sensors-for-coding-agents.html
  Sensors against guides, computational against inferential, and mutation
  testing as a regression sensor for AI-written tests.
- **Birgitta Böckeler, Harness engineering for coding agent users** (2 April 2026).
  https://martinfowler.com/articles/harness-engineering.html
  Guides (feedforward) against sensors (feedback), and hooks as the enforcement
  path.

### LLM-as-judge reliability

- **Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena**
  (NeurIPS 2023). https://arxiv.org/abs/2306.05685
  Position, verbosity and self-enhancement bias, and agreement with humans.
- **Wang et al., Large Language Models are not Fair Evaluators** (2023).
  https://arxiv.org/abs/2305.17926
  Position bias, and balanced position calibration by order aggregation.
- **Tian et al., Just Ask for Calibration** (EMNLP 2023).
  https://arxiv.org/abs/2305.14975
  Calibration of confidence scores from RLHF language models.
- **Wang et al., Self-Consistency Improves Chain of Thought Reasoning** (ICLR 2023).
  https://arxiv.org/abs/2203.11171
  Sampling several paths and taking the consistent answer.
- **Sclar et al., Quantifying Language Models' Sensitivity to Spurious Features
  in Prompt Design** (ICLR 2024). https://arxiv.org/abs/2310.11324
  Small, meaning-preserving prompt changes move accuracy by large margins.

### House catalogue

- **`verify-prd-implemented/test-patterns.md`** and
  **`verify-prd-implemented/SKILL.md`** in this repo.
  The named defect list (tautology, vacuous, shape-not-value, name-only,
  skipped, commented-out, passes-for-the-wrong-reason, no positive/negative
  pair) and the mutation recipe.

## 3. Primary sources against inferences

**Primary and verified.** All URLs above were opened or resolved, except the
testsmells detector page, which is marked. The WPT phrases, the testsmells.org
19-smell list and detection strategies, the Meszaros smell pages, the Beck 12
properties, the mutation papers, the Fowler and Böckeler articles, and the
LLM-as-judge papers are quoted or paraphrased from their own pages.

**Inferences (not directly cited findings).** These are house design choices,
grounded in the sources but not stated by them:

- The exact wording of each battery question, and the choice of exactly three
  `can_fail` paraphrases.
- The paraphrase-spread band (`TEST_AUDIT_STABLE_BAND`, default `0.25`) and the
  escalate-never-tie-break rule. Self-consistency and prompt-sensitivity work
  justify sampling more than one phrasing; the threshold is house calibration.
- The four-level `verdict` scale, and the cross-question rule that a confident
  "cannot fail" beside a `good` or `strong` verdict is a contradiction.
- The `type` taxonomy and the exact six labels. Feathers grounds
  `characterization` alone.
- The static regex smells in `smells.mjs` as approximations of the named smells.
- The position-swap control for `asserts_b` as a mitigation of position bias.
  That position bias exists is cited; that this swap removes it is an inference.
- A small, fast model used as a one-token binary classifier per question. This
  is an engineering choice, not a published finding.

**In-house and unverified.** The SystemOne endpoint, the Jev-compatible typed
question protocol, the llama-arbiter on Koishi, the `mass` reading (the softmax
share the allowed answers held before the grammar), and the `confidence` margin
are internal to this project. They are described in `systemone.mjs` and
`README.md`. No public primary source exists for them. `confidence` is
explicitly not calibrated.
