-- Document metadata table
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,          -- UUID
  user_id     INTEGER NOT NULL,
  filename    TEXT NOT NULL,             -- original filename shown to user
  stored_name TEXT NOT NULL,             -- UUID-based stored filename
  file_type   TEXT NOT NULL,             -- pdf | docx | pptx | txt | image
  file_size   INTEGER NOT NULL,          -- bytes
  page_count  INTEGER,                   -- null for txt/images
  subject     TEXT,                      -- user-assigned subject tag
  doc_type    TEXT NOT NULL,             -- syllabus | notes | textbook | exam | research | other
  status      TEXT DEFAULT 'processing', -- processing | ready | failed
  chunk_count INTEGER DEFAULT 0,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual text chunks with position metadata
CREATE TABLE IF NOT EXISTS document_chunks (
  id          TEXT PRIMARY KEY,          -- UUID
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,          -- position in document
  content     TEXT NOT NULL,             -- raw text of this chunk
  page_number INTEGER,                   -- page number (null for non-paged docs)
  section     TEXT,                      -- section/heading if detectable
  char_start  INTEGER,                   -- character offset in full document
  char_end    INTEGER,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Track which documents are shared in courses
CREATE TABLE IF NOT EXISTS course_documents (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  course_code TEXT NOT NULL,             -- e.g. "CS101", "PHY201"
  shared_by   INTEGER NOT NULL,          -- user_id of professor
  shared_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (shared_by) REFERENCES users(id)
);

-- User's Q&A history on a document
CREATE TABLE IF NOT EXISTS document_queries (
  id            TEXT PRIMARY KEY,
  document_id   TEXT NOT NULL,
  user_id       INTEGER NOT NULL,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  citations     TEXT NOT NULL,           -- JSON array of citation objects
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_queries_document ON document_queries(document_id, user_id);
