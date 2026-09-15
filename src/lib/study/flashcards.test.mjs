import { load, suite } from '../testkit.mjs';

const F = await load('study/flashcards.ts');
const t = suite('Flashcards');

t.section('The one-line form the notes use');
const fromNotes = F.parseFlashcards(`## Key terms
- **Thylakoid** — an individual folded sac of the internal membrane system.
- **Granum** — a stack of thylakoids.`);
t.check('two cards', fromNotes.length, 2);
t.check('…with the term on the front', fromNotes[0].front, 'Thylakoid');
t.check('…and the lecturer’s definition on the back',
  fromNotes[0].back, 'an individual folded sac of the internal membrane system.');

t.section('And the two-line form the revision set uses');
const fromRevision = F.parseFlashcards(`Thylakoid
An individual folded sac of the internal membrane system.

Granum
A stack of thylakoids.`);
t.check('two cards again', fromRevision.length, 2);
t.check('…the right way up', fromRevision[1], { front: 'Granum', back: 'A stack of thylakoids.' });

t.section('A term repeated between sections is one card');
t.check('deduplicated', F.parseFlashcards(`## Define
- **Rubisco** — the enzyme that fixes carbon dioxide.

## Key terms
- **Rubisco** — the enzyme that fixes carbon dioxide.`).length, 1);

t.section('And prose yields nothing rather than nonsense');
t.check('no cards from a paragraph',
  F.parseFlashcards('Photosynthesis happens in two stages and both matter.'), []);

t.done();
