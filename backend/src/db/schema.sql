-- ============================================================================
-- Kibarua marketplace - SQLite schema
-- Reconciles the entities implied by the frontend (users, jobs, applications,
-- messaging, notifications, payments, reviews, recommendations, search, …).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ── Users & auth ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT    UNIQUE NOT NULL,
  email               TEXT    UNIQUE NOT NULL,
  password_hash       TEXT    NOT NULL,
  full_name           TEXT    NOT NULL DEFAULT '',
  role                TEXT    NOT NULL DEFAULT 'worker'
                        CHECK (role IN ('worker', 'employer', 'admin')),
  phone               TEXT,
  avatar_url          TEXT,
  is_verified         INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1,
  email_verify_token  TEXT,
  reset_token         TEXT,
  reset_token_expires TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Worker profile (1:1 with users where role = worker) ──────────────────────
CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  professional_title    TEXT    DEFAULT '',
  headline              TEXT    DEFAULT '',
  bio                   TEXT    DEFAULT '',
  hourly_rate           REAL    DEFAULT 0,
  experience_years      INTEGER DEFAULT 0,
  experience_level      TEXT    DEFAULT 'entry'
                          CHECK (experience_level IN ('entry', 'intermediate', 'expert')),
  portfolio_url         TEXT    DEFAULT '',
  availability_status   TEXT    DEFAULT 'available'
                          CHECK (availability_status IN ('available', 'partially_available', 'unavailable')),
  open_to_remote        INTEGER DEFAULT 1,
  location_city         TEXT    DEFAULT '',
  location_state        TEXT    DEFAULT '',
  location_country      TEXT    DEFAULT 'Kenya',
  skills                TEXT    DEFAULT '[]',   -- JSON array
  languages             TEXT    DEFAULT '[]',   -- JSON array
  certifications        TEXT    DEFAULT '[]',   -- JSON array
  profile_photo_url     TEXT    DEFAULT '',
  avg_rating            REAL    DEFAULT 0,
  total_reviews         INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Employer / business profile (1:1 with users where role = employer) ───────
CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name   TEXT    DEFAULT '',
  description    TEXT    DEFAULT '',
  business_type  TEXT    DEFAULT '',
  phone          TEXT    DEFAULT '',
  logo_url       TEXT    DEFAULT '',
  jobs_completed INTEGER DEFAULT 0,
  avg_rating     REAL    DEFAULT 0,
  total_reviews  INTEGER DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Jobs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT    NOT NULL,
  description       TEXT    NOT NULL DEFAULT '',
  category          TEXT    DEFAULT 'other',
  experience_level  TEXT    DEFAULT 'entry'
                      CHECK (experience_level IN ('entry', 'intermediate', 'expert')),
  budget_type       TEXT    DEFAULT 'fixed'
                      CHECK (budget_type IN ('fixed', 'hourly')),
  budget_amount     REAL    DEFAULT 0,
  budget_min        REAL    DEFAULT 0,
  budget_max        REAL    DEFAULT 0,
  currency          TEXT    DEFAULT 'KES',
  duration          TEXT    DEFAULT '',
  deadline          TEXT,
  required_skills   TEXT    DEFAULT '[]',   -- JSON array
  visibility        TEXT    DEFAULT 'public'
                      CHECK (visibility IN ('public', 'private')),
  location_required INTEGER DEFAULT 0,
  location_city     TEXT    DEFAULT '',
  location_country  TEXT    DEFAULT 'Kenya',
  remote_allowed    INTEGER DEFAULT 1,
  status            TEXT    DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  proposals_count   INTEGER DEFAULT 0,
  views_count       INTEGER DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);

-- ── Applications / proposals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter TEXT    DEFAULT '',
  bid_amount   REAL    DEFAULT 0,
  status       TEXT    DEFAULT 'pending'
                 CHECK (status IN ('pending', 'hired', 'rejected', 'withdrawn')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_apps_job    ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_apps_worker ON applications(worker_id);

-- ── Hirings / engagements (links employer+worker+job; basis for reviews) ─────
CREATE TABLE IF NOT EXISTS hirings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       REAL    DEFAULT 0,
  status       TEXT    DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hirings_worker   ON hirings(worker_id);
CREATE INDEX IF NOT EXISTS idx_hirings_employer ON hirings(employer_id);

-- ── Conversations & messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_body    TEXT    NOT NULL DEFAULT '',
  attachments     TEXT    DEFAULT '[]',   -- JSON array
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msgs_conversation ON messages(conversation_id);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT    NOT NULL DEFAULT 'system'
                      CHECK (notification_type IN
                        ('job_match', 'message', 'review', 'payment', 'proposal', 'system')),
  title             TEXT    NOT NULL DEFAULT '',
  message           TEXT    NOT NULL DEFAULT '',
  link              TEXT    DEFAULT '',
  is_read           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- ── Reviews, responses, helpful-votes, disputes ─────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  hiring_id             INTEGER REFERENCES hirings(id) ON DELETE SET NULL,
  job_id                INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  reviewer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_type           TEXT    NOT NULL DEFAULT 'for_worker'
                          CHECK (review_type IN ('for_worker', 'for_employer')),
  rating                INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                 TEXT    DEFAULT '',
  description           TEXT    DEFAULT '',
  quality_rating        INTEGER,
  communication_rating  INTEGER,
  timeliness_rating     INTEGER,
  professionalism_rating INTEGER,
  response_text         TEXT,
  response_at           TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

CREATE TABLE IF NOT EXISTS review_votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_disputes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  raised_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT    NOT NULL DEFAULT '',
  description TEXT    DEFAULT '',
  status      TEXT    DEFAULT 'open'
                CHECK (status IN ('open', 'resolved', 'rejected')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Payments: wallet, methods, transactions, invoices, withdrawals ──────────
CREATE TABLE IF NOT EXISTS wallets (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance        REAL    NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'KES',
  total_earned   REAL    NOT NULL DEFAULT 0,
  total_spent    REAL    NOT NULL DEFAULT 0,
  total_refunded REAL    NOT NULL DEFAULT 0,
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type TEXT    NOT NULL DEFAULT 'card'
                CHECK (method_type IN ('card', 'mobile_money', 'bank_transfer')),
  provider    TEXT    DEFAULT '',
  last_four   TEXT    DEFAULT '',
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  payer_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payee_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount           REAL    NOT NULL DEFAULT 0,
  currency         TEXT    NOT NULL DEFAULT 'KES',
  transaction_type TEXT    NOT NULL DEFAULT 'payment'
                     CHECK (transaction_type IN
                       ('payment', 'payout', 'refund', 'deposit', 'withdrawal', 'fee')),
  status           TEXT    NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('pending', 'completed', 'failed')),
  reference        TEXT    DEFAULT '',
  description      TEXT    DEFAULT '',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT    UNIQUE NOT NULL,
  issuer_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  job_id         INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  amount         REAL    NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'KES',
  status         TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  issue_date     TEXT    NOT NULL DEFAULT (date('now')),
  due_date       TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            REAL    NOT NULL,
  payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
  status            TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'failed')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Saved jobs, recommendations, searches ───────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_jobs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL DEFAULT 0,
  reason      TEXT    DEFAULT '',
  is_viewed   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query      TEXT    DEFAULT '',
  filters    TEXT    DEFAULT '{}',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_terms (
  term       TEXT PRIMARY KEY,
  kind       TEXT DEFAULT 'job',
  popularity INTEGER NOT NULL DEFAULT 1
);

-- ── Contact / support messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL DEFAULT '',
  email      TEXT    NOT NULL DEFAULT '',
  subject    TEXT    DEFAULT '',
  message    TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
