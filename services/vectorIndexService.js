/** @module vectorIndexService — Chunks documents and manages vector search index */
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { LocalIndex } = require('vectra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const INDEX_DIR = process.env.VECTRA_INDEX_DIR || './vectra-index';

// One index per user to isolate documents
const getIndex = async (userId) => {
  const indexPath = path.join(INDEX_DIR, `user_${userId}`);
  const index = new LocalIndex(indexPath);
  if (!await index.isIndexCreated()) await index.createIndex();
  return index;
};

// Generate embeddings using Groq or fallback to simple TF-IDF hash
const generateEmbedding = async (text) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'nomic-embed-text-v1_5', input: text })
    });
    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    logger.warn('Embedding API failed, using fallback hash embedding');
    return simpleTFIDFEmbedding(text); // fallback — implement below
  }
};

// Fallback: simple deterministic embedding from character frequency
const simpleTFIDFEmbedding = (text) => {
  const vector = new Array(384).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  words.forEach(word => {
    let hash = 0;
    for (const c of word) hash = (hash * 31 + c.charCodeAt(0)) % 384;
    vector[Math.abs(hash)] += 1 / (words.length || 1);
  });
  const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map(v => v / magnitude);
};

const chunkAndIndexDocument = async (documentId, userId, pages, db) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,       // ~350-400 words per chunk
    chunkOverlap: 50,     // overlap for context continuity
    separators: ['\n\n', '\n', '. ', ' ', '']
  });

  const index = await getIndex(userId);
  const chunks = [];
  let globalCharOffset = 0;

  for (const page of pages) {
    const rawChunks = await splitter.splitText(page.text);
    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i];
      const chunkId = uuidv4();
      const embedding = await generateEmbedding(chunkText);

      // Store in vector index
      await index.insertItem({
        id: chunkId,
        vector: embedding,
        metadata: { documentId, chunkId, pageNumber: page.num, preview: chunkText.slice(0, 100) }
      });

      // Store chunk text in SQLite
      chunks.push({
        id: chunkId,
        document_id: documentId,
        chunk_index: chunks.length,
        content: chunkText,
        page_number: page.num,
        char_start: globalCharOffset,
        char_end: globalCharOffset + chunkText.length
      });

      globalCharOffset += chunkText.length;
    }
  }

  // Batch insert chunks into SQLite
  const insertChunk = db.prepare(`
    INSERT INTO document_chunks (id, document_id, chunk_index, content, page_number, char_start, char_end)
    VALUES (@id, @document_id, @chunk_index, @content, @page_number, @char_start, @char_end)
  `);
  const insertMany = db.transaction((chunkList) => chunkList.forEach(c => insertChunk.run(c)));
  insertMany(chunks);

  return chunks.length;
};

const searchSimilarChunks = async (query, userId, documentId, topK = 5) => {
  const index = await getIndex(userId);
  const queryEmbedding = await generateEmbedding(query);
  const results = await index.queryItems(queryEmbedding, topK);

  // Filter to only chunks from the specified document
  return results
    .filter(r => r.item.metadata.documentId === documentId)
    .map(r => ({ ...r.item.metadata, score: r.score }));
};

module.exports = { chunkAndIndexDocument, searchSimilarChunks };
