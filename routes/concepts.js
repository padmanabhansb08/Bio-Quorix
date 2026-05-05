/** @module concepts — Knowledge graph concept linking and mastery tracking */

/**
 * Mounts concept/knowledge-graph routes onto the Express app.
 * @param {object} app - Express app
 * @param {object} db - better-sqlite3 instance
 * @param {Function} authenticateToken - Auth middleware
 * @param {object} aiService - AI service
 */
function mountConceptRoutes(app, db, authenticateToken, aiService) {

    // Get all concepts for the knowledge graph
    app.get('/api/concepts', authenticateToken, (req, res) => {
        const concepts = db.prepare('SELECT * FROM concepts ORDER BY name').all();
        const links = db.prepare('SELECT * FROM concept_links').all();

        // Get user mastery data
        const mastery = db.prepare(
            'SELECT * FROM user_concept_mastery WHERE user_email = ?'
        ).all(req.user.email);

        const masteryMap = {};
        mastery.forEach(m => { masteryMap[m.concept_id] = m; });

        const nodes = concepts.map(c => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            description: c.description,
            mastery: masteryMap[c.id]?.mastery_percent || 0,
            xp: masteryMap[c.id]?.xp_earned || 0,
            lastReviewed: masteryMap[c.id]?.last_reviewed || null
        }));

        const edges = links.map(l => ({ from: l.from_id, to: l.to_id }));

        // Count cards due per concept
        const dueCards = db.prepare(`
            SELECT topic_id, COUNT(*) as count FROM flashcards
            WHERE user_email = ? AND (next_review_date IS NULL OR next_review_date <= ?)
            GROUP BY topic_id
        `).all(req.user.email, Date.now());

        const dueMap = {};
        dueCards.forEach(d => { dueMap[d.topic_id] = d.count; });

        res.json({ nodes, edges, dueCards: dueMap });
    });

    // Link concepts after a lesson (called by frontend after lesson completion)
    app.post('/api/concepts/link', authenticateToken, async (req, res) => {
        const { conceptName, subject, lessonContent } = req.body;

        if (!conceptName || !subject) {
            return res.status(400).json({ error: 'conceptName and subject are required' });
        }

        // Ensure concept exists
        let concept = db.prepare('SELECT * FROM concepts WHERE name = ? AND subject = ?').get(conceptName, subject);
        if (!concept) {
            db.prepare('INSERT INTO concepts (name, subject, description) VALUES (?, ?, ?)').run(
                conceptName, subject, `Core concept in ${subject}`
            );
            concept = db.prepare('SELECT * FROM concepts WHERE name = ? AND subject = ?').get(conceptName, subject);
        }

        // Ask AI for prerequisite concepts
        try {
            const result = await aiService.generateCompletion(
                'Return ONLY a JSON array of prerequisite concept names for the given topic. Example: ["Algebra", "Trigonometry"]. No other text. Maximum 5 prerequisites.',
                `What are the prerequisite concepts a student should know before studying "${conceptName}" in ${subject}?`
            );

            const jsonMatch = result.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const prereqs = JSON.parse(jsonMatch[0]);

                for (const prereqName of prereqs.slice(0, 5)) {
                    // Ensure prereq concept exists
                    let prereq = db.prepare('SELECT * FROM concepts WHERE name = ? AND subject = ?').get(prereqName, subject);
                    if (!prereq) {
                        db.prepare('INSERT INTO concepts (name, subject, description) VALUES (?, ?, ?)').run(
                            prereqName, subject, `Prerequisite for ${conceptName}`
                        );
                        prereq = db.prepare('SELECT * FROM concepts WHERE name = ? AND subject = ?').get(prereqName, subject);
                    }

                    // Create link if it doesn't exist
                    const existingLink = db.prepare(
                        'SELECT id FROM concept_links WHERE from_id = ? AND to_id = ?'
                    ).get(prereq.id, concept.id);

                    if (!existingLink) {
                        db.prepare('INSERT INTO concept_links (from_id, to_id) VALUES (?, ?)').run(prereq.id, concept.id);
                    }
                }
            }
        } catch (err) {
            console.error('[Concepts] Failed to generate links:', err.message);
        }

        // Update user mastery
        const existingMastery = db.prepare(
            'SELECT * FROM user_concept_mastery WHERE user_email = ? AND concept_id = ?'
        ).get(req.user.email, concept.id);

        if (existingMastery) {
            db.prepare(
                'UPDATE user_concept_mastery SET mastery_percent = MIN(mastery_percent + 10, 100), xp_earned = xp_earned + 10, last_reviewed = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(existingMastery.id);
        } else {
            db.prepare(
                'INSERT INTO user_concept_mastery (user_email, concept_id, mastery_percent, xp_earned, last_reviewed) VALUES (?, ?, 10, 10, CURRENT_TIMESTAMP)'
            ).run(req.user.email, concept.id);
        }

        res.json({ message: 'Concept linked and mastery updated', conceptId: concept.id });
    });
}

module.exports = { mountConceptRoutes };
