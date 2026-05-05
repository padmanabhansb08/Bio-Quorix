/** @module analyticsRoutes — Transparent, clearly-defined analytics endpoints */

/**
 * Mounts analytics routes onto the Express app.
 * @param {object} app - Express app
 * @param {object} db - better-sqlite3 instance
 * @param {Function} authenticateToken - Auth middleware
 */
function mountAnalyticsRoutes(app, db, authenticateToken) {

    // Daily cards reviewed today
    app.get('/api/analytics/daily-cards', authenticateToken, (req, res) => {
        const today = new Date().toISOString().split('T')[0];
        const result = db.prepare(
            "SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND created_at LIKE ?"
        ).get(req.user.email, `${today}%`);
        res.json({ data: result?.count || 0, definition: 'Count of flashcard reviews completed today' });
    });

    // Retention rate: % of cards answered correctly in last 30 days
    app.get('/api/analytics/retention', authenticateToken, (req, res) => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const total = db.prepare(
            'SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND created_at >= ?'
        ).get(req.user.email, thirtyDaysAgo);
        const mastered = db.prepare(
            'SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND created_at >= ? AND repetition >= 3'
        ).get(req.user.email, thirtyDaysAgo);

        const rate = total?.count > 0 ? Math.round((mastered?.count / total?.count) * 100) : 0;
        res.json({ data: rate, definition: 'Percentage of cards with 3+ successful repetitions in the last 30 days' });
    });

    // Study streak
    app.get('/api/analytics/streak', authenticateToken, (req, res) => {
        const user = db.prepare('SELECT streak, streak_freezes FROM users WHERE email = ?').get(req.user.email);
        res.json({
            data: { currentStreak: user?.streak || 0, freezesOwned: user?.streak_freezes || 0 },
            definition: 'Consecutive days with ≥5 card reviews or ≥1 lesson completed'
        });
    });

    // XP breakdown by subject and week
    app.get('/api/analytics/xp-breakdown', authenticateToken, (req, res) => {
        const bySubject = db.prepare(`
            SELECT subject, SUM(score) as total_xp, COUNT(*) as quiz_count
            FROM quiz_history WHERE user_email = ?
            GROUP BY subject ORDER BY total_xp DESC
        `).all(req.user.email);

        const byWeek = db.prepare(`
            SELECT strftime('%Y-W%W', created_at) as week, SUM(score) as total_xp
            FROM quiz_history WHERE user_email = ? AND created_at IS NOT NULL
            GROUP BY week ORDER BY week DESC LIMIT 12
        `).all(req.user.email);

        res.json({
            data: { bySubject, byWeek },
            definition: 'XP earned from quizzes, grouped by subject and by ISO week'
        });
    });

    // Mastery per subject: % of cards with interval > 21 days
    app.get('/api/analytics/mastery', authenticateToken, (req, res) => {
        const subjects = db.prepare(`
            SELECT subject,
                COUNT(*) as total_cards,
                COUNT(CASE WHEN interval > 21 THEN 1 END) as mastered_cards
            FROM flashcards WHERE user_email = ?
            GROUP BY subject
        `).all(req.user.email);

        const mastery = subjects.map(s => ({
            subject: s.subject,
            totalCards: s.total_cards,
            masteredCards: s.mastered_cards,
            masteryPercent: s.total_cards > 0 ? Math.round((s.mastered_cards / s.total_cards) * 100) : 0
        }));

        res.json({ data: mastery, definition: 'Percentage of flashcards with review interval exceeding 21 days per subject' });
    });

    // Lessons completed
    app.get('/api/analytics/lessons', authenticateToken, (req, res) => {
        const total = db.prepare(
            "SELECT COUNT(*) as count FROM activity WHERE user_email = ? AND type = 'lesson'"
        ).get(req.user.email);

        const bySubject = db.prepare(`
            SELECT text, COUNT(*) as count FROM activity
            WHERE user_email = ? AND type = 'lesson'
            GROUP BY text ORDER BY count DESC LIMIT 20
        `).all(req.user.email);

        res.json({
            data: { total: total?.count || 0, bySubject },
            definition: 'Total lesson completions and breakdown by topic'
        });
    });

    // Privacy-safe leaderboard
    app.get('/api/analytics/leaderboard', authenticateToken, (req, res) => {
        const { scope = 'global', period = 'week' } = req.query;

        let dateFilter = '';
        if (period === 'week') {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            dateFilter = `AND u.last_active >= '${weekAgo}'`;
        }

        const leaders = db.prepare(`
            SELECT u.display_name, u.xp, u.streak, u.level
            FROM users u
            WHERE u.leaderboard_visible = 1 ${dateFilter}
            ORDER BY u.xp DESC
            LIMIT 25
        `).all();

        const ranked = leaders.map((l, i) => ({
            rank: i + 1,
            displayName: l.display_name || `Scholar #${i + 1}`,
            xp: l.xp,
            streak: l.streak,
            level: l.level
        }));

        // Find current user's rank
        const me = db.prepare('SELECT xp, leaderboard_visible FROM users WHERE email = ?').get(req.user.email);
        let myRank = null;
        if (me?.leaderboard_visible) {
            const above = db.prepare('SELECT COUNT(*) as count FROM users WHERE xp > ? AND leaderboard_visible = 1').get(me.xp);
            myRank = (above?.count || 0) + 1;
        }

        res.json({ data: ranked, myRank });
    });

    // Update leaderboard visibility settings
    app.post('/api/analytics/leaderboard/settings', authenticateToken, (req, res) => {
        const { visible, displayName, scope } = req.body;

        const updates = [];
        const params = [];

        if (typeof visible === 'boolean') { updates.push('leaderboard_visible = ?'); params.push(visible ? 1 : 0); }
        if (displayName) { updates.push('display_name = ?'); params.push(displayName); }
        if (scope) { updates.push('leaderboard_scope = ?'); params.push(scope); }

        if (updates.length === 0) return res.status(400).json({ error: 'No settings to update' });

        params.push(req.user.email);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`).run(...params);

        res.json({ message: 'Leaderboard settings updated' });
    });

    // 7-day streak heatmap
    app.get('/api/analytics/streak-heatmap', authenticateToken, (req, res) => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];

            const cardCount = db.prepare(
                "SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND created_at LIKE ?"
            ).get(req.user.email, `${dateStr}%`);

            const lessonCount = db.prepare(
                "SELECT COUNT(*) as count FROM activity WHERE user_email = ? AND type = 'lesson' AND date LIKE ?"
            ).get(req.user.email, `${dateStr}%`);

            const active = (cardCount?.count >= 5) || (lessonCount?.count >= 1);

            days.push({
                date: dateStr,
                dayName: date.toLocaleDateString('en', { weekday: 'short' }),
                cards: cardCount?.count || 0,
                lessons: lessonCount?.count || 0,
                active
            });
        }

        res.json({ data: days });
    });
}

module.exports = { mountAnalyticsRoutes };
