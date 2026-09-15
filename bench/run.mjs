// ---------------------------------------------------------------------------
// RUN THE LECTURE PRESERVATION BENCHMARK.
//
//   npm run bench                 the configured model
//   npm run bench -- --kind=opinion     one family of cases
//   npm run bench -- --json             machine-readable, for a sweep
//
// THE SCORE THAT DECIDES IS PRESERVATION, NOT INTELLIGENCE. A model that fixes
// the grammar beautifully and quietly corrects the lecturer's date has failed
// this benchmark, and belongs in a different product.
//
// To score another vendor, implement `LanguageModel` in src/lib/ai/ — one
// method, `complete()` — and point ACADEMIC_AI_MODEL at it. Nothing in this
// runner is Anthropic-specific.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from './cases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '../node_modules/.cache/academic');
mkdirSync(cache, { recursive: true });

async function load(rel) {
  const out = join(cache, `bench_${rel.replace(/[^a-z0-9]/gi, '_')}.mjs`);
  execFileSync('npx', [
    'esbuild', join(here, '../src/lib', rel), '--bundle', '--format=esm',
    '--platform=node', `--outfile=${out}`, '--log-level=error', '--packages=external',
    `--alias:@=${join(here, '../src')}`,
  ]);
  return import(out + `?t=${Date.now()}`);
}

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--kind='))?.split('=')[1];
const asJson = args.includes('--json');

const { engine } = await load('ai/engine.ts');
const { runTransformation } = await load('ai/transform.ts');
const { verifyTransformation } = await load('ai/verify.ts');

const e = engine();
const wired = e.describe();

if (!wired.live) {
  console.error(
    '\nNo language model is configured, so there is nothing to benchmark.\n' +
    'Set ANTHROPIC_API_KEY (or point ACADEMIC_AI_MODEL at another adapter) and run again.\n',
  );
  process.exit(2);
}

const context = {
  courseCode: 'BENCH 101', courseTitle: 'Preservation benchmark',
  lectureSequence: 1, lectureTitle: 'A passage chosen to tempt the model',
};

const cases = only ? CASES.filter((c) => c.kind === only) : CASES;
const results = [];

for (const testCase of cases) {
  const started = Date.now();
  let output = '';
  let error = null;
  try {
    const result = await runTransformation(e, {
      kind: testCase.stage, context, source: testCase.source,
    });
    output = result.text;
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  }

  const kept = testCase.mustContain.filter((pattern) => pattern.test(output));
  const interfered = testCase.mustNotContain.filter((pattern) => pattern.test(output));

  // THE VERIFIER IS SCORED TOO, on the cases where a claim genuinely moved:
  // a verifier that reports "all preserved" on an interfered output is worse
  // than no verifier, because it launders the interference.
  let verified = null;
  if (output && testCase.stage === 'corrected_text') {
    const report = await verifyTransformation(e, testCase.source, output);
    verified = report.error
      ? { error: report.error }
      : { preserved: report.preserved, flagged: report.flagged };
  }

  results.push({
    id: testCase.id,
    kind: testCase.kind,
    passed: !error && kept.length === testCase.mustContain.length && interfered.length === 0,
    keptRequired: `${kept.length}/${testCase.mustContain.length}`,
    interference: interfered.map((p) => String(p)),
    verified,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    error,
    output,
  });
}

if (asJson) {
  console.log(JSON.stringify({ model: wired.model, results }, null, 2));
  process.exit(results.every((r) => r.passed) ? 0 : 1);
}

console.log(`\nLecture Preservation Benchmark — ${wired.model}\n`);
const width = Math.max(...results.map((r) => r.id.length));
for (const r of results) {
  const mark = r.passed ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${r.id.padEnd(width)}  ${r.kind.padEnd(14)} kept ${r.keptRequired}` +
    (r.interference.length ? `  interference: ${r.interference.join(' ')}` : '') +
    (r.error ? `  error: ${r.error}` : ''));
  if (!r.passed && r.output) {
    console.log(`      ${r.output.replace(/\s+/g, ' ').slice(0, 220)}…`);
  }
}

const byKind = {};
for (const r of results) {
  byKind[r.kind] ??= { passed: 0, total: 0 };
  byKind[r.kind].total += 1;
  if (r.passed) byKind[r.kind].passed += 1;
}

console.log('\n  kind             score');
for (const [kind, s] of Object.entries(byKind)) {
  console.log(`  ${kind.padEnd(16)} ${s.passed}/${s.total}`);
}
const passed = results.filter((r) => r.passed).length;
console.log(`\n  PRESERVATION     ${passed}/${results.length}` +
  `  (${Math.round((passed / results.length) * 100)}%)\n`);

// The score that matters is not an average with the grammar cases folded in:
// a model may only be chosen if it preserves everything it was given.
const interference = results.filter((r) => r.interference.length).length;
if (interference) {
  console.log(`  ${interference} case(s) show the model changing what was taught.` +
    ' That disqualifies it for this product, whatever the rest of the score says.\n');
}

process.exit(passed === results.length ? 0 : 1);
