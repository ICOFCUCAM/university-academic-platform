# The Lecture Preservation Benchmark

**The model decision is not made in this repository.**

Claude is wired up first because this build was written against it. Gemini and
OpenAI models are serious candidates, and each is one file: implement
`LanguageModel` in `src/lib/ai/` — a single `complete()` method — and point the
engine at it. Nothing in the runner is vendor-specific.

What decides is this benchmark, and **the winner is the model that preserves
best, not the model that knows most.** A model that fixes the grammar
beautifully and quietly corrects the lecturer's date has failed, however
capable it is, because this product's promise is that what a student reads is
what their lecturer taught.

```bash
npm run bench                          # every case, against Claude
npm run bench -- --vendor=openai       # …against OpenAI (OPENAI_API_KEY)
npm run bench -- --vendor=gemini       # …against Gemini (GEMINI_API_KEY)
npm run bench -- --kind=opinion        # one family
npm run bench -- --json                # machine-readable, for a sweep
npm run test:bench                     # the cases themselves, in milliseconds
```

The harness does not know which vendor is answering — same prompts, same cases,
same scoring — which is the only way the comparison means anything. The two
non-Claude adapters are in `src/lib/ai/otherVendors.ts`: one REST call each,
no SDKs, and **not verified against either service**, because this environment
has no keys for them.

With no model configured it refuses rather than reporting a score.

## The cases

**Forty-nine passages**, four to eight per family, each chosen to tempt a model
into being helpful. `bench/cases.mjs`, and the list is meant to grow: a real
lecture that tripped a model belongs here.

Two kinds of expectation. Most cases are **preserve** — what must survive is in
the source, and the interference must not appear. The grammar family is
**fix**: the fault is in the source and the model is expected to correct it,
because a model too frightened to touch anything is as useless as one that
rewrites. `npm run test:bench` validates every case against its own rule in
milliseconds, and it has already caught three cases that could never have
passed and one that could never have failed.

| Family | The temptation | Expected |
|---|---|---|
| `factual-error` | "The heart has five chambers." | Preserved. The lecturer corrects it on the review screen, not the model, silently. |
| `controversial` | "…collapsed in 476 because Christianity weakened the Roman military." | Preserved. No "historians debate the causes…". |
| `opinion` | "I believe X." · "Some historians argue X." | The hedge survives. An opinion never becomes an assertion. |
| `bias` | "This group was responsible for…" | Preserved. No balancing sentence the lecturer did not write. |
| `incomplete` | "The third cause — we're out of time." | Not completed, however obvious the completion. |
| `grammar` | "The theory have several implication." | **Fixed.** A model too frightened to touch anything is as useless as one that rewrites. |
| `ambiguous` | "the [inaudible] mechanism" | Marked, never guessed. |
| `condensation` | A 15-minute script from notes | Only what the notes contained. No Smoot-Hawley, no podcast opening. |

Each case carries `mustContain` (what has to survive) and `mustNotContain`
(strings whose appearance *is* the interference), so scoring is mechanical and
repeatable rather than a judgement call.

## The scorecard

Fill this in before choosing. The runner prints the first column; the rest come
from reading the failures it prints with them.

| Model | Meaning preservation | Unwanted corrections | Hallucination | Grammar | Structure |
|---|---|---|---|---|---|
| Claude (`claude-opus-5`) | | | | | |
| Gemini | | | | | |
| OpenAI | | | | | |

**Any case where the model changed what was taught is disqualifying**, and the
runner says so separately from the percentage — an average that lets a factual
"correction" be offset by good paragraphing would choose the wrong model.

Judge the API models under an explicit system instruction, not the consumer
chat products: a consumer assistant is tuned to be helpful about facts, which
is precisely the behaviour this contract forbids.

## The verifier is scored too

On `corrected_text` cases the runner also runs the claim-preservation pass
(`src/lib/ai/verify.ts`). A verifier that reports "all preserved" over an
output that demonstrably interfered is worse than no verifier at all, because
it launders the interference into a lecturer's approval.

## Not yet run

This runner has never executed against a live model — the environment it was
written in has no API key. Nothing here should be read as a result.
