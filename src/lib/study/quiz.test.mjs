// ---------------------------------------------------------------------------
// A QUIZ YOU CAN SIT, AND WHAT MARKING REFUSES TO DO.
//
// The parser earns its place by degrading rather than failing: a question it
// cannot place is kept in `remainder` and shown, because a student who gets
// nine questions and a note is better served than one who gets an error.
//
// And the marking refuses to score a written answer by matching strings. "The
// thylakoid membrane" and "in the thylakoid" are the same answer, and a
// platform that marked one of them wrong would teach a student they had
// misunderstood their lecture.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const Q = await load('study/quiz.ts');
const t = suite('Sitting a quiz');

const mcq = `## Quiz — Lecture 06

1. Where does the light-dependent reaction occur?
A. In the stroma
B. In the thylakoid membrane
C. In the outer membrane
D. In the cytoplasm

2. What does the Calvin cycle require?
A. Light, directly
B. ATP and NADPH from the first stage
C. Oxygen
D. Nothing

## Answers
1. B — the lecture places it in the thylakoid membrane.
2. B — it needs the products of the first stage, not the light itself.`;

t.section('Multiple choice, parsed and held back');
const parsed = Q.parseQuiz(mcq);
t.check('two questions', parsed.questions.length, 2);
t.check('…with their prompts', parsed.questions[0].prompt, 'Where does the light-dependent reaction occur?');
t.check('…four options each', parsed.questions.map((q) => q.options.length), [4, 4]);
t.check('…the option text kept', parsed.questions[0].options[1].text, 'In the thylakoid membrane');
t.check('…the answer found in the answers section', parsed.questions[0].answer, 'B');
t.check('…and the reason with it',
  parsed.questions[1].explanation, 'it needs the products of the first stage, not the light itself.');
t.check('nothing was left unplaced', parsed.remainder, '');

t.section('Marking');
const right = Q.mark(parsed, { 1: 'B', 2: 'B' });
t.check('both right', [right.score, right.outOf], [2, 2]);
const half = Q.mark(parsed, { 1: 'b', 2: 'A' });
t.check('case does not decide it', half.marked[0].right, true);
t.check('…and a wrong one is wrong', half.marked[1].right, false);
t.check('…scored out of what could be marked', [half.score, half.outOf], [1, 2]);
t.check('an unanswered question is not right', Q.mark(parsed, {}).score, 0);

t.section('A written answer is shown, never machine-marked');
const written = Q.parseQuiz(`## Recall
Q. Where does the light-dependent reaction occur?
A. In the thylakoid membrane.
Q. How many turns of the Calvin cycle yield one glucose?
A. Six.`);
t.check('the pairs are read', written.questions.length, 2);
t.check('…with the lecturer’s answer attached', written.questions[1].answer, 'Six.');
const selfMarked = Q.mark(written, { 1: 'in the thylakoid', 2: '6' });
t.check('neither is machine-marked', selfMarked.marked.map((m) => m.right), [null, null]);
t.check('…so nothing is scored', selfMarked.outOf, 0);
t.check('…and the lecturer’s answer is there to judge against',
  selfMarked.marked[0].correct, 'In the thylakoid membrane.');

t.section('It degrades rather than failing');
const messy = Q.parseQuiz(`Some preamble the model added.

1. A real question?
A. Yes
B. No

## Answers
1. A`);
t.check('the question is found', messy.questions.length, 1);
t.check('…and the preamble is kept, not swallowed',
  messy.remainder.includes('Some preamble'), true);
t.check('a page with no questions at all yields none', Q.parseQuiz('Just prose.').questions, []);

t.section('And it survives translation, because it reads the shape');
const french = Q.parseQuiz(`## Quiz

1. Où se déroule la réaction dépendante de la lumière ?
A. Dans le stroma
B. Dans la membrane du thylakoïde

## Réponses
1. B — la conférence la situe dans la membrane du thylakoïde.`);
t.check('the French quiz parses', french.questions.length, 1);
t.check('…with its answer', french.questions[0].answer, 'B');

t.done();
