/** @module practiceTests — AI-powered practice test generation and grading routes */
const express = require('express');
const router = express.Router();

/**
 * Mounts practice test routes onto the Express app.
 * @param {object} app - Express app instance
 * @param {object} db - better-sqlite3 database instance
 * @param {Function} authenticateToken - Auth middleware
 * @param {object} aiService - AI service with generateCompletion()
 */
function mountPracticeTestRoutes(app, db, authenticateToken, aiService) {

    // Generate a practice test
    app.post('/api/practice-tests/generate', authenticateToken, async (req, res) => {
        const { subject, topic, difficulty, count = 10 } = req.body;

        if (!subject || !topic || !difficulty) {
            return res.status(400).json({ error: 'subject, topic, and difficulty are required' });
        }

        const systemPrompt = `Generate a practice test in valid JSON only. No preamble. No markdown.
Schema: { "questions": [{ "id": string, "type": "mcq"|"tf"|"short", "question": string, "options": string[]|null, "correct_answer": string, "explanation": string }] }
Subject: ${subject}. Topic: ${topic}. Difficulty: ${difficulty}. Count: ${count}.
Ensure questions progressively increase in difficulty within the set.
Mix question types: approximately 60% MCQ, 20% True/False, 20% Short Answer.`;

        try {
            const result = await aiService.generateCompletion(systemPrompt, `Generate ${count} ${difficulty} questions about ${topic} in ${subject}.`);

            // Parse the JSON from the AI response
            let questions;
            try {
                // Try to extract JSON from the response (in case AI wraps it in markdown)
                const jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('No JSON found in response');
                questions = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
                console.error('[PracticeTest] Failed to parse AI response:', parseErr.message);
                return res.status(500).json({ error: 'Failed to generate valid test. Please try again.' });
            }

            // Store the test
            const testInsert = db.prepare(`
                INSERT INTO practice_tests (user_email, subject, topic, difficulty, question_count)
                VALUES (?, ?, ?, ?, ?)
            `);
            const testResult = testInsert.run(req.user.email, subject, topic, difficulty, count);
            const testId = testResult.lastInsertRowid;

            res.json({
                testId,
                questions: questions.questions || questions,
                provider: result.provider
            });
        } catch (err) {
            console.error('[PracticeTest] Generation error:', err);
            res.status(500).json({ error: 'Failed to generate practice test' });
        }
    });

    // Submit and grade a practice test
    app.post('/api/practice-tests/:testId/submit', authenticateToken, async (req, res) => {
        const { testId } = req.params;
        const { answers } = req.body; // Array of { questionId, userAnswer, question, correctAnswer, type }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers array is required' });
        }

        const test = db.prepare('SELECT * FROM practice_tests WHERE id = ? AND user_email = ?')
            .get(testId, req.user.email);

        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }

        let correctCount = 0;
        const results = [];
        const insertResult = db.prepare(`
            INSERT INTO practice_test_results (test_id, question_id, question_type, question, user_answer, correct_answer, is_correct, explanation, ai_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Grade MCQ and T/F automatically
        for (const answer of answers) {
            let isCorrect = 0;
            let aiScore = null;

            if (answer.type === 'mcq' || answer.type === 'tf') {
                isCorrect = answer.userAnswer?.toLowerCase().trim() === answer.correctAnswer?.toLowerCase().trim() ? 1 : 0;
            } else if (answer.type === 'short') {
                // Use AI to grade short answers
                try {
                    const gradeResult = await aiService.generateCompletion(
                        'You are a strict academic grader. Return ONLY a JSON object: {"score": <0-5>, "feedback": "<one sentence>"}. No other text.',
                        `Question: ${answer.question}\nCorrect Answer: ${answer.correctAnswer}\nStudent Answer: ${answer.userAnswer}\nGrade the student's answer 0-5.`
                    );
                    const gradeMatch = gradeResult.text.match(/\{[\s\S]*\}/);
                    if (gradeMatch) {
                        const grade = JSON.parse(gradeMatch[0]);
                        aiScore = grade.score;
                        isCorrect = grade.score >= 3 ? 1 : 0;
                        answer.feedback = grade.feedback;
                    }
                } catch {
                    // Fallback: simple string similarity
                    isCorrect = answer.userAnswer?.toLowerCase().includes(answer.correctAnswer?.toLowerCase().substring(0, 20)) ? 1 : 0;
                }
            }

            if (isCorrect) correctCount++;

            insertResult.run(
                testId,
                answer.questionId,
                answer.type,
                answer.question,
                answer.userAnswer,
                answer.correctAnswer,
                isCorrect,
                answer.explanation || answer.feedback || null,
                aiScore
            );

            results.push({ ...answer, isCorrect: !!isCorrect, aiScore });
        }

        // Update test score
        const score = Math.round((correctCount / answers.length) * 100);
        db.prepare('UPDATE practice_tests SET score = ? WHERE id = ?').run(score, testId);

        // Push wrong answers into flashcard queue
        const wrongAnswers = results.filter(r => !r.isCorrect);
        if (wrongAnswers.length > 0) {
            const user = db.prepare('SELECT id FROM users WHERE email = ?').get(req.user.email);
            const insertFlashcard = db.prepare(`
                INSERT INTO flashcards (user_email, user_id, topic_id, subject, topic, difficulty, front, back, question, answer, interval, repetition, efactor, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 2.5, ?, CURRENT_TIMESTAMP)
            `);

            for (const wrong of wrongAnswers) {
                insertFlashcard.run(
                    req.user.email,
                    user?.id || null,
                    `practice-test-${testId}`,
                    test.subject,
                    test.topic,
                    test.difficulty,
                    wrong.question,
                    wrong.correctAnswer,
                    wrong.question,
                    wrong.correctAnswer,
                    Date.now()
                );
            }
        }

        res.json({
            testId,
            score,
            total: answers.length,
            correct: correctCount,
            wrong: answers.length - correctCount,
            results,
            flashcardsCreated: wrongAnswers.length
        });
    });

    // Get test history
    app.get('/api/practice-tests/history', authenticateToken, (req, res) => {
        const tests = db.prepare(
            'SELECT * FROM practice_tests WHERE user_email = ? ORDER BY created_at DESC LIMIT 50'
        ).all(req.user.email);
        res.json({ data: tests });
    });
}

module.exports = { mountPracticeTestRoutes };
