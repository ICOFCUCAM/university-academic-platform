// ---------------------------------------------------------------------------
// THE DEMONSTRATION COURSE.
//
// SAMPLE DATA, AND IT SAYS SO ON EVERY SCREEN. The university, the people and
// the lectures below are invented for the demonstration; no real institution,
// academic or student appears here. A deployment replaces this file with its
// own store — nothing else in the platform reads it.
//
// It is written out in full rather than generated because the Course AI is
// only demonstrable against real prose: retrieval over lorem ipsum retrieves
// lorem ipsum. Lecture 06 is the one the platform's own example asks about.
// ---------------------------------------------------------------------------

import type { Artefact, ArtefactKind, Lecture } from '../domain/types';
import type { Snapshot } from './memory';

const NOW = '2026-09-01T09:00:00.000Z';
const LECTURER = 'person-lecturer';

const lecture = (n: number, title: string, abstract: string): Lecture => ({
  id: `lecture-${String(n).padStart(2, '0')}`,
  context: 'course',
  courseId: 'course-biol101',
  ownerId: LECTURER,
  sequence: n,
  title,
  abstract,
  deliveredOn: `2026-09-${String(n * 3 + 1).padStart(2, '0')}`,
  sourceMinutes: 50,
  createdBy: LECTURER,
  createdAt: NOW,
});

const artefact = (
  lectureId: string,
  kind: ArtefactKind,
  body: string,
  state: Artefact['state'],
  derivedFromId: string | null,
): Artefact => ({
  id: `${lectureId}-${kind}`,
  lectureId,
  courseId: 'course-biol101',
  kind,
  origin: kind === 'recording' ? 'lecturer' : 'ai',
  ownerId: LECTURER,
  state,
  derivedFromId,
  body: kind === 'recording' ? undefined : body,
  mediaPath: kind === 'recording' ? `recordings/${lectureId}.m4a` : undefined,
  mediaSeconds: kind === 'recording' ? 50 * 60 : undefined,
  producedBy: kind === 'recording' ? 'Dr Amara Okonjo' : 'sample data',
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
  correctedByLecturer: false,
  ...(state === 'approved' || state === 'published'
    ? { approvedBy: LECTURER, approvedByName: 'Dr Amara Okonjo', approvedAt: NOW }
    : {}),
  ...(state === 'published' ? { publishedAt: NOW } : {}),
});

const L6_TEXT = `
Photosynthesis is the process by which a plant converts light energy into chemical energy that the cell can spend. It is the reaction on which almost every food chain on this planet ultimately rests, and I want you to be able to write the whole of it out by the end of this hour.

We divide it into two stages, and the division matters because the two stages need different things. The first stage is the light-dependent reaction. It happens in the thylakoid membrane, it requires light directly, and its products are ATP and NADPH — the cell's two ways of carrying energy from one reaction to another. Water is split in this stage; the oxygen you are breathing is, in a real sense, a waste product of it.

The second stage is the Calvin cycle. It happens in the stroma, and the important thing — the thing that is misremembered in examinations every single year — is that it does not require light directly. It requires the ATP and the NADPH that the first stage made. Call it the light-independent stage if you like, but do not call it the dark reaction, because it does not happen in the dark; it happens when the first stage has supplied it.

In the Calvin cycle, carbon dioxide is fixed onto a five-carbon sugar by the enzyme rubisco. Rubisco is the most abundant protein on Earth and it is, by the standards of enzymes, remarkably slow. The cycle turns six times to produce one molecule of glucose.

So the summary equation — six carbon dioxide, six water, light, giving one glucose and six oxygen — is true, and it is also a compression of dozens of steps. When I ask you about photosynthesis in the examination, I will be asking about the two stages, where each occurs, what each needs and what each produces.
`.trim();

const L6_NOTES = `
## In one paragraph
Photosynthesis converts light energy into chemical energy the cell can spend, and it underpins almost every food chain. It runs in two stages with different requirements: the light-dependent reaction in the thylakoid membrane, which needs light and produces ATP and NADPH while splitting water, and the Calvin cycle in the stroma, which needs those products rather than light itself.

## What you should be able to do after it
- State the two stages of photosynthesis and where each occurs.
- Explain what each stage requires and what it produces.
- Explain why "dark reaction" is a misleading name for the Calvin cycle.
- Write and interpret the summary equation for photosynthesis.

## The argument
### The light-dependent reaction
Occurs in the thylakoid membrane. Requires light directly. Produces ATP and NADPH. Water is split here, and the oxygen released is a waste product of that splitting.

### The Calvin cycle
Occurs in the stroma. Does not require light directly; it requires the ATP and NADPH from the first stage. Carbon dioxide is fixed onto a five-carbon sugar by rubisco. The cycle turns six times to yield one molecule of glucose.

### The summary equation
Six carbon dioxide and six water, with light, give one glucose and six oxygen. True as a summary and a compression of dozens of steps.

## Key terms
- **Photosynthesis** — the process by which a plant converts light energy into chemical energy that the cell can spend.
- **Light-dependent reaction** — the stage in the thylakoid membrane that requires light and produces ATP and NADPH.
- **Calvin cycle** — the stage in the stroma that fixes carbon dioxide using the ATP and NADPH from the light-dependent reaction.
- **Rubisco** — the enzyme that fixes carbon dioxide onto a five-carbon sugar; the most abundant protein on Earth and, for an enzyme, slow.

## What the lecturer stressed
The Calvin cycle does not require light directly, and should not be called the dark reaction. The examination will ask for the two stages, where each occurs, what each needs and what each produces.

## Left open
Nothing left open.
`.trim();

const L5_TEXT = `
Before we can talk about photosynthesis next week, we need the chloroplast itself, and we need to be honest about what a membrane is for.

A chloroplast has two outer membranes and, inside them, a third membrane system folded into stacks. Each stack is called a granum, and the individual folded sacs are thylakoids. The fluid around them is the stroma. Hold on to those three words — thylakoid, granum, stroma — because next week every reaction we look at will be located in one of them.

Why fold a membrane like that? Surface area. A reaction that happens on a membrane can only happen as fast as there is membrane to happen on, and folding is how a cell fits a great deal of surface into very little volume. You have met this principle already, in the mitochondrion's cristae, and you will meet it again.

The chloroplast also carries its own DNA, in a small circular molecule, and its own ribosomes. That is the evidence for endosymbiosis: the proposal that the chloroplast was once a free-living photosynthetic bacterium taken inside another cell. I am not going to argue the case in full today, but notice what kind of argument it is — it is an argument from structure to history.
`.trim();

const lectures: Lecture[] = [
  lecture(1, 'What a cell is', 'The cell as the unit of life, and what "unit" is doing in that sentence.'),
  lecture(2, 'Membranes', 'Why a boundary that lets some things through is the precondition for everything else.'),
  lecture(3, 'The nucleus and the genome', 'Where the instructions are kept, and how they leave the room.'),
  lecture(4, 'Energy in the cell: ATP', 'The cell’s currency, and why a currency is needed at all.'),
  lecture(5, 'The chloroplast', 'The organelle, its three compartments, and an argument from structure to history.'),
  lecture(6, 'Photosynthesis', 'Light into chemical energy, in two stages that need different things.'),
];

// A TRANSLATION IN THE DEMONSTRATION, because the multilingual layer is only
// legible when a second language is actually on the screen: the French notes
// below are a rendering of the approved English master, unreviewed — which is
// exactly what the platform says about them.
const L6_NOTES_FR = `
## En un paragraphe
La photosynthèse convertit l'énergie lumineuse en énergie chimique que la cellule peut dépenser, et elle est à la base de presque toutes les chaînes alimentaires. Elle se déroule en deux étapes aux exigences différentes : la réaction dépendante de la lumière, dans la membrane du thylakoïde, qui a besoin de lumière et produit de l'ATP et du NADPH en scindant l'eau, et le cycle de Calvin, dans le stroma, qui a besoin de ces produits plutôt que de la lumière elle-même.

## Ce que vous devez savoir faire ensuite
- Nommer les deux étapes de la photosynthèse et dire où chacune se déroule.
- Expliquer ce que chaque étape exige et ce qu'elle produit.
- Expliquer pourquoi « réaction obscure » est un nom trompeur pour le cycle de Calvin.
- Écrire et interpréter l'équation bilan de la photosynthèse.

## L'argument
### La réaction dépendante de la lumière
Se déroule dans la membrane du thylakoïde. Exige la lumière directement. Produit de l'ATP et du NADPH. L'eau y est scindée, et l'oxygène libéré est un déchet de cette scission.

### Le cycle de Calvin
Se déroule dans le stroma. N'exige pas la lumière directement ; il exige l'ATP et le NADPH de la première étape. Le dioxyde de carbone est fixé sur un sucre à cinq carbones par la rubisco. Le cycle tourne six fois pour produire une molécule de glucose.

### L'équation bilan
Six dioxyde de carbone et six eau, avec la lumière, donnent un glucose et six oxygène. Vraie comme résumé et comme compression de dizaines d'étapes.

## Termes clés
- **Photosynthèse** — le processus par lequel une plante convertit l'énergie lumineuse en énergie chimique que la cellule peut dépenser.
- **Réaction dépendante de la lumière** — l'étape, dans la membrane du thylakoïde, qui exige la lumière et produit de l'ATP et du NADPH.
- **Cycle de Calvin** — l'étape, dans le stroma, qui fixe le dioxyde de carbone à l'aide de l'ATP et du NADPH de la réaction dépendante de la lumière.
- **Rubisco** — l'enzyme qui fixe le dioxyde de carbone sur un sucre à cinq carbones ; la protéine la plus abondante sur Terre et, pour une enzyme, lente.

## Ce que le professeur a souligné
Le cycle de Calvin n'exige pas la lumière directement et ne doit pas être appelé réaction obscure. L'examen portera sur les deux étapes, où chacune se déroule, ce que chacune exige et ce que chacune produit.

## Laissé ouvert
Rien n'est laissé ouvert.
`.trim();

const artefacts: Artefact[] = [
  // Lecture 05 — through the pipeline and published.
  artefact('lecture-05', 'recording', '', 'published', null),
  artefact('lecture-05', 'transcript', L5_TEXT, 'approved', 'lecture-05-recording'),
  artefact('lecture-05', 'corrected_text', L5_TEXT, 'published', 'lecture-05-transcript'),
  artefact('lecture-05', 'structured_notes', `## In one paragraph\nThe chloroplast has two outer membranes and an internal membrane system folded into stacks. A stack is a granum; the folded sacs are thylakoids; the surrounding fluid is the stroma. Folding buys surface area, as it does in the mitochondrion. The chloroplast carries its own circular DNA and ribosomes, which is the structural evidence for endosymbiosis.\n\n## Key terms\n- **Thylakoid** — an individual folded sac of the internal membrane system.\n- **Granum** — a stack of thylakoids.\n- **Stroma** — the fluid surrounding the thylakoids.\n- **Endosymbiosis** — the proposal that the chloroplast was once a free-living photosynthetic bacterium taken inside another cell.\n\n## What the lecturer stressed\nThylakoid, granum and stroma are needed next week: every reaction in Lecture 06 is located in one of them.\n\n## Left open\nThe case for endosymbiosis is not argued in full in this lecture.`, 'published', 'lecture-05-corrected_text'),

  // Lecture 06 — the one the worked example asks about.
  artefact('lecture-06', 'recording', '', 'published', null),
  artefact('lecture-06', 'transcript', L6_TEXT, 'approved', 'lecture-06-recording'),
  artefact('lecture-06', 'corrected_text', L6_TEXT, 'published', 'lecture-06-transcript'),
  artefact('lecture-06', 'structured_notes', L6_NOTES, 'published', 'lecture-06-corrected_text'),
  artefact('lecture-06', 'revision_materials', `## Recall\nQ. Where does the light-dependent reaction occur?\nA. In the thylakoid membrane.\nQ. What does the light-dependent reaction produce?\nA. ATP and NADPH; oxygen is released as a waste product of splitting water.\nQ. Where does the Calvin cycle occur?\nA. In the stroma.\nQ. What does the Calvin cycle require?\nA. The ATP and NADPH made by the light-dependent reaction, not light directly.\nQ. Which enzyme fixes carbon dioxide?\nA. Rubisco.\nQ. How many turns of the Calvin cycle yield one glucose?\nA. Six.\n\n## Where students go wrong\nCalling the Calvin cycle the "dark reaction". The lecture warns that it does not happen in the dark; it happens when the light-dependent stage has supplied ATP and NADPH.`, 'published', 'lecture-06-structured_notes'),

  // The French rendering of Lecture 06's notes: derived from the approved
  // English master, published, and read by nobody who speaks French — which
  // is what every screen showing it says.
  {
    ...artefact('lecture-06', 'structured_notes', L6_NOTES_FR, 'published', 'lecture-06-corrected_text'),
    id: 'lecture-06-structured_notes-fr',
    language: 'fr',
    translatedFromId: 'lecture-06-structured_notes',
    translationStanding: 'unreviewed',
    producedBy: 'sample data',
  },

  // Lecture 07 in progress — recorded and transcribed, awaiting the lecturer.
  artefact('lecture-04', 'recording', '', 'ready', null),
  artefact('lecture-04', 'transcript', 'ATP is the cell’s currency. A currency is needed because the reactions that release energy and the reactions that spend it are not the same reactions and do not happen in the same place. Erm, so what ATP does is carry energy between them. When a phosphate is removed from ATP, energy is released and ADP is left.', 'ready', 'lecture-04-recording'),
];

export const DEMO: Snapshot = {
  university: { id: 'uni-demo', name: 'Demonstration University', shortName: 'Demo' },
  faculties: [{ id: 'fac-science', universityId: 'uni-demo', name: 'Faculty of Science', code: 'SCI' }],
  departments: [{ id: 'dept-biology', facultyId: 'fac-science', name: 'Department of Biology', code: 'BIO' }],
  courses: [{
    id: 'course-biol101',
    departmentId: 'dept-biology',
    code: 'BIOL 101',
    title: 'Cell Biology and Energy',
    creditUnit: 3,
    session: '2026/2027',
    semester: 1,
    description: 'The cell as the unit of life: membranes, the genome, and how a cell pays for what it does.',
    lecturerIds: [LECTURER],
    // The lecturer's own terms. On this demonstration course they are
    // ordinary biology; on a theological course they are the names a
    // substitution would destroy. The check is the same either way.
    terminology: ['thylakoid', 'granum', 'stroma', 'rubisco', 'Calvin cycle'],
    originalLanguage: 'en',
    offeredLanguages: ['fr', 'es', 'ar'],
    // What completing this course means, as this lecturer defines it.
    completion: { lecturesRead: 0.8, quizzesTaken: 3, quizAverage: 60 },
    status: 'running',
  }],
  people: [
    { id: LECTURER, name: 'Dr Amara Okonjo', email: 'a.okonjo@example.edu', role: 'lecturer' },
    {
      id: 'person-student', name: 'Joseph Adeyemi', email: 'j.adeyemi@example.edu', role: 'student',
      // HIS WHOLE ACADEMIC ENVIRONMENT IS IN FRENCH. Not a switcher he fiddles
      // with per course: notes, audio, quizzes and the Course AI all arrive in
      // it, and the registry changes it with a reason if it ever changes.
      workingLanguage: 'fr',
      audioSpeed: 1,
    },
    { id: 'person-registry', name: 'Registry Office', email: 'registry@example.edu', role: 'registry' },
    // Reads Arabic and French, and vouches for what the translations say. Not
    // a second author: they cannot touch the lecturer's original.
    { id: 'person-reviewer', name: 'Nadia Haddad', email: 'n.haddad@example.edu', role: 'translation-reviewer' },
  ],
  enrolments: [{ id: 'enrol-1', courseId: 'course-biol101', studentId: 'person-student', status: 'registered' }],
  lectures,
  artefacts,
  versions: [],
  extracts: {
    'course-biol101': [
      {
        lectureId: 'lecture-05', lectureSequence: 5, lectureTitle: 'The chloroplast',
        nodes: [
          { term: 'Thylakoid', kind: 'definition', definition: 'An individual folded sac of the chloroplast’s internal membrane system.', quote: 'the individual folded sacs are thylakoids', relatedTo: ['Granum', 'Stroma'] },
          { term: 'Granum', kind: 'definition', definition: 'A stack of thylakoids.', quote: 'Each stack is called a granum', relatedTo: ['Thylakoid'] },
          { term: 'Stroma', kind: 'definition', definition: 'The fluid surrounding the thylakoids.', quote: 'The fluid around them is the stroma.', relatedTo: ['Thylakoid'] },
          { term: 'Endosymbiosis', kind: 'claim', definition: 'The proposal that the chloroplast was once a free-living photosynthetic bacterium taken inside another cell.', quote: 'That is the evidence for endosymbiosis', relatedTo: [] },
        ],
      },
      {
        lectureId: 'lecture-06', lectureSequence: 6, lectureTitle: 'Photosynthesis',
        nodes: [
          { term: 'Photosynthesis', kind: 'definition', definition: 'The process by which a plant converts light energy into chemical energy that the cell can spend.', quote: 'Photosynthesis is the process by which a plant converts light energy into chemical energy that the cell can spend.', relatedTo: ['Light-dependent reaction', 'Calvin cycle'] },
          { term: 'Light-dependent reaction', kind: 'definition', definition: 'The stage in the thylakoid membrane that requires light and produces ATP and NADPH.', quote: 'It happens in the thylakoid membrane, it requires light directly, and its products are ATP and NADPH', relatedTo: ['Thylakoid', 'Photosynthesis'] },
          { term: 'Calvin cycle', kind: 'definition', definition: 'The stage in the stroma that fixes carbon dioxide using the ATP and NADPH from the light-dependent reaction.', quote: 'The second stage is the Calvin cycle. It happens in the stroma', relatedTo: ['Stroma', 'Rubisco'] },
          { term: 'Rubisco', kind: 'definition', definition: 'The enzyme that fixes carbon dioxide onto a five-carbon sugar; the most abundant protein on Earth and, for an enzyme, slow.', quote: 'carbon dioxide is fixed onto a five-carbon sugar by the enzyme rubisco', relatedTo: ['Calvin cycle'] },
          { term: 'NADPH', kind: 'concept', definition: null, quote: 'its products are ATP and NADPH', relatedTo: ['Light-dependent reaction'] },
        ],
      },
    ],
  },
  studyAids: [],
  progress: [],
  attempts: [],
  recalls: [],
  costs: [],
  usage: [],
  notifications: [],
  certificates: [],
  readings: [],
  assignments: [],
  submissions: [],
  conversations: [],
  messages: [],
};
