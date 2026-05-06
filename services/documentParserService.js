/** @module documentParserService — Extracts text and structure from uploaded files */
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const fs = require('fs/promises');
const path = require('path');
const { logger } = require('../utils/logger.js');

/**
 * Parse any supported file type into structured text
 * @param {string} filePath - absolute or relative path to the uploaded file
 * @param {string} fileType - one of: pdf, docx, pptx, txt, image
 * @returns {{ fullText: string, pageCount: number|null, pages: Array<{num: number, text: string}>, metadata: object }}
 */
const parseDocument = async (filePath, fileType) => {
  const absPath = path.resolve(filePath);
  logger.info(`Parsing document: ${absPath} (type: ${fileType})`);

  switch (fileType) {
    case 'pdf':   return parsePDF(absPath);
    case 'docx':  return parseDOCX(absPath);
    case 'pptx':  return parsePPTX(absPath);
    case 'txt':   return parseTXT(absPath);
    case 'image': return parseImage(absPath);
    default: throw new Error(`Unsupported file type: ${fileType}`);
  }
};

// ── PDF ──────────────────────────────────────────
const parsePDF = async (filePath) => {
  // pdf-parse v2 uses the PDFParse class with { url: filePath }
  const parser = new PDFParse({ url: filePath });
  await parser.load();

  const textResult = await parser.getText();  // { pages: [{ text: string }, ...] }
  const info = await parser.getInfo();        // { total, info: { Author, ... } }

  const pages = textResult.pages.map((p, i) => ({
    num: i + 1,
    text: (p.text || '').trim()
  }));

  const fullText = pages.map(p => p.text).join('\n\n');
  const pageCount = info.total || pages.length;

  parser.destroy();

  logger.info(`PDF parsed: ${pageCount} pages, ${fullText.length} chars`);
  return {
    fullText,
    pageCount,
    pages,
    metadata: {
      title: info.info?.Title || null,
      author: info.info?.Author || null,
      creator: info.info?.Creator || null,
    }
  };
};

// ── DOCX ─────────────────────────────────────────
const parseDOCX = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  return {
    fullText: text,
    pageCount: null,
    pages: [{ num: 1, text }],      // DOCX doesn't have page boundaries
    sections: extractSectionsFromText(text),
    metadata: {}
  };
};

// ── TXT ──────────────────────────────────────────
const parseTXT = async (filePath) => {
  const text = await fs.readFile(filePath, 'utf-8');
  return {
    fullText: text,
    pageCount: null,
    pages: [{ num: 1, text }],
    metadata: {}
  };
};

// ── Image (OCR) ──────────────────────────────────
const parseImage = async (filePath) => {
  logger.info('Starting OCR on image...');
  const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
    logger: m => {
      if (m.progress && m.progress > 0) {
        logger.debug(`OCR: ${m.status} ${Math.round(m.progress * 100)}%`);
      }
    }
  });
  return {
    fullText: text,
    pageCount: 1,
    pages: [{ num: 1, text }],
    metadata: { source: 'ocr' }
  };
};

// ── PPTX (basic fallback) ────────────────────────
const parsePPTX = async (filePath) => {
  // PPTX is a ZIP of XML slides — extract text from slide XML nodes
  // For now, treat as unsupported and return a helpful message
  logger.warn('PPTX parsing is basic — limited text extraction');
  return {
    fullText: 'PPTX text extraction is not fully supported yet. Please convert to PDF for best results.',
    pageCount: null,
    pages: [{ num: 1, text: 'PPTX text extraction is not fully supported yet. Please convert to PDF for best results.' }],
    metadata: {}
  };
};

// Extract headings/sections from plain text heuristically
const extractSectionsFromText = (text) => {
  const lines = text.split('\n');
  return lines
    .filter(line => line.trim().length < 80 && line.trim().length > 3 && !line.includes('.'))
    .map((line, i) => ({ heading: line.trim(), lineIndex: i }));
};

module.exports = { parseDocument };
