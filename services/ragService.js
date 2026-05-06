/** @module ragService — Retrieval-Augmented Generation with intent-aware responses */
const { searchSimilarChunks } = require('./vectorIndexService.js');
const { generateCompletion } = require('./aiService.js');
const { logger } = require('../utils/logger.js');

// ═══════════════════════════════════════════════════════
//  INTENT DETECTION — adapts response depth to user need
// ═══════════════════════════════════════════════════════
const INTENTS = {
  EXPLAIN:    { keywords: ['explain', 'describe', 'elaborate', 'detail', 'how does', 'how do', 'what happens', 'walk me through', 'break down', 'tell me about', 'teach me', 'help me understand', 'why does', 'why do', 'why is', 'in detail'], depth: 'deep', maxTokens: 2000 },
  SUMMARIZE:  { keywords: ['summarize', 'summary', 'overview', 'briefly', 'short', 'quick', 'tldr', 'in brief', 'gist', 'main points', 'key points'], depth: 'concise', maxTokens: 600 },
  DEFINE:     { keywords: ['define', 'definition', 'meaning', 'what is', 'what are', 'what does', 'what do'], depth: 'focused', maxTokens: 800 },
  COMPARE:    { keywords: ['compare', 'difference', 'differ', 'contrast', 'versus', 'vs', 'similarities', 'how is .* different'], depth: 'structured', maxTokens: 1500 },
  LIST:       { keywords: ['list', 'enumerate', 'name the', 'types of', 'examples of', 'categories', 'what types', 'how many'], depth: 'list', maxTokens: 1000 },
  APPLY:      { keywords: ['how to', 'how can', 'how would', 'use case', 'application', 'practical', 'apply', 'solve', 'calculate'], depth: 'practical', maxTokens: 1500 },
  GENERAL:    { keywords: [], depth: 'balanced', maxTokens: 1200 }
};

function detectIntent(question) {
  const q = question.toLowerCase();
  for (const [name, config] of Object.entries(INTENTS)) {
    if (name === 'GENERAL') continue;
    for (const kw of config.keywords) {
      if (kw.includes('.*') ? new RegExp(kw).test(q) : q.includes(kw)) {
        return { intent: name, ...config };
      }
    }
  }
  return { intent: 'GENERAL', ...INTENTS.GENERAL };
}

// ═══════════════════════════════════════════════════════
//  DEPTH-SPECIFIC INSTRUCTIONS
// ═══════════════════════════════════════════════════════
const DEPTH_INSTRUCTIONS = {
  deep: `The student is asking for a DETAILED EXPLANATION. You must:
- Provide a thorough, in-depth explanation covering every aspect found in the document
- Break complex concepts into simple sub-parts with clear headings
- Give examples from the document text when available
- Explain relationships between concepts
- Use analogies if it helps understanding
- Cover the "what", "why", and "how" dimensions
- Write at least 4-6 substantial paragraphs or bullet-point sections
- Do NOT be brief — the student explicitly wants depth and detail`,

  concise: `The student wants a BRIEF SUMMARY. You must:
- Provide a clear, concise overview in 3-5 bullet points
- Focus only on the most important facts
- Keep total response under 150 words
- No lengthy explanations needed`,

  focused: `The student wants a CLEAR DEFINITION. You must:
- Start with a precise, textbook-style definition from the document
- Follow with 1-2 supporting sentences that add context
- Include any classification or categories mentioned in the document
- Keep it focused and authoritative`,

  structured: `The student wants a COMPARISON. You must:
- Create a clear side-by-side comparison
- Use a structured format with categories (e.g., "Similarities" and "Differences")
- Include specific details from the document for each point
- End with a brief synthesis of the key distinctions`,

  list: `The student wants a LIST or enumeration. You must:
- Present information as a well-organized numbered or bulleted list
- Include brief descriptions for each item
- Group items by category if the document suggests groupings
- Be comprehensive — include every relevant item from the document`,

  practical: `The student wants PRACTICAL APPLICATION guidance. You must:
- Focus on how-to steps or practical applications
- Use numbered steps if describing a process
- Include any formulas, methods, or procedures from the document
- Add practical tips or important notes mentioned in the source`,

  balanced: `Provide a WELL-ROUNDED ANSWER that:
- Directly addresses the question with relevant information
- Includes enough detail to be genuinely helpful
- Uses examples from the document when available
- Is neither too brief nor unnecessarily verbose`
};

// ═══════════════════════════════════════════════════════
//  MAIN RAG FUNCTION
// ═══════════════════════════════════════════════════════
const answerFromDocument = async (question, documentId, userId, db) => {

  // Step 1: Detect what the student is asking for
  const { intent, depth, maxTokens } = detectIntent(question);
  logger.info(`Intent detected: ${intent} (depth: ${depth}) for: "${question.substring(0, 60)}..."`);

  // Step 2: Retrieve MORE chunks for detailed questions, fewer for simple ones
  const topK = depth === 'deep' ? 10 : depth === 'concise' ? 3 : 7;
  const relevantChunks = await searchSimilarChunks(question, userId, documentId, topK);

  if (relevantChunks.length === 0) {
    return {
      answer: "I couldn't find relevant information in the uploaded document for your question. Try rephrasing or ask about a topic that's covered in the document.",
      citations: [],
      confidence: 0
    };
  }

  // Step 3: Fetch full chunk text from SQLite
  const chunkIds = relevantChunks.map(c => c.chunkId);
  const placeholders = chunkIds.map(() => '?').join(',');
  const chunks = db.prepare(
    `SELECT id, content, page_number, chunk_index FROM document_chunks WHERE id IN (${placeholders})`
  ).all(...chunkIds);

  if (chunks.length === 0) {
    return {
      answer: "The document data could not be retrieved. Please try re-uploading the document.",
      citations: [],
      confidence: 0
    };
  }

  // Step 4: Also fetch NEIGHBORING chunks for deeper context on detailed questions
  let extraContext = '';
  if (depth === 'deep' || depth === 'practical' || depth === 'structured') {
    const chunkIndices = chunks.map(c => c.chunk_index);
    const neighborPlaceholders = [];
    const neighborParams = [documentId];

    for (const idx of chunkIndices) {
      neighborPlaceholders.push('?', '?');
      neighborParams.push(idx - 1, idx + 1);
    }

    if (neighborPlaceholders.length > 0) {
      const neighbors = db.prepare(`
        SELECT content, page_number, chunk_index FROM document_chunks
        WHERE document_id = ? AND chunk_index IN (${neighborPlaceholders.join(',')})
        AND id NOT IN (${placeholders})
        ORDER BY chunk_index
      `).all(...neighborParams, ...chunkIds);

      if (neighbors.length > 0) {
        extraContext = '\n\n--- ADDITIONAL CONTEXT ---\n\n' +
          neighbors.map(n => `[Page ${n.page_number || '?'}]: ${n.content}`).join('\n\n');
      }
    }
  }

  // Step 5: Build context block with source labels
  const contextBlock = chunks.map((chunk, i) => {
    const pageRef = chunk.page_number ? `Page ${chunk.page_number}` : `Section ${chunk.chunk_index + 1}`;
    return `[SOURCE ${i + 1} — ${pageRef}]\n${chunk.content}`;
  }).join('\n\n---\n\n');

  // Step 6: Build prompts with intent-specific instructions
  const systemPrompt = `You are Quorix AI, a highly knowledgeable academic tutor. A student has uploaded a document and is asking you a question about it.

YOUR RESPONSE STYLE:
${DEPTH_INSTRUCTIONS[depth]}

CITATION RULES (MANDATORY):
1. Answer ONLY from the document context provided. Never use outside knowledge.
2. Every factual claim MUST include a citation: [SOURCE N, Page X]
3. If multiple sources support a point, cite all: [SOURCE 1, Page 3] [SOURCE 2, Page 5]
4. If the document doesn't fully cover the topic, say so honestly and cite what IS available.
5. Never fabricate page numbers, quotes, or information not in the sources.

FORMAT:
- Use clear headings (##) for major sections when giving detailed explanations
- Use bullet points for lists and key facts
- Bold key terms on first mention
- End every response with a "References" section listing each source you used`;

  const userPrompt = `DOCUMENT CONTEXT:
${contextBlock}${extraContext}

STUDENT QUESTION: ${question}

Remember: ${depth === 'deep' ? 'The student wants a DETAILED, THOROUGH explanation. Be comprehensive.' :
              depth === 'concise' ? 'Keep it brief and to the point.' :
              'Answer the question accurately and helpfully.'}`;

  // Step 7: Call AI
  const result = await generateCompletion(systemPrompt, userPrompt);
  const answerText = result.text || '';

  // Step 8: Parse citations
  const citations = parseCitations(answerText, chunks);

  // Step 9: Confidence score
  const avgScore = relevantChunks.reduce((s, c) => s + c.score, 0) / relevantChunks.length;
  const confidence = Math.min(99, Math.round(avgScore * 100));

  logger.info(`RAG complete: intent=${intent}, chunks=${chunks.length}, citations=${citations.length}, confidence=${confidence}%, provider=${result.provider}`);

  return { answer: answerText, citations, confidence };
};

// ═══════════════════════════════════════════════════════
//  CITATION PARSER
// ═══════════════════════════════════════════════════════
const parseCitations = (answerText, chunks) => {
  if (!answerText || typeof answerText !== 'string') return [];

  const citations = [];
  const sourceRegex = /\[SOURCE (\d+)(?:,?\s*Page (\d+))?\]/g;
  let match;

  while ((match = sourceRegex.exec(answerText)) !== null) {
    const sourceNum = parseInt(match[1]) - 1;
    const pageNum = match[2] ? parseInt(match[2]) : null;
    if (chunks[sourceNum]) {
      citations.push({
        sourceIndex: sourceNum + 1,
        chunkId: chunks[sourceNum].id,
        pageNumber: pageNum || chunks[sourceNum].page_number,
        excerpt: chunks[sourceNum].content.slice(0, 200),
        inlineRef: match[0]
      });
    }
  }

  return [...new Map(citations.map(c => [c.chunkId, c])).values()];
};

module.exports = { answerFromDocument };
