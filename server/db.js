const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.ITSCOOL_DB_PATH || path.join(dataDir, 'itscool.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new DatabaseSync(dbPath);
module.exports = db;

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    grade INTEGER CHECK(grade IS NULL OR (grade >= 1 AND grade <= 11)),
    avatar TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    grade_min INTEGER NOT NULL DEFAULT 1,
    grade_max INTEGER NOT NULL DEFAULT 11,
    category TEXT NOT NULL,
    cover_color TEXT NOT NULL DEFAULT '#2563eb',
    icon TEXT NOT NULL DEFAULT '💻',
    published INTEGER NOT NULL DEFAULT 1,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    duration_min INTEGER NOT NULL DEFAULT 20,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_index INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    UNIQUE(user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('student', 'parent', 'other')),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    grade INTEGER CHECK(grade IS NULL OR (grade >= 1 AND grade <= 11)),
    notes TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    UNIQUE(parent_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    max_students INTEGER NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'left')),
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(group_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    due_date TEXT NOT NULL,
    paid_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedule_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'done', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    child_name TEXT,
    child_grade INTEGER CHECK(child_grade IS NULL OR (child_grade >= 1 AND child_grade <= 11)),
    interest TEXT,
    source TEXT DEFAULT 'website',
    status TEXT NOT NULL DEFAULT 'new'
      CHECK(status IN ('new', 'contacted', 'trial', 'won', 'lost')),
    notes TEXT,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES schedule_sessions(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'present'
      CHECK(status IN ('present', 'absent', 'late', 'excused')),
    note TEXT,
    marked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS homework (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS homework_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'assigned'
      CHECK(status IN ('assigned', 'submitted', 'reviewed', 'done')),
    answer TEXT,
    grade TEXT,
    teacher_note TEXT,
    submitted_at TEXT,
    UNIQUE(homework_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'all'
      CHECK(audience IN ('all', 'students', 'parents', 'staff', 'group')),
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT,
    type TEXT NOT NULL DEFAULT 'info',
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    issued_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    related_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TEXT,
    UNIQUE(thread_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Flexible school diary (dnevnik-like)
  CREATE TABLE IF NOT EXISTS diary_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    default_max_score REAL NOT NULL DEFAULT 5,
    direction TEXT NOT NULL DEFAULT 'higher_better'
      CHECK(direction IN ('higher_better', 'lower_better')),
    color TEXT NOT NULL DEFAULT '#8E6FAF',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diary_schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scale_max REAL NOT NULL DEFAULT 5,
    description TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(group_id)
  );

  CREATE TABLE IF NOT EXISTS diary_scheme_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id INTEGER NOT NULL REFERENCES diary_schemes(id) ON DELETE CASCADE,
    criteria_id INTEGER NOT NULL REFERENCES diary_criteria(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0,
    aggregation TEXT NOT NULL DEFAULT 'avg'
      CHECK(aggregation IN ('avg', 'sum', 'max', 'min', 'latest')),
    label_override TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(scheme_id, criteria_id)
  );

  CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    criteria_id INTEGER NOT NULL REFERENCES diary_criteria(id) ON DELETE RESTRICT,
    score REAL NOT NULL,
    max_score REAL NOT NULL DEFAULT 5,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    period_key TEXT NOT NULL DEFAULT '',
    session_id INTEGER REFERENCES schedule_sessions(id) ON DELETE SET NULL,
    homework_id INTEGER REFERENCES homework(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    graded_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diary_raise_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER REFERENCES diary_entries(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_score REAL,
    requested_score REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'approved', 'rejected', 'counter')),
    teacher_response TEXT NOT NULL DEFAULT '',
    counter_score REAL,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diary_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    related_entry_id INTEGER REFERENCES diary_entries(id) ON DELETE SET NULL,
    related_request_id INTEGER REFERENCES diary_raise_requests(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trial_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Пробное занятие',
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK(status IN ('scheduled', 'done', 'no_show', 'converted', 'cancelled')),
    outcome_notes TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolio_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url TEXT,
    tech_stack TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'school'
      CHECK(visibility IN ('private', 'school', 'public')),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK(status IN ('draft', 'published', 'archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'other'
      CHECK(doc_type IN ('homework', 'contract', 'material', 'lesson_asset', 'other')),
    entity_type TEXT,
    entity_id INTEGER,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS course_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    UNIQUE(course_id, slug)
  );

  CREATE TABLE IF NOT EXISTS lesson_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    config_json TEXT NOT NULL DEFAULT '{}',
    file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    criteria_id INTEGER REFERENCES diary_criteria(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lesson_id, slug)
  );

  CREATE TABLE IF NOT EXISTS block_quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    target_type TEXT NOT NULL
      CHECK(target_type IN ('course', 'section', 'lesson', 'block', 'document')),
    target_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    expires_at TEXT,
    max_visits INTEGER,
    visits INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS landing_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tokens_json TEXT NOT NULL DEFAULT '{}',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS landing_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK(status IN ('draft', 'published', 'archived')),
    theme_id INTEGER REFERENCES landing_themes(id) ON DELETE SET NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    published_at TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS landing_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    config_json TEXT NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(page_id, slug)
  );

  CREATE TABLE IF NOT EXISTS landing_survey_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    block_id INTEGER REFERENCES landing_blocks(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    score INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS landing_game_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL DEFAULT '{}',
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(page_id, session_id)
  );

  CREATE TABLE IF NOT EXISTS landing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    block_id INTEGER REFERENCES landing_blocks(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT '{}',
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS report_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    preset_code TEXT,
    layout_json TEXT NOT NULL DEFAULT '{"widgets":[]}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shared INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Soft-migrate courses/lessons for builder fields
(() => {
  const courseCols = db.prepare(`PRAGMA table_info(courses)`).all().map((c) => c.name);
  if (!courseCols.includes('slug')) {
    db.exec(`ALTER TABLE courses ADD COLUMN slug TEXT`);
  }
  if (!courseCols.includes('settings_json')) {
    db.exec(`ALTER TABLE courses ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'`);
  }
  const lessonCols = db.prepare(`PRAGMA table_info(lessons)`).all().map((c) => c.name);
  if (!lessonCols.includes('slug')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN slug TEXT`);
  }
  if (!lessonCols.includes('section_id')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN section_id INTEGER REFERENCES course_sections(id) ON DELETE SET NULL`);
  }
  if (!lessonCols.includes('summary')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN summary TEXT NOT NULL DEFAULT ''`);
  }
  if (!lessonCols.includes('settings_json')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'`);
  }
})();

// Soft-migrate leads for landing attribution
(() => {
  const cols = db.prepare(`PRAGMA table_info(leads)`).all().map((c) => c.name);
  const add = (name, sql) => {
    if (!cols.includes(name)) {
      try {
        db.exec(sql);
      } catch {
        // ignore
      }
    }
  };
  add('landing_page_id', `ALTER TABLE leads ADD COLUMN landing_page_id INTEGER REFERENCES landing_pages(id) ON DELETE SET NULL`);
  add('landing_block_id', `ALTER TABLE leads ADD COLUMN landing_block_id INTEGER REFERENCES landing_blocks(id) ON DELETE SET NULL`);
  add('utm_json', `ALTER TABLE leads ADD COLUMN utm_json TEXT NOT NULL DEFAULT '{}'`);
  add('session_id', `ALTER TABLE leads ADD COLUMN session_id TEXT`);
})();

// Seed default landing themes
(() => {
  try {
    const { DEFAULT_THEMES } = require('./services/landings');
    const count = db.prepare('SELECT COUNT(*) as c FROM landing_themes').get().c;
    if (count === 0) {
      const ins = db.prepare(
        `INSERT INTO landing_themes (code, name, tokens_json, is_system) VALUES (?, ?, ?, 1)`
      );
      for (const t of DEFAULT_THEMES) ins.run(t.code, t.name, t.tokens_json);
    }
  } catch (e) {
    console.warn('landing themes seed skipped:', e.message);
  }
})();

// Migrate users.role CHECK to include parent (SQLite can't ALTER CHECK)
(() => {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
  if (row?.sql && row.sql.includes('CHECK(role') && !row.sql.includes("'parent'")) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE users_mig (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin', 'parent')),
          grade INTEGER CHECK(grade IS NULL OR (grade >= 1 AND grade <= 11)),
          avatar TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_mig (id, email, password, name, role, grade, avatar, created_at)
        SELECT id, email, password, name, role, grade, avatar, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_mig RENAME TO users;
      `);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      console.warn('users role migrate skipped:', e.message);
    }
    db.exec('PRAGMA foreign_keys = ON');
  }
})();

// Mark overdue payments on boot
try {
  db.prepare(
    `UPDATE payments SET status = 'overdue'
     WHERE status = 'pending' AND date(due_date) < date('now')`
  ).run();
} catch {
  // ignore
}

// Flexible RBAC (roles ↔ permissions); migrates users.role CHECK away
require('./services/rbac').initRbac();
