/** @module attentionRoutes — Definitive routes for managing attention-tracking sessions and telemetry logs */

/**
 * Mounts attention tracking routes onto the Express app.
 * @param {object} app - Express app
 * @param {object} db - better-sqlite3 instance
 * @param {Function} authenticateToken - Auth middleware
 */
function mountAttentionRoutes(app, db, authenticateToken) {

    // Start a new attention tracking session
    app.post('/api/attention/session/start', authenticateToken, (req, res) => {
        try {
            const startTime = new Date().toISOString();
            const stmt = db.prepare(`
                INSERT INTO focus_sessions (user_email, start_time, status)
                VALUES (?, ?, 'active')
            `);
            const result = stmt.run(req.user.email, startTime);
            res.status(201).json({
                success: true,
                sessionId: result.lastInsertRowid,
                startTime,
                message: 'Attention session successfully started.'
            });
        } catch (err) {
            console.error('[Attention] Error starting session:', err);
            res.status(500).json({ error: 'Failed to start attention session.' });
        }
    });

    // End an active attention tracking session and save summary statistics
    app.post('/api/attention/session/end', authenticateToken, (req, res) => {
        const {
            sessionId,
            durationSeconds = 0,
            avgAttentiveness = 100.0,
            drowsyCount = 0,
            distractionCount = 0,
            phoneCount = 0,
            absenceCount = 0
        } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required to end a session.' });
        }

        try {
            const endTime = new Date().toISOString();
            
            // Verify session belongs to the user
            const session = db.prepare('SELECT id FROM focus_sessions WHERE id = ? AND user_email = ?')
                .get(sessionId, req.user.email);
            
            if (!session) {
                return res.status(403).json({ error: 'Unauthorized or invalid session.' });
            }

            const stmt = db.prepare(`
                UPDATE focus_sessions 
                SET end_time = ?, duration_seconds = ?, avg_attentiveness = ?, 
                    drowsy_count = ?, distraction_count = ?, phone_count = ?, 
                    absence_count = ?, status = 'completed'
                WHERE id = ?
            `);
            stmt.run(endTime, durationSeconds, avgAttentiveness, drowsyCount, distractionCount, phoneCount, absenceCount, sessionId);

            // Log activity to user learning activities
            const activityStmt = db.prepare('INSERT INTO activity (user_email, type, text) VALUES (?, ?, ?)');
            const durationMins = Math.round(durationSeconds / 60) || 1;
            activityStmt.run(
                req.user.email,
                'attention_session',
                `Completed an AI Focus Session of ${durationMins} mins with ${Math.round(avgAttentiveness)}% attentiveness.`
            );

            // Give user some learning XP!
            const xpEarned = Math.min(50, Math.round((durationSeconds / 60) * 2)); // 2 XP per minute up to 50 XP
            if (xpEarned > 0) {
                db.prepare('UPDATE users SET xp = xp + ?, last_active = CURRENT_TIMESTAMP WHERE email = ?')
                    .run(xpEarned, req.user.email);
            }

            res.json({
                success: true,
                endTime,
                xpEarned,
                message: 'Attention session logged successfully.'
            });
        } catch (err) {
            console.error('[Attention] Error ending session:', err);
            res.status(500).json({ error: 'Failed to log attention session.' });
        }
    });

    // Record an attention event/violation in the focus session audit logs
    app.post('/api/attention/session/event', authenticateToken, (req, res) => {
        const { sessionId, eventType, details = '' } = req.body;

        if (!sessionId || !eventType) {
            return res.status(400).json({ error: 'sessionId and eventType are required.' });
        }

        try {
            // Verify session belongs to the user
            const session = db.prepare('SELECT id FROM focus_sessions WHERE id = ? AND user_email = ?')
                .get(sessionId, req.user.email);
            
            if (!session) {
                return res.status(403).json({ error: 'Unauthorized or invalid session.' });
            }

            const timestamp = new Date().toISOString();
            const stmt = db.prepare(`
                INSERT INTO focus_logs (session_id, event_type, details, timestamp)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(sessionId, eventType, details, timestamp);

            // Increment specific session counters in real-time
            let counterColumn = null;
            if (eventType === 'drowsy') counterColumn = 'drowsy_count';
            else if (eventType === 'distraction') counterColumn = 'distraction_count';
            else if (eventType === 'phone_usage') counterColumn = 'phone_count';
            else if (eventType === 'absent') counterColumn = 'absence_count';

            if (counterColumn) {
                db.prepare(`UPDATE focus_sessions SET ${counterColumn} = ${counterColumn} + 1 WHERE id = ?`)
                    .run(sessionId);
            }

            res.status(201).json({ success: true, timestamp });
        } catch (err) {
            console.error('[Attention] Error logging event:', err);
            res.status(500).json({ error: 'Failed to record attention event.' });
        }
    });

    // List recent focus sessions for the tutor
    app.get('/api/attention/sessions', authenticateToken, (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        try {
            const sessions = db.prepare(`
                SELECT * FROM focus_sessions 
                WHERE user_email = ? AND status = 'completed'
                ORDER BY created_at DESC 
                LIMIT ?
            `).all(req.user.email, limit);
            res.json({ success: true, sessions });
        } catch (err) {
            console.error('[Attention] Error listing sessions:', err);
            res.status(500).json({ error: 'Failed to retrieve focus history.' });
        }
    });

    // Retrieve details & event logs for a specific session
    app.get('/api/attention/session/:id', authenticateToken, (req, res) => {
        const sessionId = req.params.id;
        try {
            const session = db.prepare('SELECT * FROM focus_sessions WHERE id = ? AND user_email = ?')
                .get(sessionId, req.user.email);
            
            if (!session) {
                return res.status(404).json({ error: 'Session not found or unauthorized.' });
            }

            const logs = db.prepare('SELECT * FROM focus_logs WHERE session_id = ? ORDER BY timestamp ASC')
                .all(sessionId);

            res.json({ success: true, session, logs });
        } catch (err) {
            console.error('[Attention] Error getting session details:', err);
            res.status(500).json({ error: 'Failed to retrieve session details.' });
        }
    });

    // Aggregate attention analytics
    app.get('/api/attention/analytics', authenticateToken, (req, res) => {
        try {
            // Overall aggregates
            const aggregates = db.prepare(`
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(duration_seconds) as total_duration_seconds,
                    AVG(avg_attentiveness) as overall_attentiveness,
                    SUM(drowsy_count) as total_drowsy,
                    SUM(distraction_count) as total_distraction,
                    SUM(phone_count) as total_phone,
                    SUM(absence_count) as total_absence
                FROM focus_sessions
                WHERE user_email = ? AND status = 'completed'
            `).get(req.user.email);

            // Attentiveness progression over the last 10 sessions
            const trend = db.prepare(`
                SELECT id, created_at, avg_attentiveness, duration_seconds 
                FROM focus_sessions
                WHERE user_email = ? AND status = 'completed'
                ORDER BY created_at ASC
                LIMIT 10
            `).all(req.user.email);

            // Daily hours compiled for the heatmap/chart
            const dailyStats = db.prepare(`
                SELECT 
                    strftime('%Y-%m-%d', created_at) as date,
                    SUM(duration_seconds) as duration,
                    AVG(avg_attentiveness) as attentiveness
                FROM focus_sessions
                WHERE user_email = ? AND status = 'completed' AND created_at >= date('now', '-30 days')
                GROUP BY date
                ORDER BY date ASC
            `).all(req.user.email);

            res.json({
                success: true,
                data: {
                    aggregates: {
                        totalSessions: aggregates?.total_sessions || 0,
                        totalDurationHours: ((aggregates?.total_duration_seconds || 0) / 3600).toFixed(2),
                        overallAttentiveness: Math.round(aggregates?.overall_attentiveness || 100),
                        violations: {
                            drowsy: aggregates?.total_drowsy || 0,
                            distraction: aggregates?.total_distraction || 0,
                            phone: aggregates?.total_phone || 0,
                            absence: aggregates?.total_absence || 0
                        }
                    },
                    trend,
                    dailyStats
                }
            });
        } catch (err) {
            console.error('[Attention] Error calculating analytics:', err);
            res.status(500).json({ error: 'Failed to compile attention analytics.' });
        }
    });
}

module.exports = { mountAttentionRoutes };
