-- Migration: Add leaderboard privacy + display_name + onboarding columns
-- Phase 1.5 + Phase 2.1 + Phase 3.2 — Prep columns

-- Leaderboard privacy
ALTER TABLE users ADD COLUMN leaderboard_visible INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN leaderboard_scope TEXT DEFAULT 'friends';

-- Onboarding
ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN subjects TEXT;

-- Practice tests
CREATE TABLE IF NOT EXISTS practice_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    score INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email)
);

CREATE TABLE IF NOT EXISTS practice_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    question TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER,
    explanation TEXT,
    ai_score INTEGER,
    FOREIGN KEY (test_id) REFERENCES practice_tests(id)
);

-- Daily challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    date TEXT NOT NULL,
    generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    challenge_id INTEGER NOT NULL,
    user_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    xp_earned INTEGER DEFAULT 0,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id)
);

-- Concepts knowledge graph
CREATE TABLE IF NOT EXISTS concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concept_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    FOREIGN KEY (from_id) REFERENCES concepts(id),
    FOREIGN KEY (to_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS user_concept_mastery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    concept_id INTEGER NOT NULL,
    mastery_percent INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    last_reviewed TEXT,
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

-- Streak freezes tracking
CREATE TABLE IF NOT EXISTS streak_freezes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT,
    FOREIGN KEY (user_email) REFERENCES users(email)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_practice_tests_email ON practice_tests(user_email);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(date);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_email ON daily_challenge_attempts(user_email);
CREATE INDEX IF NOT EXISTS idx_concept_mastery_email ON user_concept_mastery(user_email);
