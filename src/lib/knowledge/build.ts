// ---------------------------------------------------------------------------
// BUILDING THE COURSE KNOWLEDGE BASE FROM THE LECTURES.
//
// Pure. No network, no database, no clock except the one passed in — so the
// merge can be tested against fixtures, which is where its three interesting
// behaviours live: two lectures that agree, two that disagree, and a term the
// course uses and never defines.
// ---------------------------------------------------------------------------

import {
  nodeId,
  type CourseKnowledgeBase,
  type CoverageRow,
  type Disagreement,
  type KnowledgeNode,
  type LectureExtract,
  type Provenance,
  type Thread,
} from './types';

export interface BuildInput {
  courseId: string;
  /** Every lecture on the course, so coverage can show the ones with nothing. */
  lectures: { id: string; sequence: number; title: string }[];
  /** Only the extractions the lecturer approved. A draft teaches nobody. */
  extracts: LectureExtract[];
  now?: string;
}

/** Same meaning, said differently? Compared on words, not on characters. */
function sameSense(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return a.trim() === b.trim();
  let shared = 0;
  A.forEach((w) => { if (B.has(w)) shared++; });
  // Two definitions of the same term that share most of their substantive
  // words are one definition said twice. Below that they are a disagreement
  // the lecturer should see.
  return shared / Math.min(A.size, B.size) >= 0.6;
}

export function buildKnowledgeBase(input: BuildInput): CourseKnowledgeBase {
  const byId = new Map<string, KnowledgeNode>();
  const readings = new Map<string, { definition: string; where: Provenance }[]>();

  const ordered = [...input.extracts].sort((a, b) => a.lectureSequence - b.lectureSequence);

  for (const extract of ordered) {
    const where = (quote: string): Provenance => ({
      lectureId: extract.lectureId,
      lectureSequence: extract.lectureSequence,
      lectureTitle: extract.lectureTitle,
      quote,
    });

    for (const raw of extract.nodes) {
      const id = nodeId(raw.term);
      if (!id) continue;
      const provenance = where(raw.quote);
      let node = byId.get(id);

      if (!node) {
        node = {
          id,
          term: raw.term.trim(),
          kind: raw.kind,
          definition: raw.definition?.trim() || null,
          definedIn: raw.definition ? provenance : null,
          mentions: [provenance],
          relatedTo: raw.relatedTo.map(nodeId).filter(Boolean),
        };
        byId.set(id, node);
      } else {
        node.mentions.push(provenance);
        for (const rel of raw.relatedTo.map(nodeId)) {
          if (rel && rel !== id && !node.relatedTo.includes(rel)) node.relatedTo.push(rel);
        }
        // A LECTURE THAT DEFINES WHAT AN EARLIER ONE ONLY USED fills the gap;
        // the first definition otherwise stands, because the course taught it
        // there and a student met it there.
        if (raw.definition && !node.definition) {
          node.definition = raw.definition.trim();
          node.definedIn = provenance;
          if (node.kind === 'concept') node.kind = raw.kind;
        }
      }

      if (raw.definition) {
        const list = readings.get(id) ?? [];
        list.push({ definition: raw.definition.trim(), where: provenance });
        readings.set(id, list);
      }
    }
  }

  // ---- WHERE THE COURSE DISAGREES WITH ITSELF ---------------------------
  //
  // Surfaced, never resolved. The platform does not know which lecture the
  // lecturer would stand by, and guessing would be authorship.
  const disagreements: Disagreement[] = [];
  readings.forEach((list, id) => {
    const distinct: { definition: string; where: Provenance }[] = [];
    for (const reading of list) {
      if (!distinct.some((d) => sameSense(d.definition, reading.definition))) {
        distinct.push(reading);
      }
    }
    if (distinct.length > 1) {
      disagreements.push({ nodeId: id, term: byId.get(id)!.term, readings: distinct });
    }
  });

  const nodes = [...byId.values()].sort((a, b) => a.term.localeCompare(b.term));

  // ---- THREADS: an idea and everything taught in terms of it ------------
  const threads: Thread[] = nodes
    .filter((n) => n.mentions.length > 1 || n.relatedTo.length >= 2)
    .map((n) => {
      const sequences = [...new Set(n.mentions.map((m) => m.lectureSequence))].sort((a, b) => a - b);
      return {
        id: n.id,
        title: n.term,
        nodeIds: [n.id, ...n.relatedTo.filter((r) => byId.has(r))],
        lectureSequence: sequences,
      };
    })
    .filter((t) => t.lectureSequence.length > 1 || t.nodeIds.length > 2);

  const coverage: CoverageRow[] = [...input.lectures]
    .sort((a, b) => a.sequence - b.sequence)
    .map((lecture) => {
      const extract = ordered.find((e) => e.lectureId === lecture.id);
      return {
        lectureId: lecture.id,
        lectureSequence: lecture.sequence,
        lectureTitle: lecture.title,
        extracted: !!extract,
        concepts: extract?.nodes.filter((n) => n.kind === 'concept').length ?? 0,
        definitions: extract?.nodes.filter((n) => n.definition).length ?? 0,
        openQuestions: extract?.nodes.filter((n) => n.kind === 'question').length ?? 0,
      };
    });

  return {
    courseId: input.courseId,
    builtAt: input.now ?? new Date().toISOString(),
    lecturesIncluded: ordered.map((e) => e.lectureId),
    nodes,
    threads,
    disagreements,
    // USED, NEVER DEFINED. The finding a lecturer cannot get from any single
    // lecture, and the one they most often want.
    undefined: nodes.filter((n) => !n.definition && n.kind !== 'question'),
    openQuestions: nodes.filter((n) => n.kind === 'question'),
    coverage,
  };
}

/** An empty base, so a course with no lectures renders instead of crashing. */
export function emptyKnowledgeBase(courseId: string, now?: string): CourseKnowledgeBase {
  return {
    courseId,
    builtAt: now ?? new Date().toISOString(),
    lecturesIncluded: [],
    nodes: [], threads: [], disagreements: [], undefined: [], openQuestions: [], coverage: [],
  };
}
