/** @module docAutoGenerateService — Auto-generates flashcards, lessons, and tests from documents */
const { generateCompletion } = require('./aiService.js');

/**
 * IMPORTANT: generateCompletion(systemPrompt, userPrompt) takes TWO strings
 * and returns { text: string, provider: string }.
 */

// Auto-generate flashcards from document chunks
const generateFlashcardsFromDocument = async (documentId, db, count = 10) => {
  const chunks = db.prepare(
    `SELECT content, page_number FROM document_chunks WHERE document_id = ? ORDER BY RANDOM() LIMIT 15`
  ).all(documentId);

  const contextText = chunks.map((c, i) =>
    `[Page ${c.page_number || i+1}]: ${c.content}`
  ).join('\n\n');

  const systemPrompt = `You are an expert academic flashcard generator. Generate exactly ${count} high-quality flashcards from the provided content. Respond ONLY with valid JSON, no preamble or markdown fencing.
Schema: { "flashcards": [{ "front": string, "back": string, "page": number|null, "difficulty": "easy"|"medium"|"hard" }] }`;

  const userPrompt = `Generate flashcards from this academic content:\n${contextText}`;

  const result = await generateCompletion(systemPrompt, userPrompt);

  try {
    const clean = result.text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean).flashcards;
  } catch {
    throw new Error('Failed to parse AI flashcard response');
  }
};

// Auto-generate a structured lesson plan from the document
const generateLessonPlanFromDocument = async (documentId, subject, db) => {
  const chunks = db.prepare(
    `SELECT content, page_number FROM document_chunks WHERE document_id = ? LIMIT 20`
  ).all(documentId);

  const fullContext = chunks.map(c => c.content).join('\n\n');

  const systemPrompt = `You are an expert curriculum designer. Create a structured lesson plan from academic document content. Respond ONLY with valid JSON, no preamble or markdown fencing.
Schema: {
  "title": string,
  "subject": string,
  "estimatedHours": number,
  "topics": [{ "title": string, "summary": string, "pageReference": number|null, "subtopics": string[], "keyTerms": string[] }],
  "learningObjectives": string[],
  "assessmentIdeas": string[]
}`;

  const userPrompt = `Subject: ${subject}\nDocument Content:\n${fullContext.slice(0, 4000)}`;

  const result = await generateCompletion(systemPrompt, userPrompt);
  const clean = result.text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// Summarize the entire document intelligently
const generateDocumentSummary = async (documentId, db) => {
  const doc = db.prepare(`SELECT filename, file_type, page_count FROM documents WHERE id = ?`).get(documentId);
  const chunks = db.prepare(
    `SELECT content, page_number FROM document_chunks WHERE document_id = ? ORDER BY chunk_index LIMIT 30`
  ).all(documentId);

  const context = chunks.map(c => c.content).join('\n\n');

  const systemPrompt = `You are an expert academic summarizer. Summarize the provided document content comprehensively for a student.`;

  const userPrompt = `Summarize this document:
Document: "${doc.filename}" (${doc.page_count || '?'} pages)

Include:
- What the document covers (2-3 sentences)
- Key topics list (bullet points)
- Important definitions or terms
- Main takeaways

Content:
${context.slice(0, 5000)}`;

  const result = await generateCompletion(systemPrompt, userPrompt);
  return result.text;
};

module.exports = {
  generateFlashcardsFromDocument,
  generateLessonPlanFromDocument,
  generateDocumentSummary
};
