# Mounting this inside an existing university system

This platform runs on its own, and it is built to be mounted inside a
university that already has courses, lecturers and enrolments. The seam is
deliberately narrow: **everything it needs from a host is a course, who teaches
it, and who is on it.** The lectures, the artefacts, the versions, the
knowledge base and the Course AI are this platform's own and travel with it.

---

## 1. The seam

`src/lib/data/store.ts` is the whole interface. Two implementations:

| | Where the data lives |
|---|---|
| `memory.ts` | Standalone — this platform owns everything. |
| A host adapter | The host's courses, people and enrolments are read from the host; the lecture pipeline is stored alongside. |

A host adapter implements `Store` and nothing else changes: no screen, no
route, no rule.

## 2. Mounting it in the ICOF Global University system

The ICOF platform (`ICOFCUCAM/globaluniversity`, `website/`) is Next.js 14 +
Supabase, which is the same stack. Two ways in:

**As a route inside the existing app.** Serve this at `/academic` with
`NEXT_PUBLIC_BASE_PATH=/academic`, and add one entry to
`website/src/lib/portalNav.tsx` — gated on a capability, not a role, because
that system's own ruling of September 2026 is that the sidebar must express
capabilities:

```tsx
{
  id: 'lecture-studio',
  label: 'Lecture Studio',
  icon: <Mic size={18} />,
  roles: ['superadmin', 'admin', 'lecturer', 'student'],
  capability: 'access-lms',
}
```

**As its own deployment against the same Supabase project.** Sessions are
shared when both are served from the same domain; across domains the host
issues a token this platform verifies. `src/lib/session.ts` is the only file
that reads who is asking.

### The mapping

| This platform | ICOF Global University |
|---|---|
| `University` | the institution (`src/lib/constants.ts`, `src/content/site.ts`) |
| `Faculty` | `schools` |
| `Department` | `departments` |
| `Course` | `courses` + the current `course_offerings` row |
| `Course.lecturerIds` | `course_offerings.lecturer_id`, falling back to `courses.lecturer_id` — exactly what the `my_teaching` view already resolves |
| `Person` (lecturer) | `lecturers`, joined to the account by `lecturers.auth_user_id` — **never by email**; that view's own comment records why |
| `Person` (student) | `students` / `profiles` |
| `Enrolment` | `enrollments`, read through `course_roll` (registered and completed, never dropped) |
| `Lecture` + artefacts | **new tables** — see §3 |
| Published notes for a cohort | may additionally be written as a `course_materials` row (`kind` `note`), so existing screens see them |
| Course AI conversation | `tutor_conversations`, `tutor_messages`, `tutor_citations` — migration 086 already has these, and `tutor_messages.refused_reason` already carries the refusal this platform produces |

### The capability alignment

That system's lecturer holds twelve capabilities and no more, ruled in
September 2026. This platform's lecturer acts inside them:

| This platform | Theirs |
|---|---|
| upload source material, run a transformation, correct, approve, publish a lecture's material | `publish-course-material` |
| open the Course AI | `access-lms` |
| see the roll | `view-registered-students` |
| see their own courses | `view-own-courses` |

Nothing here needs `manage-courses`, `moderate-results`, `approve-results`,
`compose-announcement` or `build-timetable`, and this platform never asks for
them. The course catalogue stays curriculum governance; a lecturer's material
stays the lecturer's.

## 3. What a host migration has to create

These tables have no equivalent in an existing student-records system, because
they are this platform's own product:

- `lectures` — the lecture within a course, its sequence, its owner
- `lecture_artefacts` — one row per stage per lecture: kind, origin, owner,
  state, body/media, `derived_from`, `version`, `corrected_by_lecturer`,
  `stale_since`, `approved_by` / `approved_at` / `published_at`
- `artefact_versions` — every earlier body, with who wrote it and why
- `lecture_knowledge` — each lecture's extraction, from which the course
  knowledge base is merged
- `study_aids` — tests, flashcards and audio revisions, with `audience`
  (`course` or `private`) deciding who may read one
- `processing_jobs` — the queue

**The migration is not written.** It is not in this repository and has not been
run anywhere, and it must not be described as ready: in the ICOF repository a
migration is handed to the University to run, with the bundles rebuilt, proved
twice against a database shaped like theirs, and a readiness probe added — that
process is in their `CLAUDE.md` and this note exists so nobody skips it.

Row-level security has to mirror the ownership rules in
`src/lib/domain/ownership.ts`, or the database will be more permissive than the
product: an artefact is readable by its owner, by a lecturer on the course, by
an enrolled student **only when `state = 'published'`**, and by nobody else;
it is writable by its owner alone.

## 4. What else plugs in

| Seam | File | Wired here? |
|---|---|---|
| Language model | `src/lib/ai/anthropic.ts` | Yes — Claude, server-side only |
| Transcription | `src/lib/ai/provider.ts` → `Transcriber` | No vendor. Set `ACADEMIC_TRANSCRIBER` and add an adapter |
| Speech | `provider.ts` → `SpeechSynthesiser` | No vendor. `ACADEMIC_SPEECH` |
| File storage | the upload route | No. Recording files are named, not stored |
| Queue | `src/lib/jobs/queue.ts` → `JobQueue` | In process. A broker implements the same three methods |
| Session | `src/lib/session.ts` | Demonstration switcher. Replace with the host's session |
