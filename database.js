const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'bionexus.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        level TEXT,
        interests TEXT,
        xp INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        streak_freezes INTEGER DEFAULT 0,
        last_active TEXT,
        setup_complete INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
    );

    CREATE TABLE IF NOT EXISTS quiz_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        topic_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
    );

    CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        interval INTEGER DEFAULT 0,
        repetition INTEGER DEFAULT 0,
        efactor REAL DEFAULT 2.5,
        next_review_date INTEGER,
        FOREIGN KEY (user_email) REFERENCES users(email)
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        subscription TEXT NOT NULL,
        FOREIGN KEY (user_email) REFERENCES users(email)
    );
`);

function columnExists(table, column) {
    return db.prepare(`PRAGMA table_info(${table})`).all().some(col => col.name === column);
}

function addColumnIfMissing(table, column, definition) {
    if (!columnExists(table, column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Safe additive migrations for the multi-subject QUORIX upgrade.
addColumnIfMissing('quiz_history', 'user_id', 'INTEGER');
addColumnIfMissing('quiz_history', 'subject', "TEXT DEFAULT 'All Topics'");
addColumnIfMissing('quiz_history', 'topic', "TEXT DEFAULT 'General'");
addColumnIfMissing('quiz_history', 'difficulty', "TEXT DEFAULT 'Intermediate'");
addColumnIfMissing('quiz_history', 'created_at', 'TEXT');

addColumnIfMissing('flashcards', 'user_id', 'INTEGER');
addColumnIfMissing('flashcards', 'subject', "TEXT DEFAULT 'All Topics'");
addColumnIfMissing('flashcards', 'topic', "TEXT DEFAULT 'General'");
addColumnIfMissing('flashcards', 'difficulty', "TEXT DEFAULT 'Intermediate'");
addColumnIfMissing('flashcards', 'question', 'TEXT');
addColumnIfMissing('flashcards', 'answer', 'TEXT');
addColumnIfMissing('flashcards', 'created_at', 'TEXT');
addColumnIfMissing('users', 'streak_freezes', 'INTEGER DEFAULT 0');

db.exec(`
    UPDATE quiz_history SET created_at = COALESCE(created_at, date, CURRENT_TIMESTAMP);
    UPDATE quiz_history SET topic = COALESCE(NULLIF(topic, ''), topic_name, 'General');
    UPDATE flashcards SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
    UPDATE flashcards SET question = COALESCE(question, front);
    UPDATE flashcards SET answer = COALESCE(answer, back);
`);

module.exports = db;
