/** @module documents — Document upload, processing, and Q&A routes */
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth.js');   // existing middleware — DO NOT MODIFY
const { upload, verifyFileMagicBytes } = require('../services/fileUploadService.js');
const { parseDocument } = require('../services/documentParserService.js');
const { chunkAndIndexDocument } = require('../services/vectorIndexService.js');
const { answerFromDocument } = require('../services/ragService.js');
const {
  generateFlashcardsFromDocument,
  generateLessonPlanFromDocument,
  generateDocumentSummary
} = require('../services/docAutoGenerateService.js');
const { sanitizePrompt } = require('../middleware/promptGuard.js');
const { logger } = require('../utils/logger.js');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─────────────────────────────────────────────
// POST /api/documents/upload
// Upload and process a document
// ─────────────────────────────────────────────
router.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ data: null, error: 'No file uploaded' });

  const { subject = 'General', doc_type = 'other' } = req.body;
  const docId = uuidv4();

  try {
    // Security: verify magic bytes match the declared MIME type
    const isValid = await verifyFileMagicBytes(req.file.path, req.file.mimetype);
    if (!isValid) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ data: null, error: 'File content does not match its extension' });
    }

    // Detect file type from MIME
    const mimeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'image/jpeg': 'image',
      'image/png': 'image'
    };
    const fileType = mimeMap[req.file.mimetype] || 'txt';

    // Insert document record with 'processing' status
    req.db.prepare(`
      INSERT INTO documents (id, user_id, filename, stored_name, file_type, file_size, subject, doc_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, req.user.id, req.file.originalname, req.file.filename, fileType, req.file.size, subject, doc_type);

    // Process asynchronously — don't block the HTTP response
    processDocumentAsync(docId, req.file.path, fileType, req.user.id, req.db)
      .catch(err => logger.error(`Document processing failed: docId=${docId}`, err));

    res.status(202).json({
      data: { documentId: docId, status: 'processing', message: 'Document uploaded. Processing started.' },
      error: null
    });

  } catch (err) {
    logger.error('Upload error', err);
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ data: null, error: 'Upload failed. Please try again.' });
  }
});

// Background processing function
const processDocumentAsync = async (docId, filePath, fileType, userId, db) => {
  try {
    const parsed = await parseDocument(filePath, fileType);
    const chunkCount = await chunkAndIndexDocument(docId, userId, parsed.pages, db);

    db.prepare(`
      UPDATE documents SET status='ready', chunk_count=?, page_count=?, processed_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(chunkCount, parsed.pageCount, docId);

    logger.info(`Document ready: docId=${docId}, chunks=${chunkCount}`);
  } catch (err) {
    db.prepare(`UPDATE documents SET status='failed' WHERE id=?`).run(docId);
    logger.error(`Processing failed: docId=${docId}`, err);
  }
};

// ─────────────────────────────────────────────
// GET /api/documents/status/:docId
// Poll processing status
// ─────────────────────────────────────────────
router.get('/status/:docId', (req, res) => {
  const doc = req.db.prepare(
    `SELECT id, filename, status, chunk_count, page_count, processed_at FROM documents WHERE id=? AND user_id=?`
  ).get(req.params.docId, req.user.id);

  if (!doc) return res.status(404).json({ data: null, error: 'Document not found' });
  res.json({ data: doc, error: null });
});

// ─────────────────────────────────────────────
// GET /api/documents
// List all user's documents
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const docs = req.db.prepare(`
    SELECT id, filename, file_type, file_size, subject, doc_type, status, page_count, chunk_count, uploaded_at
    FROM documents WHERE user_id=? ORDER BY uploaded_at DESC
  `).all(req.user.id);

  res.json({ data: docs, error: null });
});

// ─────────────────────────────────────────────
// POST /api/documents/:docId/ask
// Ask a question about the document
// ─────────────────────────────────────────────
router.post('/:docId/ask', sanitizePrompt, async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ data: null, error: 'Question is required' });

  const doc = req.db.prepare(
    `SELECT id, status, filename FROM documents WHERE id=? AND user_id=?`
  ).get(req.params.docId, req.user.id);

  if (!doc) return res.status(404).json({ data: null, error: 'Document not found' });
  if (doc.status !== 'ready') return res.status(409).json({ data: null, error: 'Document is still being processed. Please wait.' });

  try {
    const { answer, citations, confidence } = await answerFromDocument(
      question, req.params.docId, req.user.id, req.db
    );

    // Persist the Q&A
    const queryId = uuidv4();
    req.db.prepare(`
      INSERT INTO document_queries (id, document_id, user_id, question, answer, citations)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(queryId, req.params.docId, req.user.id, question, answer, JSON.stringify(citations));

    res.json({
      data: {
        queryId,
        question,
        answer,
        citations,
        confidence,
        documentName: doc.filename
      },
      error: null
    });
  } catch (err) {
    logger.error('RAG query error', err);
    res.status(500).json({ data: null, error: 'Failed to process question. Please try again.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/documents/:docId/generate/flashcards
// Auto-generate flashcards from document
// ─────────────────────────────────────────────
router.post('/:docId/generate/flashcards', async (req, res) => {
  const { count = 10 } = req.body;
  const doc = req.db.prepare(`SELECT * FROM documents WHERE id=? AND user_id=?`).get(req.params.docId, req.user.id);

  if (!doc || doc.status !== 'ready') return res.status(404).json({ data: null, error: 'Document not ready' });

  try {
    const flashcards = await generateFlashcardsFromDocument(req.params.docId, req.db, Math.min(count, 30));
    res.json({ data: { flashcards, source: doc.filename }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Flashcard generation failed' });
  }
});

// ─────────────────────────────────────────────
// POST /api/documents/:docId/generate/lesson-plan
// Auto-generate lesson plan from document
// ─────────────────────────────────────────────
router.post('/:docId/generate/lesson-plan', async (req, res) => {
  const doc = req.db.prepare(`SELECT * FROM documents WHERE id=? AND user_id=?`).get(req.params.docId, req.user.id);
  if (!doc || doc.status !== 'ready') return res.status(404).json({ data: null, error: 'Document not ready' });

  try {
    const lessonPlan = await generateLessonPlanFromDocument(req.params.docId, doc.subject, req.db);
    res.json({ data: { lessonPlan, source: doc.filename }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Lesson plan generation failed' });
  }
});

// ─────────────────────────────────────────────
// GET /api/documents/:docId/summary
// Get AI summary of the document
// ─────────────────────────────────────────────
router.get('/:docId/summary', async (req, res) => {
  const doc = req.db.prepare(`SELECT * FROM documents WHERE id=? AND user_id=?`).get(req.params.docId, req.user.id);
  if (!doc || doc.status !== 'ready') return res.status(404).json({ data: null, error: 'Document not ready' });

  try {
    const summary = await generateDocumentSummary(req.params.docId, req.db);
    res.json({ data: { summary, source: doc.filename, pageCount: doc.page_count }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Summary generation failed' });
  }
});

// ─────────────────────────────────────────────
// GET /api/documents/:docId/history
// Get Q&A history for a document
// ─────────────────────────────────────────────
router.get('/:docId/history', (req, res) => {
  const history = req.db.prepare(`
    SELECT id, question, answer, citations, created_at
    FROM document_queries WHERE document_id=? AND user_id=?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.params.docId, req.user.id);

  res.json({ data: history.map(h => ({ ...h, citations: JSON.parse(h.citations) })), error: null });
});

// ─────────────────────────────────────────────
// DELETE /api/documents/:docId
// Delete a document and all its data
// ─────────────────────────────────────────────
router.delete('/:docId', async (req, res) => {
  const doc = req.db.prepare(`SELECT stored_name FROM documents WHERE id=? AND user_id=?`).get(req.params.docId, req.user.id);
  if (!doc) return res.status(404).json({ data: null, error: 'Document not found' });

  req.db.prepare(`DELETE FROM documents WHERE id=?`).run(req.params.docId);

  const filePath = path.join(process.env.UPLOADS_DIR || './uploads', doc.stored_name);
  await fs.unlink(filePath).catch(() => {});

  res.json({ data: { deleted: true }, error: null });
});

module.exports = router;
