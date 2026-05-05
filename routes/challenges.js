/** @module challenges — Daily challenge generation, attempts, and leaderboard */

/**
 * Mounts daily challenge routes onto the Express app.
 * @param {object} app - Express app
 * @param {object} db - better-sqlite3 instance
 * @param {Function} authenticateToken - Auth middleware
 * @param {object} aiService - AI service
 * @param {object} cron - node-cron instance
 */
function mountChallengeRoutes(app, db, authenticateToken, aiService, cron) {

    const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Economics', 'Computer Science', 'Literature'];

    // Generate daily challenges at midnight UTC
    async function generateDailyChallenges() {
        const today = new Date().toISOString().split('T')[0];

        // Check if already generated for today
        const existing = db.prepare('SELECT COUNT(*) as count FROM daily_challenges WHERE date = ?').get(today);
        if (existing.count > 0) {
            console.log('[Challenges] Already generated for today');
            return;
        }

        console.log('[Challenges] Generating daily challenges...');

        for (const subject of SUBJECTS) {
            try {
                const result = await aiService.generateCompletion(
                    'Generate exactly 1 multiple-choice challenge question. Return ONLY valid JSON: {"question": string, "options": ["A","B","C","D"], "correct_answer": "A"|"B"|"C"|"D", "explanation": string}. No other text.',
                    `Create a challenging but fair ${subject} question suitable for advanced students.`
                );

                const jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const q = JSON.parse(jsonMatch[0]);
                    db.prepare(
                        'INSERT INTO daily_challenges (subject, question, options, correct_answer, explanation, date) VALUES (?, ?, ?, ?, ?, ?)'
                    ).run(subject, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation, today);
                }
            } catch (err) {
                console.error(`[Challenges] Failed to generate for ${subject}:`, err.message);
            }
        }

        console.log('[Challenges] Daily challenges generated.');
    }

    // Schedule: midnight UTC daily
    cron.schedule('0 0 * * *', generateDailyChallenges);

    // Get today's challenges
    app.get('/api/challenges/today', authenticateToken, (req, res) => {
        const today = new Date().toISOString().split('T')[0];
        const challenges = db.prepare('SELECT id, subject, question, options, date FROM daily_challenges WHERE date = ?').all(today);

        // Check which ones the user already attempted
        const attempted = db.prepare(
            'SELECT challenge_id FROM daily_challenge_attempts WHERE user_email = ? AND challenge_id IN (' +
            challenges.map(() => '?').join(',') + ')'
        ).all(req.user.email, ...challenges.map(c => c.id));

        const attemptedIds = new Set(attempted.map(a => a.challenge_id));

        const result = challenges.map(c => ({
            ...c,
            options: JSON.parse(c.options || '[]'),
            attempted: attemptedIds.has(c.id)
        }));

        // Countdown to next midnight UTC
        const now = new Date();
        const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const secondsRemaining = Math.floor((nextMidnight - now) / 1000);

        res.json({ data: result, nextChallengeIn: secondsRemaining });
    });

    // Submit a challenge attempt
    app.post('/api/challenges/:challengeId/attempt', authenticateToken, (req, res) => {
        const { challengeId } = req.params;
        const { answer } = req.body;

        if (!answer) return res.status(400).json({ error: 'answer is required' });

        const challenge = db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(challengeId);
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

        // Check if already attempted
        const existing = db.prepare(
            'SELECT id FROM daily_challenge_attempts WHERE user_email = ? AND challenge_id = ?'
        ).get(req.user.email, challengeId);

        if (existing) return res.status(409).json({ error: 'Already attempted this challenge' });

        const isCorrect = answer.toUpperCase().trim() === challenge.correct_answer.toUpperCase().trim() ? 1 : 0;

        // Calculate XP: 50 base + streak bonus
        let xpEarned = 0;
        if (isCorrect) {
            const user = db.prepare('SELECT streak FROM users WHERE email = ?').get(req.user.email);
            const streakBonus = Math.min((user?.streak || 0) * 5, 50); // Max 50 bonus
            xpEarned = 50 + streakBonus;

            // Add XP to user
            db.prepare('UPDATE users SET xp = xp + ? WHERE email = ?').run(xpEarned, req.user.email);
        }

        db.prepare(
            'INSERT INTO daily_challenge_attempts (user_email, challenge_id, user_answer, is_correct, xp_earned) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user.email, challengeId, answer, isCorrect, xpEarned);

        res.json({
            correct: !!isCorrect,
            correctAnswer: challenge.correct_answer,
            explanation: challenge.explanation,
            xpEarned
        });
    });

    // Weekly challenge leaderboard (privacy-safe)
    app.get('/api/challenges/leaderboard', authenticateToken, (req, res) => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const leaders = db.prepare(`
            SELECT 
                u.display_name,
                COUNT(CASE WHEN dca.is_correct = 1 THEN 1 END) as correct_count,
                SUM(dca.xp_earned) as total_xp
            FROM daily_challenge_attempts dca
            JOIN users u ON u.email = dca.user_email
            WHERE u.leaderboard_visible = 1 AND dca.attempted_at >= ?
            GROUP BY dca.user_email
            ORDER BY correct_count DESC, total_xp DESC
            LIMIT 20
        `).all(weekAgo);

        // Assign opaque rank tokens instead of exposing user IDs
        const ranked = leaders.map((l, i) => ({
            rank: i + 1,
            displayName: l.display_name || `Scholar #${i + 1}`,
            correctCount: l.correct_count,
            totalXp: l.total_xp
        }));

        res.json({ data: ranked });
    });

    // Trigger generation manually (for first run)
    app.post('/api/challenges/generate', authenticateToken, async (req, res) => {
        try {
            await generateDailyChallenges();
            res.json({ message: 'Daily challenges generated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { mountChallengeRoutes };
