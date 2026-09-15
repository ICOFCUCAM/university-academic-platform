// ---------------------------------------------------------------------------
// THE INTERFACE, IN THE STUDENT'S WORKING LANGUAGE.
//
// The content has been translated for a while; every button was still English,
// which is a strange experience: a French student reading French notes under a
// navigation bar that says "Lectures · Courses · Settings".
//
// TWO HONEST LIMITS, STATED HERE RATHER THAN DISCOVERED.
//
//   THESE STRINGS ARE NOT REVIEWED BY NATIVE SPEAKERS. They are interface
//   chrome, not academic material — nobody is examined on the word for
//   "Settings" — but `reviewed: false` is recorded per language so that an
//   institution can see what it is getting, and a deployment that has had them
//   read can flip it.
//
//   COVERAGE IS PARTIAL AND MEASURABLE. `missing()` reports what falls back to
//   English, so nobody has to guess how far this got. What is not translated
//   renders in English rather than as a key, because "nav.courses" on a screen
//   is worse than a word in the wrong language.
//
// The academic material is a different matter entirely: it goes through the
// translation engine, the terminology layer and a reviewer. This is buttons.
// ---------------------------------------------------------------------------

export type UIKey =
  | 'nav.dashboard' | 'nav.lectures' | 'nav.courses' | 'nav.notifications'
  | 'nav.profile' | 'nav.settings' | 'nav.viewingAs'
  | 'course.lectures' | 'course.revision' | 'course.search' | 'course.readingAndWork'
  | 'course.courseAI' | 'course.newLecture' | 'course.taughtBy' | 'course.knowledgeBase'
  | 'lecture.pipeline' | 'lecture.read' | 'lecture.listen' | 'lecture.revise'
  | 'lecture.quiz' | 'lecture.ask' | 'lecture.publishedBy' | 'lecture.original'
  | 'study.makeQuiz' | 'study.makeFlashcards' | 'study.makeAudio' | 'study.submit'
  | 'study.onTheShelf' | 'study.notRead'
  | 'work.reading' | 'work.assignments' | 'work.handIn' | 'work.marked' | 'work.due'
  | 'ai.askCourse' | 'ai.askLecture' | 'ai.notCovered' | 'ai.fromYourLectures'
  | 'common.copy' | 'common.download' | 'common.speed' | 'common.language'
  | 'common.voice' | 'common.locked' | 'common.loading' | 'common.nothingYet';

type Catalogue = Partial<Record<UIKey, string>>;

const en: Record<UIKey, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.lectures': 'Lectures',
  'nav.courses': 'Courses',
  'nav.notifications': 'What happened',
  'nav.profile': 'My profile',
  'nav.settings': 'Settings',
  'nav.viewingAs': 'Viewing as',
  'course.lectures': 'Lectures',
  'course.revision': 'Revision',
  'course.search': 'Search',
  'course.readingAndWork': 'Reading and work',
  'course.courseAI': 'Course AI',
  'course.newLecture': 'New lecture',
  'course.taughtBy': 'Taught by',
  'course.knowledgeBase': 'Course knowledge base',
  'lecture.pipeline': 'Pipeline',
  'lecture.read': 'Read the notes',
  'lecture.listen': 'Listen — 15 min',
  'lecture.revise': 'Revision',
  'lecture.quiz': 'Take a quiz',
  'lecture.ask': 'Ask the Course AI',
  'lecture.publishedBy': 'Published by',
  'lecture.original': 'Read the original — it is what the lecturer taught',
  'study.makeQuiz': 'A 10-question quiz',
  'study.makeFlashcards': 'Flashcards',
  'study.makeAudio': 'A 15-minute audio revision',
  'study.submit': 'Submit answers',
  'study.onTheShelf': 'On the shelf',
  'study.notRead': 'not read by a lecturer',
  'work.reading': 'Reading',
  'work.assignments': 'Assignments',
  'work.handIn': 'Hand it in',
  'work.marked': 'Marked',
  'work.due': 'due',
  'ai.askCourse': 'Ask about this course…',
  'ai.askLecture': 'Ask about this lecture…',
  'ai.notCovered': 'This course’s lectures do not cover that.',
  'ai.fromYourLectures': 'From your lectures',
  'common.copy': 'Copy',
  'common.download': 'Download',
  'common.speed': 'Speed',
  'common.language': 'Language',
  'common.voice': 'Voice',
  'common.locked': 'locked to your working language',
  'common.loading': 'Loading…',
  'common.nothingYet': 'Nothing yet',
};

const fr: Catalogue = {
  'nav.dashboard': 'Tableau de bord', 'nav.lectures': 'Cours magistraux', 'nav.courses': 'Cours',
  'nav.notifications': 'Ce qui s’est passé', 'nav.profile': 'Mon profil', 'nav.settings': 'Paramètres',
  'nav.viewingAs': 'Vu en tant que',
  'course.lectures': 'Cours magistraux', 'course.revision': 'Révision', 'course.search': 'Rechercher',
  'course.readingAndWork': 'Lectures et travaux', 'course.courseAI': 'IA du cours',
  'course.newLecture': 'Nouveau cours magistral', 'course.taughtBy': 'Enseigné par',
  'course.knowledgeBase': 'Base de connaissances du cours',
  'lecture.pipeline': 'Chaîne de traitement', 'lecture.read': 'Lire les notes',
  'lecture.listen': 'Écouter — 15 min', 'lecture.revise': 'Révision', 'lecture.quiz': 'Faire un quiz',
  'lecture.ask': 'Interroger l’IA du cours', 'lecture.publishedBy': 'Publié par',
  'lecture.original': 'Lire l’original — c’est ce que l’enseignant a enseigné',
  'study.makeQuiz': 'Un quiz de 10 questions', 'study.makeFlashcards': 'Fiches de révision',
  'study.makeAudio': 'Une révision audio de 15 minutes', 'study.submit': 'Valider mes réponses',
  'study.onTheShelf': 'Disponible', 'study.notRead': 'non relu par un enseignant',
  'work.reading': 'Lectures', 'work.assignments': 'Travaux', 'work.handIn': 'Rendre',
  'work.marked': 'Corrigé', 'work.due': 'à rendre le',
  'ai.askCourse': 'Posez une question sur ce cours…', 'ai.askLecture': 'Posez une question sur ce cours magistral…',
  'ai.notCovered': 'Les cours magistraux de ce cours ne traitent pas ce sujet.',
  'ai.fromYourLectures': 'D’après vos cours magistraux',
  'common.copy': 'Copier', 'common.download': 'Télécharger', 'common.speed': 'Vitesse',
  'common.language': 'Langue', 'common.voice': 'Voix',
  'common.locked': 'fixée à votre langue de travail', 'common.loading': 'Chargement…',
  'common.nothingYet': 'Rien pour l’instant',
};

const es: Catalogue = {
  'nav.dashboard': 'Panel', 'nav.lectures': 'Clases', 'nav.courses': 'Cursos',
  'nav.notifications': 'Novedades', 'nav.profile': 'Mi perfil', 'nav.settings': 'Ajustes',
  'nav.viewingAs': 'Viendo como',
  'course.lectures': 'Clases', 'course.revision': 'Repaso', 'course.search': 'Buscar',
  'course.readingAndWork': 'Lecturas y trabajos', 'course.courseAI': 'IA del curso',
  'course.newLecture': 'Nueva clase', 'course.taughtBy': 'Impartido por',
  'course.knowledgeBase': 'Base de conocimiento del curso',
  'lecture.pipeline': 'Proceso', 'lecture.read': 'Leer los apuntes',
  'lecture.listen': 'Escuchar — 15 min', 'lecture.revise': 'Repaso', 'lecture.quiz': 'Hacer un test',
  'lecture.ask': 'Preguntar a la IA del curso', 'lecture.publishedBy': 'Publicado por',
  'lecture.original': 'Leer el original — es lo que enseñó el profesor',
  'study.makeQuiz': 'Un test de 10 preguntas', 'study.makeFlashcards': 'Tarjetas',
  'study.makeAudio': 'Un repaso en audio de 15 minutos', 'study.submit': 'Enviar respuestas',
  'study.onTheShelf': 'Disponible', 'study.notRead': 'no revisado por un profesor',
  'work.reading': 'Lecturas', 'work.assignments': 'Trabajos', 'work.handIn': 'Entregar',
  'work.marked': 'Corregido', 'work.due': 'entrega',
  'ai.askCourse': 'Pregunta sobre este curso…', 'ai.askLecture': 'Pregunta sobre esta clase…',
  'ai.notCovered': 'Las clases de este curso no tratan eso.',
  'ai.fromYourLectures': 'De tus clases',
  'common.copy': 'Copiar', 'common.download': 'Descargar', 'common.speed': 'Velocidad',
  'common.language': 'Idioma', 'common.voice': 'Voz',
  'common.locked': 'fijado a tu idioma de trabajo', 'common.loading': 'Cargando…',
  'common.nothingYet': 'Nada todavía',
};

const pt: Catalogue = {
  'nav.dashboard': 'Painel', 'nav.lectures': 'Aulas', 'nav.courses': 'Disciplinas',
  'nav.notifications': 'Novidades', 'nav.profile': 'O meu perfil', 'nav.settings': 'Definições',
  'nav.viewingAs': 'A ver como',
  'course.lectures': 'Aulas', 'course.revision': 'Revisão', 'course.search': 'Pesquisar',
  'course.readingAndWork': 'Leituras e trabalhos', 'course.courseAI': 'IA da disciplina',
  'course.newLecture': 'Nova aula', 'course.taughtBy': 'Lecionada por',
  'course.knowledgeBase': 'Base de conhecimento da disciplina',
  'lecture.pipeline': 'Processo', 'lecture.read': 'Ler os apontamentos',
  'lecture.listen': 'Ouvir — 15 min', 'lecture.revise': 'Revisão', 'lecture.quiz': 'Fazer um teste',
  'lecture.ask': 'Perguntar à IA da disciplina', 'lecture.publishedBy': 'Publicado por',
  'lecture.original': 'Ler o original — é o que o docente ensinou',
  'study.makeQuiz': 'Um teste de 10 perguntas', 'study.makeFlashcards': 'Cartões',
  'study.makeAudio': 'Uma revisão áudio de 15 minutos', 'study.submit': 'Enviar respostas',
  'study.onTheShelf': 'Disponível', 'study.notRead': 'não revisto por um docente',
  'work.reading': 'Leituras', 'work.assignments': 'Trabalhos', 'work.handIn': 'Entregar',
  'work.marked': 'Corrigido', 'work.due': 'entrega',
  'ai.askCourse': 'Pergunte sobre esta disciplina…', 'ai.askLecture': 'Pergunte sobre esta aula…',
  'ai.notCovered': 'As aulas desta disciplina não abordam isso.',
  'ai.fromYourLectures': 'Das suas aulas',
  'common.copy': 'Copiar', 'common.download': 'Descarregar', 'common.speed': 'Velocidade',
  'common.language': 'Idioma', 'common.voice': 'Voz',
  'common.locked': 'fixado no seu idioma de trabalho', 'common.loading': 'A carregar…',
  'common.nothingYet': 'Ainda nada',
};

const ar: Catalogue = {
  'nav.dashboard': 'لوحة المتابعة', 'nav.lectures': 'المحاضرات', 'nav.courses': 'المقررات',
  'nav.notifications': 'المستجدات', 'nav.profile': 'ملفي', 'nav.settings': 'الإعدادات',
  'nav.viewingAs': 'العرض بصفة',
  'course.lectures': 'المحاضرات', 'course.revision': 'المراجعة', 'course.search': 'بحث',
  'course.readingAndWork': 'القراءات والواجبات', 'course.courseAI': 'ذكاء المقرر',
  'course.newLecture': 'محاضرة جديدة', 'course.taughtBy': 'يدرّسها',
  'course.knowledgeBase': 'قاعدة معرفة المقرر',
  'lecture.pipeline': 'مراحل المعالجة', 'lecture.read': 'قراءة الملاحظات',
  'lecture.listen': 'الاستماع — ١٥ دقيقة', 'lecture.revise': 'المراجعة', 'lecture.quiz': 'اختبار قصير',
  'lecture.ask': 'اسأل ذكاء المقرر', 'lecture.publishedBy': 'نشرها',
  'lecture.original': 'اقرأ الأصل — وهو ما درّسه الأستاذ',
  'study.makeQuiz': 'اختبار من عشرة أسئلة', 'study.makeFlashcards': 'بطاقات مراجعة',
  'study.makeAudio': 'مراجعة صوتية في ١٥ دقيقة', 'study.submit': 'إرسال الإجابات',
  'study.onTheShelf': 'المتاح', 'study.notRead': 'لم يراجعها أستاذ',
  'work.reading': 'القراءات', 'work.assignments': 'الواجبات', 'work.handIn': 'تسليم',
  'work.marked': 'مُصحَّح', 'work.due': 'موعد التسليم',
  'ai.askCourse': 'اسأل عن هذا المقرر…', 'ai.askLecture': 'اسأل عن هذه المحاضرة…',
  'ai.notCovered': 'محاضرات هذا المقرر لا تتناول ذلك.',
  'ai.fromYourLectures': 'من محاضراتك',
  'common.copy': 'نسخ', 'common.download': 'تنزيل', 'common.speed': 'السرعة',
  'common.language': 'اللغة', 'common.voice': 'الصوت',
  'common.locked': 'مثبّتة على لغة دراستك', 'common.loading': 'جارٍ التحميل…',
  'common.nothingYet': 'لا شيء بعد',
};

const zh: Catalogue = {
  'nav.dashboard': '概览', 'nav.lectures': '讲课', 'nav.courses': '课程',
  'nav.notifications': '动态', 'nav.profile': '我的资料', 'nav.settings': '设置',
  'nav.viewingAs': '当前身份',
  'course.lectures': '讲课', 'course.revision': '复习', 'course.search': '搜索',
  'course.readingAndWork': '阅读与作业', 'course.courseAI': '课程助教',
  'course.newLecture': '新增讲课', 'course.taughtBy': '授课教师',
  'course.knowledgeBase': '课程知识库',
  'lecture.pipeline': '处理流程', 'lecture.read': '阅读笔记',
  'lecture.listen': '收听 — 15 分钟', 'lecture.revise': '复习', 'lecture.quiz': '做测验',
  'lecture.ask': '询问课程助教', 'lecture.publishedBy': '发布者',
  'lecture.original': '阅读原文 — 那才是教师所讲的内容',
  'study.makeQuiz': '十题测验', 'study.makeFlashcards': '记忆卡',
  'study.makeAudio': '15 分钟音频复习', 'study.submit': '提交答案',
  'study.onTheShelf': '已有内容', 'study.notRead': '教师尚未审阅',
  'work.reading': '阅读', 'work.assignments': '作业', 'work.handIn': '提交',
  'work.marked': '已批改', 'work.due': '截止',
  'ai.askCourse': '就本课程提问…', 'ai.askLecture': '就本讲提问…',
  'ai.notCovered': '本课程的讲课没有涉及这一点。',
  'ai.fromYourLectures': '出自你的讲课',
  'common.copy': '复制', 'common.download': '下载', 'common.speed': '速度',
  'common.language': '语言', 'common.voice': '语音',
  'common.locked': '已锁定为你的学习语言', 'common.loading': '加载中…',
  'common.nothingYet': '暂无内容',
};

const sw: Catalogue = {
  'nav.dashboard': 'Dashibodi', 'nav.lectures': 'Mihadhara', 'nav.courses': 'Kozi',
  'nav.notifications': 'Yaliyotokea', 'nav.profile': 'Wasifu wangu', 'nav.settings': 'Mipangilio',
  'nav.viewingAs': 'Unatazama kama',
  'course.lectures': 'Mihadhara', 'course.revision': 'Marudio', 'course.search': 'Tafuta',
  'course.readingAndWork': 'Usomaji na kazi', 'course.courseAI': 'AI ya kozi',
  'course.newLecture': 'Mhadhara mpya', 'course.taughtBy': 'Anafundishwa na',
  'course.knowledgeBase': 'Hifadhi ya maarifa ya kozi',
  'lecture.pipeline': 'Hatua za uchakataji', 'lecture.read': 'Soma maelezo',
  'lecture.listen': 'Sikiliza — dakika 15', 'lecture.revise': 'Marudio', 'lecture.quiz': 'Fanya jaribio',
  'lecture.ask': 'Uliza AI ya kozi', 'lecture.publishedBy': 'Imechapishwa na',
  'lecture.original': 'Soma asili — ndiyo aliyofundisha mhadhiri',
  'study.makeQuiz': 'Jaribio la maswali kumi', 'study.makeFlashcards': 'Kadi za marudio',
  'study.makeAudio': 'Marudio ya sauti ya dakika 15', 'study.submit': 'Wasilisha majibu',
  'study.onTheShelf': 'Yaliyopo', 'study.notRead': 'hayajasomwa na mhadhiri',
  'work.reading': 'Usomaji', 'work.assignments': 'Kazi', 'work.handIn': 'Wasilisha',
  'work.marked': 'Imesahihishwa', 'work.due': 'mwisho',
  'ai.askCourse': 'Uliza kuhusu kozi hii…', 'ai.askLecture': 'Uliza kuhusu mhadhara huu…',
  'ai.notCovered': 'Mihadhara ya kozi hii haigusii hilo.',
  'ai.fromYourLectures': 'Kutoka mihadhara yako',
  'common.copy': 'Nakili', 'common.download': 'Pakua', 'common.speed': 'Kasi',
  'common.language': 'Lugha', 'common.voice': 'Sauti',
  'common.locked': 'imefungwa kwa lugha yako ya masomo', 'common.loading': 'Inapakia…',
  'common.nothingYet': 'Bado hakuna',
};

const de: Catalogue = {
  'nav.dashboard': 'Übersicht', 'nav.lectures': 'Vorlesungen', 'nav.courses': 'Kurse',
  'nav.notifications': 'Neuigkeiten', 'nav.profile': 'Mein Profil', 'nav.settings': 'Einstellungen',
  'nav.viewingAs': 'Angezeigt als',
  'course.lectures': 'Vorlesungen', 'course.revision': 'Wiederholung', 'course.search': 'Suchen',
  'course.readingAndWork': 'Lektüre und Aufgaben', 'course.courseAI': 'Kurs-KI',
  'course.newLecture': 'Neue Vorlesung', 'course.taughtBy': 'Gelehrt von',
  'course.knowledgeBase': 'Wissensbasis des Kurses',
  'lecture.pipeline': 'Verarbeitung', 'lecture.read': 'Notizen lesen',
  'lecture.listen': 'Anhören — 15 Min.', 'lecture.revise': 'Wiederholung', 'lecture.quiz': 'Test machen',
  'lecture.ask': 'Kurs-KI fragen', 'lecture.publishedBy': 'Veröffentlicht von',
  'lecture.original': 'Das Original lesen — es ist das, was gelehrt wurde',
  'study.makeQuiz': 'Ein Test mit zehn Fragen', 'study.makeFlashcards': 'Karteikarten',
  'study.makeAudio': 'Eine 15-minütige Audio-Wiederholung', 'study.submit': 'Antworten abgeben',
  'study.onTheShelf': 'Vorhanden', 'study.notRead': 'von keiner Lehrkraft geprüft',
  'work.reading': 'Lektüre', 'work.assignments': 'Aufgaben', 'work.handIn': 'Abgeben',
  'work.marked': 'Bewertet', 'work.due': 'fällig',
  'ai.askCourse': 'Fragen Sie zu diesem Kurs…', 'ai.askLecture': 'Fragen Sie zu dieser Vorlesung…',
  'ai.notCovered': 'Die Vorlesungen dieses Kurses behandeln das nicht.',
  'ai.fromYourLectures': 'Aus Ihren Vorlesungen',
  'common.copy': 'Kopieren', 'common.download': 'Herunterladen', 'common.speed': 'Geschwindigkeit',
  'common.language': 'Sprache', 'common.voice': 'Stimme',
  'common.locked': 'auf Ihre Arbeitssprache festgelegt', 'common.loading': 'Wird geladen…',
  'common.nothingYet': 'Noch nichts',
};

const no: Catalogue = {
  'nav.dashboard': 'Oversikt', 'nav.lectures': 'Forelesninger', 'nav.courses': 'Emner',
  'nav.notifications': 'Hva har skjedd', 'nav.profile': 'Min profil', 'nav.settings': 'Innstillinger',
  'nav.viewingAs': 'Vises som',
  'course.lectures': 'Forelesninger', 'course.revision': 'Repetisjon', 'course.search': 'Søk',
  'course.readingAndWork': 'Pensum og arbeid', 'course.courseAI': 'Emne-KI',
  'course.newLecture': 'Ny forelesning', 'course.taughtBy': 'Undervises av',
  'course.knowledgeBase': 'Emnets kunnskapsbase',
  'lecture.pipeline': 'Behandling', 'lecture.read': 'Les notatene',
  'lecture.listen': 'Lytt — 15 min', 'lecture.revise': 'Repetisjon', 'lecture.quiz': 'Ta en quiz',
  'lecture.ask': 'Spør emne-KI-en', 'lecture.publishedBy': 'Publisert av',
  'lecture.original': 'Les originalen — det er det foreleseren underviste',
  'study.makeQuiz': 'En quiz med ti spørsmål', 'study.makeFlashcards': 'Kort',
  'study.makeAudio': 'En 15-minutters lydrepetisjon', 'study.submit': 'Send inn svar',
  'study.onTheShelf': 'Tilgjengelig', 'study.notRead': 'ikke lest av en foreleser',
  'work.reading': 'Pensum', 'work.assignments': 'Arbeid', 'work.handIn': 'Lever',
  'work.marked': 'Vurdert', 'work.due': 'frist',
  'ai.askCourse': 'Spør om dette emnet…', 'ai.askLecture': 'Spør om denne forelesningen…',
  'ai.notCovered': 'Forelesningene i dette emnet dekker ikke det.',
  'ai.fromYourLectures': 'Fra forelesningene dine',
  'common.copy': 'Kopier', 'common.download': 'Last ned', 'common.speed': 'Hastighet',
  'common.language': 'Språk', 'common.voice': 'Stemme',
  'common.locked': 'låst til arbeidsspråket ditt', 'common.loading': 'Laster…',
  'common.nothingYet': 'Ingenting ennå',
};

interface Bundle {
  strings: Catalogue;
  /** Has a person who reads this language checked these words? */
  reviewed: boolean;
}

const BUNDLES: Record<string, Bundle> = {
  en: { strings: en, reviewed: true },
  fr: { strings: fr, reviewed: false },
  es: { strings: es, reviewed: false },
  pt: { strings: pt, reviewed: false },
  ar: { strings: ar, reviewed: false },
  zh: { strings: zh, reviewed: false },
  sw: { strings: sw, reviewed: false },
  de: { strings: de, reviewed: false },
  no: { strings: no, reviewed: false },
};

/**
 * One string, in the working language, falling back to English. NEVER the key:
 * "nav.courses" on a screen is worse than a word in the wrong language.
 */
export function translate(code: string | undefined, key: UIKey): string {
  return BUNDLES[code ?? 'en']?.strings[key] ?? en[key];
}

/** A `t` bound to one language, for a component that uses several strings. */
export function translator(code: string | undefined) {
  return (key: UIKey) => translate(code, key);
}

/** What is still English in a given language. Measurable, so nobody guesses. */
export function missing(code: string): UIKey[] {
  const bundle = BUNDLES[code];
  if (!bundle) return Object.keys(en) as UIKey[];
  return (Object.keys(en) as UIKey[]).filter((key) => !bundle.strings[key]);
}

export function coverage(code: string): { done: number; total: number; reviewed: boolean } {
  const total = Object.keys(en).length;
  return { done: total - missing(code).length, total, reviewed: BUNDLES[code]?.reviewed ?? false };
}

export const UI_LANGUAGES = Object.keys(BUNDLES);
