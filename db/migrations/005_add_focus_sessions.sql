-- Migration: Add AI Attention Monitoring tables
-- Focus sessions tracking metadata
CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER DEFAULT 0,
    avg_attentiveness REAL DEFAULT 100.0,
    drowsy_count INTEGER DEFAULT 0,
    distraction_count INTEGER DEFAULT 0,
    phone_count INTEGER DEFAULT 0,
    absence_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Auditable timelines logs of specific focus violation triggers
CREATE TABLE IF NOT EXISTS focus_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'drowsy' | 'distraction' | 'phone_usage' | 'absent' | 'attentive_return'
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);

-- Add performance-enhancing indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_email ON focus_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_focus_logs_session ON focus_logs(session_id);
