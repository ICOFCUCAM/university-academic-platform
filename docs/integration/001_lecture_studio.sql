-- ---------------------------------------------------------------------------
-- LECTURE STUDIO — the tables this platform brings with it.
--
-- WHAT IS NOT HERE. Courses, lecturers, students and enrolment are the host
-- university's and are read from whatever it already has: this migration adds
-- only what has no equivalent in a student-records system — the lectures, the
-- artefacts the pipeline makes, their versions, the knowledge base, the study
-- material, the coursework and the queue.
--
-- ROW-LEVEL SECURITY MIRRORS `src/lib/domain/ownership.ts`, POLICY FOR POLICY.
-- If it does not, the database is more permissive than the product, and the
-- product's rules become decoration: an artefact is readable by its owner, by
-- a lecturer on the course, and by an enrolled student ONLY when it is
-- published; it is writable by its owner alone.
--
-- THIS HAS NOT BEEN RUN ANYWHERE. It is not idempotent-proved, it has not been
-- loaded against a database shaped like the University's, and no readiness
-- probe reports it. In the ICOF repository a migration is handed over with the
-- bundles rebuilt and proved twice; that process has not happened for this
-- file and it must not be described as ready.
-- ---------------------------------------------------------------------------

-- The host supplies these. Named here so the policies below can be read.
--   public.courses(id, department_id, lecturer_id, …)
--   public.course_offerings(id, course_id, lecturer_id, …)
--   public.lecturers(id, auth_user_id, …)
--   public.students(id, auth_user_id, …)
--   public.enrollments(student_id, course_id, status, …)

-- ---------------------------------------------------------------------------
-- 1. WHO IS ASKING
-- ---------------------------------------------------------------------------

create or replace function ls_teaches_course(course uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from lecturers l
     where l.auth_user_id = auth.uid()
       and (exists (select 1 from course_offerings o
                     where o.course_id = course and o.lecturer_id = l.id)
         or exists (select 1 from courses c
                     where c.id = course and c.lecturer_id = l.id))
  );
$$;

create or replace function ls_enrolled_on(course uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from enrollments e
      join students s on s.id = e.student_id
     where e.course_id = course
       and s.auth_user_id = auth.uid()
       and e.status in ('registered', 'completed')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. LECTURES AND WHAT IS MADE FROM THEM
-- ---------------------------------------------------------------------------

create table if not exists ls_lectures (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  context       text not null default 'course' check (context in ('course', 'personal')),
  sequence      integer not null,
  title         text not null check (length(btrim(title)) between 1 and 300),
  abstract      text,
  delivered_on  date,
  -- THE OWNER IS THE LECTURER, and every artefact below inherits it. This
  -- column is what makes "the lecturer owns the academic source material" a
  -- fact the database can enforce rather than a sentence in a prospectus.
  owner_id      uuid not null references auth.users (id),
  created_by    uuid not null references auth.users (id),
  source_minutes integer,
  created_at    timestamptz not null default now(),
  unique (course_id, sequence)
);

create table if not exists ls_artefacts (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references ls_lectures (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  kind          text not null check (kind in (
                  'recording', 'transcript', 'corrected_text', 'knowledge_extract',
                  'structured_notes', 'teaching_script', 'audio_15min', 'revision_materials')),
  origin        text not null check (origin in ('lecturer', 'ai', 'university')),
  owner_id      uuid not null references auth.users (id),
  state         text not null default 'absent' check (state in (
                  'absent', 'queued', 'running', 'ready', 'approved', 'published', 'failed')),
  derived_from  uuid references ls_artefacts (id) on delete set null,

  language          text,
  translated_from   uuid references ls_artefacts (id) on delete cascade,
  translation_standing text check (translation_standing in ('reviewed', 'unreviewed', 'stale')),
  reviewed_by       uuid references auth.users (id),
  reviewed_at       timestamptz,

  body          text,
  segments      jsonb,
  parts         jsonb,
  media_path    text,
  media_seconds integer,

  produced_by   text,
  error         text,
  verification  jsonb,
  terminology   jsonb,
  translation_findings jsonb,
  word_check    jsonb,

  version               integer not null default 0,
  corrected_by_lecturer boolean not null default false,
  stale_since   timestamptz,

  approved_by   uuid references auth.users (id),
  approved_at   timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One artefact of each kind per lecture per language. A second "structured
  -- notes in French" is two answers to the same question.
  unique (lecture_id, kind, language)
);

create index if not exists ls_artefacts_by_course on ls_artefacts (course_id);
create index if not exists ls_artefacts_by_media on ls_artefacts (media_path);

create table if not exists ls_artefact_versions (
  id            uuid primary key default gen_random_uuid(),
  artefact_id   uuid not null references ls_artefacts (id) on delete cascade,
  version       integer not null,
  body          text,
  media_path    text,
  authored_by   text not null,
  authored_by_name text,
  origin        text not null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (artefact_id, version)
);

create table if not exists ls_lecture_knowledge (
  lecture_id    uuid primary key references ls_lectures (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  nodes         jsonb not null default '[]'::jsonb,
  extracted_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. STUDY MATERIAL, COURSEWORK AND THE QUEUE
-- ---------------------------------------------------------------------------

create table if not exists ls_study_aids (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  kind          text not null check (kind in ('test', 'flashcards', 'audio_revision', 'summary')),
  title         text not null,
  lecture_ids   uuid[] not null default '{}',
  requested_by  uuid not null references auth.users (id),
  -- WHO STANDS BEHIND IT, which is not who may see it: everything here is
  -- built from published lectures, so there is nothing personal to hide.
  standing      text not null check (standing in ('lecturer-requested', 'unreviewed')),
  state         text not null default 'ready',
  body          text,
  media_path    text,
  brief         jsonb,
  language      text,
  translated_from uuid references ls_study_aids (id) on delete cascade,
  translation_standing text,
  created_at    timestamptz not null default now()
);

create table if not exists ls_quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  study_aid_id  uuid not null references ls_study_aids (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  person_id     uuid not null references auth.users (id),
  given         jsonb not null default '{}'::jsonb,
  score         integer not null default 0,
  out_of        integer not null default 0,
  taken_at      timestamptz not null default now()
);

create table if not exists ls_progress (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references auth.users (id),
  course_id     uuid not null references courses (id) on delete cascade,
  lecture_id    uuid not null references ls_lectures (id) on delete cascade,
  artefact_kind text,
  event         text not null check (event in ('read', 'listened', 'revised', 'quiz-taken')),
  score         integer,
  out_of        integer,
  at            timestamptz not null default now()
);

create index if not exists ls_progress_by_course on ls_progress (course_id);

-- ONE ROW PER CARD PER STUDENT, rewritten in place. There is deliberately no
-- history table behind this: the schedule is what the platform needs, and a
-- log of every time somebody turned a card over at midnight is not.
-- THIS PLATFORM'S OWN SETTINGS, kept apart from the host's tables. Mounted
-- inside somebody else's university system, this platform reads their
-- institution and never writes to it — so the university's standard voice,
-- which is ours, lives here rather than in their row.
-- THE RECORD OF WHO DID WHAT. Append and read: there is no delete policy and
-- no update policy, deliberately — a log somebody can tidy is not a log. And
-- nothing in it records reading: see src/lib/audit/audit.ts, where the list of
-- auditable acts is closed and a test holds it against the words that would
-- mean somebody's reading was being kept.
-- A LECTURE BEING GIVEN. Nothing in these three tables is ever published: a
-- live stream is a delivery of a lecture, never a version of it, and what a
-- student revises from comes out of ls_artefacts after a lecturer has read it.
-- See src/lib/live/types.ts.
create table if not exists ls_live_sessions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses (id) on delete cascade,
  lecture_id      uuid references ls_lectures (id) on delete set null,
  title           text not null,
  lecturer_id     uuid not null references auth.users (id),
  floor_language  text not null,
  languages       text[] not null default '{}',
  state           text not null check (state in ('scheduled', 'running', 'ended', 'abandoned')),
  started_at      timestamptz,
  ended_at        timestamptz,
  fallback        text not null default 'floor' check (fallback in ('floor', 'silence', 'notice')),
  media_path      text
);

create table if not exists ls_live_segments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references ls_live_sessions (id) on delete cascade,
  sequence    integer not null,
  heard       text not null,
  spoken_at   timestamptz not null default now(),
  seconds     numeric(8,2) not null,
  unique (session_id, sequence)
);

-- One row per segment per language. `state` carries the refusals: a segment
-- whose translation substituted one of the lecturer's terms is 'refused' and
-- is never played.
create table if not exists ls_live_carried (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references ls_live_segments (id) on delete cascade,
  session_id  uuid not null references ls_live_sessions (id) on delete cascade,
  sequence    integer not null,
  language    text not null,
  state       text not null check (state in ('heard', 'carrying', 'ready', 'refused', 'late', 'failed')),
  text        text,
  media_path  text,
  refusal     text,
  timing      jsonb,
  unique (segment_id, language)
);

create index if not exists ls_live_carried_by_session on ls_live_carried (session_id, language, sequence);

create table if not exists ls_audit (
  id          uuid primary key default gen_random_uuid(),
  seq         bigserial,
  at          timestamptz not null default now(),
  act         text not null,
  actor_id    uuid not null references auth.users (id),
  actor_name  text not null,
  actor_role  text not null,
  subject     text not null,
  course_id   uuid references courses (id) on delete set null,
  detail      text
);

create index if not exists ls_audit_by_course on ls_audit (course_id, at desc);

create table if not exists ls_settings (
  id             text primary key,
  standard_voice jsonb
);

create table if not exists ls_recalls (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references auth.users (id),
  course_id     uuid not null references courses (id) on delete cascade,
  study_aid_id  uuid not null references ls_study_aids (id) on delete cascade,
  card          text not null,
  rung          integer not null default 0,
  seen          integer not null default 0,
  wrong         integer not null default 0,
  last_at       timestamptz not null default now(),
  due_at        timestamptz not null,
  unique (person_id, study_aid_id, card)
);

create index if not exists ls_recalls_due on ls_recalls (person_id, due_at);

create table if not exists ls_readings (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  lecture_id    uuid references ls_lectures (id) on delete cascade,
  kind          text not null check (kind in ('book', 'chapter', 'article', 'link', 'document')),
  citation      text not null,
  url           text,
  note          text,
  required      boolean not null default true,
  added_by      uuid not null references auth.users (id),
  added_at      timestamptz not null default now(),
  published     boolean not null default false
);

create table if not exists ls_assignments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  lecture_id    uuid references ls_lectures (id) on delete set null,
  title         text not null,
  brief         text not null,
  due_at        timestamptz,
  marks_out_of  integer,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  published     boolean not null default false
);

create table if not exists ls_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references ls_assignments (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  student_id    uuid not null references auth.users (id),
  body          text not null,
  submitted_at  timestamptz not null default now(),
  late          boolean not null default false,
  -- A MARK IS SET BY A PERSON. No default, no trigger, nothing computed.
  mark          numeric(6,2),
  feedback      text,
  marked_by     uuid references auth.users (id),
  marked_at     timestamptz,
  returned_at   timestamptz,
  unique (assignment_id, student_id)
);

create table if not exists ls_certificates (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  course_code   text not null,
  course_title  text not null,
  student_id    uuid not null references auth.users (id),
  student_name  text not null,
  -- WHAT IT ATTESTS, in sentences a reader can weigh, rather than the word
  -- "completed" and a signature.
  attests       jsonb not null default '[]'::jsonb,
  issued_at     timestamptz not null default now(),
  issued_by     uuid not null references auth.users (id),
  issued_by_name text not null,
  code          text not null unique,
  revoked_at    timestamptz,
  revoked_reason text
);

create table if not exists ls_jobs (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references ls_lectures (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  kind          text not null,
  actor_id      uuid not null references auth.users (id),
  actor_role    text not null,
  state         text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  attempts      integer not null default 0,
  position      integer not null default 0,
  options       jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create table if not exists ls_run_costs (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  lecture_id    uuid not null references ls_lectures (id) on delete cascade,
  stage         text not null,
  produced_by   text not null,
  input_tokens  integer,
  output_tokens integer,
  characters_in integer not null default 0,
  characters_out integer not null default 0,
  at            timestamptz not null default now()
);

create table if not exists ls_usage (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references auth.users (id),
  period        text not null,
  minutes       integer not null,
  lecture_id    uuid references ls_lectures (id) on delete set null,
  at            timestamptz not null default now()
);

create table if not exists ls_notifications (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references auth.users (id),
  kind          text not null,
  title         text not null,
  body          text,
  link          text,
  at            timestamptz not null default now(),
  read_at       timestamptz
);

create table if not exists ls_profiles (
  person_id         uuid primary key references auth.users (id),
  working_language  text,
  voice_preference  text,
  audio_speed       numeric(3,2),
  plan              text,
  voice_consent     jsonb,
  -- Text size, typeface, contrast, motion, captions. Read by nobody but its
  -- owner: the policy below is the whole of who may see it, and there is no
  -- aggregate, no view and no report over this column anywhere.
  accessibility     jsonb,
  working_language_history jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY, MIRRORING ownership.ts
-- ---------------------------------------------------------------------------

alter table ls_lectures            enable row level security;
alter table ls_artefacts           enable row level security;
alter table ls_artefact_versions   enable row level security;
alter table ls_lecture_knowledge   enable row level security;
alter table ls_study_aids          enable row level security;
alter table ls_quiz_attempts       enable row level security;
alter table ls_progress            enable row level security;
alter table ls_recalls             enable row level security;
alter table ls_settings            enable row level security;
alter table ls_audit               enable row level security;
alter table ls_live_sessions       enable row level security;
alter table ls_live_segments       enable row level security;
alter table ls_live_carried        enable row level security;
alter table ls_readings            enable row level security;
alter table ls_assignments         enable row level security;
alter table ls_submissions         enable row level security;
alter table ls_certificates        enable row level security;
alter table ls_jobs                enable row level security;
alter table ls_run_costs           enable row level security;
alter table ls_usage               enable row level security;
alter table ls_notifications       enable row level security;
alter table ls_profiles            enable row level security;

-- A lecture is visible to whoever teaches the course and to whoever is on it.
create policy ls_lectures_read on ls_lectures for select
  using (ls_teaches_course(course_id) or ls_enrolled_on(course_id) or owner_id = auth.uid());
create policy ls_lectures_write on ls_lectures for all
  using (ls_teaches_course(course_id)) with check (ls_teaches_course(course_id));

-- THE POLICY THE WHOLE PLATFORM RESTS ON. A student sees a published artefact
-- and nothing else; a colleague on the course sees everything; the owner may
-- change it and nobody else may.
create policy ls_artefacts_read on ls_artefacts for select
  using (
    owner_id = auth.uid()
    or ls_teaches_course(course_id)
    or (state = 'published' and ls_enrolled_on(course_id))
  );
create policy ls_artefacts_write on ls_artefacts for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy ls_versions_read on ls_artefact_versions for select
  using (exists (select 1 from ls_artefacts a where a.id = artefact_id
                  and (a.owner_id = auth.uid() or ls_teaches_course(a.course_id))));
create policy ls_versions_write on ls_artefact_versions for insert
  with check (exists (select 1 from ls_artefacts a where a.id = artefact_id and a.owner_id = auth.uid()));

create policy ls_knowledge_read on ls_lecture_knowledge for select
  using (ls_teaches_course(course_id) or ls_enrolled_on(course_id));
create policy ls_knowledge_write on ls_lecture_knowledge for all
  using (ls_teaches_course(course_id)) with check (ls_teaches_course(course_id));

create policy ls_aids_read on ls_study_aids for select
  using (ls_teaches_course(course_id) or ls_enrolled_on(course_id));
create policy ls_aids_write on ls_study_aids for insert
  with check (ls_teaches_course(course_id) or ls_enrolled_on(course_id));

-- AN ATTEMPT IS THE STUDENT'S OWN. A lecturer reads the cohort's shape from
-- the aggregate below, never from a row with a name on it.
create policy ls_attempts_own on ls_quiz_attempts for all
  using (person_id = auth.uid()) with check (person_id = auth.uid());

-- PROGRESS WITHOUT SURVEILLANCE, at the database level too: a student reads
-- their own rows; a lecturer reads none of them and uses ls_cohort_shape.
create policy ls_progress_own on ls_progress for all
  using (person_id = auth.uid()) with check (person_id = auth.uid());

-- A LIVE ROOM IS READ BY THE PEOPLE ON THE COURSE and written only by whoever
-- teaches it — the same line as everywhere else, with the addition that a
-- student on the course may read the carried segments for their own language
-- because that is what listening to the lecture is.
create policy ls_live_read on ls_live_sessions for select
  using (ls_teaches_course(course_id) or ls_enrolled_on(course_id));
create policy ls_live_write on ls_live_sessions for all
  using (ls_teaches_course(course_id)) with check (ls_teaches_course(course_id));

create policy ls_live_segments_read on ls_live_segments for select
  using (exists (select 1 from ls_live_sessions s
                  where s.id = session_id
                    and (ls_teaches_course(s.course_id) or ls_enrolled_on(s.course_id))));
create policy ls_live_segments_write on ls_live_segments for all
  using (exists (select 1 from ls_live_sessions s
                  where s.id = session_id and ls_teaches_course(s.course_id)))
  with check (exists (select 1 from ls_live_sessions s
                       where s.id = session_id and ls_teaches_course(s.course_id)));

create policy ls_live_carried_read on ls_live_carried for select
  using (exists (select 1 from ls_live_sessions s
                  where s.id = session_id
                    and (ls_teaches_course(s.course_id) or ls_enrolled_on(s.course_id))));
create policy ls_live_carried_write on ls_live_carried for all
  using (exists (select 1 from ls_live_sessions s
                  where s.id = session_id and ls_teaches_course(s.course_id)))
  with check (exists (select 1 from ls_live_sessions s
                       where s.id = session_id and ls_teaches_course(s.course_id)));

-- WHOEVER TEACHES A COURSE READS THAT COURSE'S ACTS, because they were done to
-- their material. The institution's own acts — a working language moved, the
-- university's voice changed — carry no course and are read through the
-- service by the registry, which runs with the service role. There is no
-- insert, update or delete policy here at all: every write goes through
-- `service.noteInLog`, and nothing may ever remove a row.
create policy ls_audit_read on ls_audit for select
  using (course_id is not null and ls_teaches_course(course_id));

-- Everybody signed in reads the institution's settings — the voice a lesson is
-- spoken in is not a secret. Nobody writes them through this policy: the
-- registry writes with the service role, and the capability check in
-- `service.setInstitutionVoice` is what stands in for a policy, because this
-- schema has no role column of its own to test and inventing one would put a
-- second, disagreeing answer next to the host's.
create policy ls_settings_read on ls_settings for select using (auth.uid() is not null);

-- AND A REVISION SCHEDULE IS NOBODY ELSE'S BUSINESS AT ALL. There is no
-- aggregate over this table and no policy that lets a lecturer read one row of
-- it: "which cards is this cohort failing" is a question about the deck, and
-- the deck is generated from lectures they can already read.
create policy ls_recalls_own on ls_recalls for all
  using (person_id = auth.uid()) with check (person_id = auth.uid());

create or replace view ls_cohort_shape
with (security_invoker = false) as
  select course_id, lecture_id, event,
         count(distinct person_id) as people,
         avg(case when out_of > 0 then score::numeric / out_of end) as average
    from ls_progress
   group by course_id, lecture_id, event;

comment on view ls_cohort_shape is
  'Counts and averages per lecture. Deliberately has no person_id: a lecturer '
  'needs to know whether the cohort is reading Lecture 04, not that one student '
  'opened it at two in the morning.';

create policy ls_readings_read on ls_readings for select
  using (ls_teaches_course(course_id) or (published and ls_enrolled_on(course_id)));
create policy ls_readings_write on ls_readings for all
  using (ls_teaches_course(course_id)) with check (ls_teaches_course(course_id));

create policy ls_assignments_read on ls_assignments for select
  using (ls_teaches_course(course_id) or (published and ls_enrolled_on(course_id)));
create policy ls_assignments_write on ls_assignments for all
  using (ls_teaches_course(course_id)) with check (ls_teaches_course(course_id));

-- A student reads and writes their own submission; a lecturer reads all of
-- them and is the only one who may write a mark.
create policy ls_submissions_student on ls_submissions for select
  using (student_id = auth.uid() or ls_teaches_course(course_id));
create policy ls_submissions_hand_in on ls_submissions for insert
  with check (student_id = auth.uid() and ls_enrolled_on(course_id));
create policy ls_submissions_update on ls_submissions for update
  using (
    (student_id = auth.uid() and marked_at is null)
    or ls_teaches_course(course_id)
  );

-- A CERTIFICATE IS CHECKABLE BY SOMEBODY WITH NO ACCOUNT, which is the whole
-- point of one: verification reads a single row by its code through a function
-- that returns what the certificate attests and nothing else about the person.
create policy ls_certificates_read on ls_certificates for select
  using (student_id = auth.uid() or ls_teaches_course(course_id));
create policy ls_certificates_issue on ls_certificates for insert
  with check (ls_teaches_course(course_id));

create or replace function ls_verify_certificate(certificate_code text)
returns table (course_code text, course_title text, student_name text,
               attests jsonb, issued_at timestamptz, issued_by_name text, revoked boolean)
language sql stable security definer set search_path = public as $$
  select c.course_code, c.course_title, c.student_name, c.attests,
         c.issued_at, c.issued_by_name, c.revoked_at is not null
    from ls_certificates c
   where c.code = upper(certificate_code);
$$;

grant execute on function ls_verify_certificate(text) to anon, authenticated;

create policy ls_jobs_read on ls_jobs for select using (ls_teaches_course(course_id));
create policy ls_costs_read on ls_run_costs for select using (ls_teaches_course(course_id));
create policy ls_usage_own on ls_usage for select using (person_id = auth.uid());
create policy ls_notifications_own on ls_notifications for all
  using (person_id = auth.uid()) with check (person_id = auth.uid());

-- A PROFILE IS READ BY ITS OWNER. The working language is written by the
-- registry, which runs with the service role and bypasses this policy — the
-- capability check in `service.setWorkingLanguage` is what stands in for it.
create policy ls_profile_own on ls_profiles for select using (person_id = auth.uid());
create policy ls_profile_update on ls_profiles for update
  using (person_id = auth.uid()) with check (person_id = auth.uid());

grant select on ls_cohort_shape to authenticated;
