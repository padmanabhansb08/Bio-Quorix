/** @module fileUploadService — Handles upload, parsing, chunking, and indexing */
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { logger } = require('../utils/logger.js');

const ALLOWED_MIME_TYPES = {
  'application/pdf':                                                              'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':     'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':   'pptx',
  'text/plain':                                                                   'txt',
  'image/jpeg':                                                                   'image',
  'image/png':                                                                    'image',
};

const MAX_SIZE_BYTES = (parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 25) * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOADS_DIR || './uploads';

// Ensure uploads directory exists synchronously at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  logger.info(`Created uploads directory: ${UPLOAD_DIR}`);
}

// Multer storage — store as UUID to prevent path traversal attacks
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Synchronous directory creation — avoids Multer v2 async callback issues
    try {
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed: PDF, DOCX, PPTX, TXT, PNG, JPG`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES }
});

// PDF magic bytes: %PDF  →  25 50 44 46
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);
// DOCX/XLSX/PPTX are ZIP: PK  →  50 4B
const ZIP_MAGIC = Buffer.from([0x50, 0x4B]);
// PNG magic:  89 50 4E 47
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
// JPEG magic: FF D8
const JPG_MAGIC = Buffer.from([0xFF, 0xD8]);

// Verify file magic bytes after upload (prevent MIME spoofing)
// Returns true if the file looks valid for its declared MIME type
const verifyFileMagicBytes = async (filePath, mimeType) => {
  // Plain text has no magic bytes — always accept
  if (mimeType === 'text/plain' || filePath.endsWith('.txt')) return true;

  try {
    const fd = await fsp.open(filePath, 'r');
    const buf = Buffer.alloc(8);
    await fd.read(buf, 0, 8, 0);
    await fd.close();

    if (mimeType === 'application/pdf') {
      return buf.slice(0, 4).equals(PDF_MAGIC);
    }
    if (mimeType.includes('wordprocessingml') || mimeType.includes('presentationml')) {
      return buf.slice(0, 2).equals(ZIP_MAGIC); // Office Open XML = ZIP
    }
    if (mimeType === 'image/png') {
      return buf.slice(0, 4).equals(PNG_MAGIC);
    }
    if (mimeType === 'image/jpeg') {
      return buf.slice(0, 2).equals(JPG_MAGIC);
    }
    return true; // fallback — allow unknown
  } catch (err) {
    logger.warn(`Magic byte check failed for ${filePath}: ${err.message}`);
    return true; // don't block on read error
  }
};

module.exports = { storage, fileFilter, upload, verifyFileMagicBytes };
