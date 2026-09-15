// ---------------------------------------------------------------------------
// FLASHCARDS AS CARDS.
//
// Generated as "term, then definition, then a blank line", which is what a
// lecturer writes and what survives translation. Parsed here into something a
// student can actually work through — one side at a time, because a card whose
// answer is already visible teaches nothing.
// ---------------------------------------------------------------------------

export interface Flashcard {
  front: string;
  back: string;
}

const HEADING = /^#{1,6}\s/;
const BULLET = /^\s*[-*•]\s+/;

/**
 * Two shapes, because both are generated and both are what people paste in:
 *
 *   Thylakoid                      ← two lines, blank line between cards
 *   An individual folded sac…
 *
 *   - **Thylakoid** — an individual folded sac…   ← one line, a dash between
 */
export function parseFlashcards(text: string): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    for (const line of lines) {
      if (HEADING.test(line)) continue;

      // One-line form: term — definition.
      const inline = line.replace(BULLET, '').match(/^(?:\*\*)?(.{1,80}?)(?:\*\*)?\s*[—–-]\s+(.{3,})$/);
      if (inline) {
        cards.push({ front: inline[1].trim(), back: inline[2].trim() });
        continue;
      }

      // Two-line form: this line is a term and the next is its definition.
      const index = lines.indexOf(line);
      const next = lines[index + 1];
      if (next && !HEADING.test(next) && index % 2 === 0) {
        const alreadyUsed = cards.some((c) => c.front === line.replace(BULLET, ''));
        if (!alreadyUsed && !/[—–-]\s/.test(line)) {
          cards.push({ front: line.replace(BULLET, '').trim(), back: next.replace(BULLET, '').trim() });
        }
      }
    }
  }

  // A card with the same front twice is one card: the generated sets repeat a
  // term between "Define" and "Key terms" often enough to matter.
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.front.toLowerCase();
    if (seen.has(key) || !card.back) return false;
    seen.add(key);
    return true;
  });
}
