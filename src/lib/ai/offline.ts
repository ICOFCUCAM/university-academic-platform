// ---------------------------------------------------------------------------
// THE ENGINE THAT RUNS WITH NOTHING CONFIGURED.
//
// No network, no key, no vendor. It does what can honestly be done by rule —
// strip the fillers, break the paragraphs, find the terms a lecture defines —
// and it NEVER CLAIMS TO BE A LANGUAGE MODEL. Every artefact it produces is
// stamped `offline processor (no language model configured)`, the review screen
// shows that stamp, and nobody can approve machine prose believing a machine
// wrote it.
//
// It exists for three reasons, all of them serious:
//   • the product must open and be demonstrable before anybody buys a key;
//   • the tests must run on a laptop and in CI, deterministically, for free;
//   • a university whose model is down still has a platform, not a blank page.
// ---------------------------------------------------------------------------

import type {
  CompletionRequest, CompletionResult, Engine, LanguageModel,
  SpeechRequest, SpeechResult, SpeechSynthesiser, Transcriber, TranscriptionRequest,
} from './provider';

const STAMP = 'offline processor (no language model configured)';

const FILLERS = /\b(erm|um+|uh+|you know|sort of|kind of|i mean|okay so|right so)\b[ ,]*/gi;

/** Speech into sentences, without the noise of speech. */
function sentences(text: string): string[] {
  return text
    .replace(FILLERS, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

function paragraphs(list: string[], per = 4): string {
  const out: string[] = [];
  for (let i = 0; i < list.length; i += per) out.push(list.slice(i, i + per).join(' '));
  return out.join('\n\n');
}

/** "X is Y", "X refers to Y", "we call this X" — how a lecture defines a term. */
function definitions(list: string[]): { term: string; definition: string; quote: string }[] {
  const found: { term: string; definition: string; quote: string }[] = [];
  const patterns = [
    /^(?:the |a |an )?([A-Za-z][A-Za-z '-]{2,40}?) (?:is|are) (?:defined as|the term for) (.{10,200})$/i,
    /^(?:the |a |an )?([A-Za-z][A-Za-z '-]{2,40}?) refers to (.{10,200})$/i,
    /^(?:the |a |an )?([A-Za-z][A-Za-z '-]{2,40}?) (?:is|are) (.{15,200})$/i,
  ];
  for (const sentence of list) {
    const body = sentence.replace(/[.!?]$/, '');
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && !found.some((f) => f.term.toLowerCase() === match[1].toLowerCase())) {
        found.push({ term: match[1].trim(), definition: match[2].trim(), quote: sentence });
        break;
      }
    }
  }
  return found;
}

/** Which way is this prompt pointing? The system prompt names its own job. */
function intentOf(system: string): 'correct' | 'notes' | 'extract' | 'script' | 'revision' | 'tutor' | 'studyaid' | 'translate' {
  // ORDER MATTERS, AND THE MARKERS ARE THE PROMPTS' OWN OPENING LINES. Matching
  // on a word that appears in several prompts produced a "teaching script"
  // that was a set of revision questions — which is what happens when a
  // detector guesses.
  if (system.includes('ROLE: TRANSLATION ENGINE')) return 'translate';
  if (system.includes('extract what a lecture teaches')) return 'extract';
  if (system.startsWith('Create a spoken condensation')) return 'script';
  if (system.includes('the notes a student actually revises from')) return 'notes';
  if (system.startsWith('You make revision material')) return 'revision';
  if (system.includes('course assistant')) return 'tutor';
  if (system.includes('You make study material')) return 'studyaid';
  return 'correct';
}

/** The source text, from the user turn our own prompts build. */
function sourceOf(user: string): string {
  const marker = user.lastIndexOf('\n\n');
  const headings = ['TRANSCRIPT\n\n', 'CORRECTED LECTURE TEXT\n\n', 'STRUCTURED NOTES\n\n', 'COURSE MATERIAL\n\n'];
  for (const heading of headings) {
    const at = user.indexOf(heading);
    if (at >= 0) return user.slice(at + heading.length);
  }
  return marker > 0 ? user.slice(marker + 2) : user;
}

export function offlineModel(): LanguageModel {
  return {
    id: 'offline',
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const source = sourceOf(request.user);
      const list = sentences(source);
      const defs = definitions(list);
      const intent = intentOf(request.system);

      // A TRANSLATION CANNOT BE FAKED BY RULE, and a mangled one is worse than
      // none: it would be published to the one cohort nobody at the university
      // can check. It refuses by name.
      if (intent === 'translate') {
        throw new Error(
          'No language model is configured, so nothing can be translated. The approved original is still there to read.',
        );
      }

      if (intent === 'correct') {
        return { text: paragraphs(list), producedBy: STAMP };
      }

      if (intent === 'extract') {
        const nodes = defs.map((d) => ({
          term: d.term, kind: 'definition', definition: d.definition,
          quote: d.quote, relatedTo: [] as string[],
        }));
        return { text: JSON.stringify({ nodes }, null, 2), producedBy: STAMP };
      }

      if (intent === 'notes') {
        const body = [
          '## In one paragraph',
          list.slice(0, 4).join(' ') || '[no material]',
          '',
          '## What you should be able to do after it',
          ...(defs.slice(0, 4).map((d) => `- Explain ${d.term}.`)),
          '',
          '## The argument',
          paragraphs(list, 5),
          '',
          '## Key terms',
          ...(defs.length
            ? defs.map((d) => `- **${d.term}** — ${d.definition}`)
            : ['- [no term was defined in a form this processor can recognise]']),
          '',
          '## Left open',
          'Nothing left open.',
        ].join('\n');
        return { text: body, producedBy: STAMP };
      }

      if (intent === 'script') {
        const spoken = list.filter((s) => !s.startsWith('#') && !s.startsWith('-'));
        return { text: paragraphs(spoken.slice(0, 140), 3), producedBy: STAMP };
      }

      if (intent === 'revision') {
        const body = [
          '## Recall',
          ...(defs.length
            ? defs.flatMap((d) => [`Q. What is ${d.term}?`, `A. ${d.definition}`])
            : ['Q. [no question could be formed without a language model]', 'A. —']),
          '',
          '## Define',
          ...defs.map((d) => `${d.term}\n${d.definition}`),
        ].join('\n');
        return { text: body, producedBy: STAMP };
      }

      // A TEST, A SET OF FLASHCARDS, AN AUDIO REVISION. None of these can be
      // written by rule, and a mangled attempt handed to a student revising
      // for an examination is worse than nothing. It says what is missing.
      if (intent === 'studyaid') {
        return {
          text: [
            'This could not be written: no language model is configured.',
            '',
            'Set `ANTHROPIC_API_KEY` and ask again. Until then the published notes and',
            'revision materials for these lectures are still here to read.',
          ].join('\n'),
          producedBy: STAMP,
        };
      }

      // The tutor. Without a model it quotes the course material rather than
      // paraphrasing it — the one answer it can give that is certainly true.
      return {
        text: list.slice(0, 6).join(' ') || 'The course material does not cover that.',
        producedBy: STAMP,
      };
    },
  };
}

export function offlineTranscriber(): Transcriber {
  return {
    id: 'offline',
    async transcribe(request: TranscriptionRequest): Promise<CompletionResult> {
      // A RECORDING CANNOT BE TRANSCRIBED BY RULE. Pretending otherwise would
      // put an empty transcript in front of a lecturer as though it were their
      // lecture. It refuses, by name, and says what to configure.
      throw new Error(
        `No transcription service is configured, so ${request.mediaPath} cannot be transcribed. ` +
        'Set ACADEMIC_TRANSCRIBER, or paste the transcript in by hand — the rest of the pipeline runs from there.',
      );
    },
  };
}

export function offlineSpeech(): SpeechSynthesiser {
  return {
    id: 'offline',
    async speak(request: SpeechRequest): Promise<SpeechResult> {
      // The script is the artefact; the voice is not available. The lecturer
      // gets the fifteen-minute lesson as words, and is told why there is no
      // audio rather than being given a silent file.
      throw new Error(
        'No speech service is configured, so the script cannot be voiced. ' +
        `The teaching script is ready to read (${request.script.split(/\s+/).length} words, ` +
        `about ${Math.round(request.script.split(/\s+/).length / 140)} minutes spoken).`,
      );
    },
  };
}

export function offlineEngine(): Engine {
  return {
    model: offlineModel(),
    transcriber: offlineTranscriber(),
    speech: offlineSpeech(),
    live: false,
    describe: () => ({
      model: STAMP, transcription: 'not configured', speech: 'not configured', live: false,
    }),
  };
}
