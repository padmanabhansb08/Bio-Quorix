require('dotenv').config();
const { validateEnv } = require('./utils/validateEnv');
validateEnv(); // Must be FIRST — exits if env is invalid

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./database');
const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const webpush = require('web-push');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Phase 1 modules
const { runMigrations } = require('./db/migrate');
const { generateTokenPair, verifyAccessToken, isTokenNearExpiry, validateRefreshToken, revokeRefreshToken, storeRefreshToken, cleanupExpiredTokens } = require('./utils/tokenUtils');
const { sanitizePrompt, moderateResponse } = require('./middleware/promptGuard');
const { generateCompletion } = require('./services/aiService');
const { validate, signupSchema, loginSchema, updateUserSchema, activitySchema, quizRecordSchema, flashcardSyncSchema, aiGenerateSchema, pushSubscriptionSchema } = require('./utils/validators');
const { logger, morganStream } = require('./utils/logger');

// Run database migrations before anything else
runMigrations(db);

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789'); // dummy fallback

// Configure Web Push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:support@quorix.ai',
        vapidPublicKey,
        vapidPrivateKey
    );
} else {
    logger.warn('VAPID keys not configured. Web push notifications will not work.');
}

// --- Security & Logging Middleware ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            "img-src": ["'self'", "data:", "https:", "http:"],
            "connect-src": ["'self'", "https://api.groq.com", "https://api.resend.com"]
        }
    }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

app.use(morgan('combined', { stream: morganStream }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Automated Weekly Reports
cron.schedule('0 9 * * 0', async () => {
    console.log('Running weekly report cron job...');
    try {
        const users = db.prepare('SELECT * FROM users').all();
        for (const user of users) {
            if (!user.email) continue;
            
            const doc = new PDFDocument();
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            
            doc.fontSize(24).text('Weekly Learning Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text(`Hello ${user.name},`);
            doc.moveDown();
            doc.fontSize(14).text(`Current Level: ${user.level || 'Not set'}`);
            doc.text(`Total XP: ${user.xp || 0}`);
            doc.text(`Current Streak: ${user.streak || 0}`);
            doc.text(`Streak Freezes: ${user.streak_freezes || 0}`);
            
            const upcomingFlashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND next_review_date <= ?').get(user.email, Date.now() + 7*24*60*60*1000);
            doc.moveDown();
            doc.text(`You have ${upcomingFlashcards ? upcomingFlashcards.count : 0} flashcards due for review this week.`);
            
            doc.end();
            
            doc.on('end', async () => {
                const pdfData = Buffer.concat(buffers);
                try {
                    await resend.emails.send({
                        from: 'Quorix AI <onboarding@resend.dev>',
                        to: user.email,
                        subject: 'Your Weekly Learning Report',
                        html: '<p>Here is your weekly progress report from Quorix AI!</p>',
                        attachments: [{
                            filename: 'weekly_report.pdf',
                            content: pdfData
                        }]
                    });
                } catch (err) {
                    console.error(`Failed to send report to ${user.email}:`, err);
                }
            });
        }
    } catch (err) {
        console.error('Error in cron job:', err);
    }
});

// Push Notification Re-engagement Cron Job
cron.schedule('0 18 * * *', async () => {
    // Run daily at 6 PM
    console.log('Running daily push notification re-engagement...');
    try {
        const users = db.prepare('SELECT email, name FROM users').all();
        const now = Date.now();
        
        for (const user of users) {
            const dueFlashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards WHERE user_email = ? AND next_review_date <= ?').get(user.email, now);
            
            if (dueFlashcards && dueFlashcards.count > 0) {
                // Find all push subscriptions for this user
                const subscriptions = db.prepare('SELECT subscription FROM push_subscriptions WHERE user_email = ?').all(user.email);
                
                const payload = JSON.stringify({
                    title: 'Quorix AI',
                    body: `Your CRISPR flashcards are forgetting you! You have ${dueFlashcards.count} flashcards due for review.`,
                    icon: '/images/3d_brain_icon.png'
                });

                for (const sub of subscriptions) {
                    try {
                        const pushSubscription = JSON.parse(sub.subscription);
                        await webpush.sendNotification(pushSubscription, payload);
                    } catch (err) {
                        console.error('Error sending push notification to', user.email, err);
                        // Optional: delete invalid subscriptions (err.statusCode === 410 or 404)
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            db.prepare('DELETE FROM push_subscriptions WHERE subscription = ?').run(sub.subscription);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error in push notification cron job:', err);
    }
});

// Serve static frontend files.
app.use(express.static(path.join(__dirname, 'frontend', 'frontend')));

// Middleware for auth — enhanced with auto-refresh detection
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = verifyAccessToken(token);
    if (!decoded) return res.status(403).json({ error: 'Forbidden' });

    req.user = decoded;

    // If token is near expiry, hint the client to refresh
    if (isTokenNearExpiry(token, 2)) {
        res.setHeader('X-Token-Expiring', 'true');
    }

    next();
};

// --- Auth Routes ---

app.post('/api/auth/signup', validate(signupSchema), async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        stmt.run(name, email, hashedPassword);
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

app.post('/api/auth/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate access + refresh token pair
    const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } = generateTokenPair(user);
    storeRefreshToken(db, user.id, refreshTokenHash, refreshExpiresAt);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth'
    });

    // Return access token in body (stored in JS memory on client)
    res.json({ token: accessToken, user: { name: user.name, email: user.email, xp: user.xp, level: user.level, setupComplete: !!user.setup_complete, streakFreezes: user.streak_freezes || 0 } });
});

// --- Refresh Token Endpoint ---
app.post('/api/auth/refresh', (req, res) => {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });

    const { valid, userId, tokenHash } = validateRefreshToken(db, rawToken);
    if (!valid) return res.status(403).json({ error: 'Invalid or expired refresh token' });

    // Revoke old token (token rotation)
    revokeRefreshToken(db, tokenHash);

    // Get user data
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Issue new pair
    const newPair = generateTokenPair(user);
    storeRefreshToken(db, user.id, newPair.refreshTokenHash, newPair.refreshExpiresAt);

    res.cookie('refreshToken', newPair.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth'
    });

    res.json({ token: newPair.accessToken });
});

// --- Logout Endpoint ---
app.post('/api/auth/logout', (req, res) => {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
        const { valid, tokenHash } = validateRefreshToken(db, rawToken);
        if (valid) revokeRefreshToken(db, tokenHash);
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out successfully' });
});

// --- User Data Routes ---

app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Parse JSON fields
    user.interests = user.interests ? JSON.parse(user.interests) : [];

    // Get activity
    const activity = db.prepare('SELECT * FROM activity WHERE user_email = ? ORDER BY date DESC LIMIT 50').all(req.user.email);

    // Get quiz history
    const quizHistory = db.prepare('SELECT * FROM quiz_history WHERE user_email = ? ORDER BY date DESC').all(req.user.email);

    // Get flashcards
    const flashcards = db.prepare('SELECT * FROM flashcards WHERE user_email = ?').all(req.user.email);

    res.json({
        ...user,
        activity,
        quizHistory,
        flashcardDecks: flashcards // Need to group by topic_id on frontend or here
    });
});

app.post('/api/user/update', authenticateToken, validate(updateUserSchema), (req, res) => {
    const { level, interests, xp, streak, setupComplete, streakFreezes } = req.body;
    const stmt = db.prepare(`
        UPDATE users 
        SET level = ?, interests = ?, xp = ?, streak = ?, setup_complete = ?, streak_freezes = ?, last_active = CURRENT_TIMESTAMP
        WHERE email = ?
    `);
    stmt.run(level, JSON.stringify(interests), xp, streak, setupComplete ? 1 : 0, streakFreezes || 0, req.user.email);
    res.json({ message: 'User updated' });
});

app.post('/api/user/activity', authenticateToken, validate(activitySchema), (req, res) => {
    const { type, text } = req.body;
    const stmt = db.prepare('INSERT INTO activity (user_email, type, text) VALUES (?, ?, ?)');
    stmt.run(req.user.email, type, text);
    res.json({ message: 'Activity logged' });
});

// --- Push Notification Routes ---

app.get('/api/push/vapidPublicKey', (req, res) => {
    res.send(process.env.VAPID_PUBLIC_KEY || '');
});

app.post('/api/push/subscribe', authenticateToken, (req, res) => {
    const subscription = req.body;
    
    // Check if it already exists
    const existing = db.prepare('SELECT id FROM push_subscriptions WHERE user_email = ? AND subscription = ?').get(req.user.email, JSON.stringify(subscription));
    
    if (!existing) {
        db.prepare('INSERT INTO push_subscriptions (user_email, subscription) VALUES (?, ?)').run(req.user.email, JSON.stringify(subscription));
    }
    
    res.status(201).json({ message: 'Subscribed to push notifications' });
});

app.post('/api/push/test', authenticateToken, async (req, res) => {
    try {
        const subscriptions = db.prepare('SELECT subscription FROM push_subscriptions WHERE user_email = ?').all(req.user.email);
        const payload = JSON.stringify({
            title: 'Quorix AI',
            body: 'Your CRISPR flashcards are forgetting you! You have 5 flashcards due for review.',
            icon: '/images/3d_brain_icon.png'
        });
        
        for (const sub of subscriptions) {
            const pushSubscription = JSON.parse(sub.subscription);
            await webpush.sendNotification(pushSubscription, payload);
        }
        res.json({ message: 'Test notification sent!' });
    } catch (err) {
        console.error('Test push error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Quiz Routes ---

app.post('/api/quiz/record', authenticateToken, validate(quizRecordSchema), (req, res) => {
    const { topicId, topicName, score, totalQuestions, correctAnswers, subject, topic, difficulty } = req.body;
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(req.user.email);
    const stmt = db.prepare(`
        INSERT INTO quiz_history
        (user_email, user_id, topic_id, topic_name, subject, topic, difficulty, score, total_questions, correct_answers, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(req.user.email, user?.id || null, topicId, topicName, subject, topic || topicName || 'General', difficulty, score, totalQuestions, correctAnswers);
    res.json({ message: 'Quiz record saved' });
});

// --- Flashcard Routes ---

app.post('/api/flashcards/sync', authenticateToken, validate(flashcardSyncSchema), (req, res) => {
    const { topicId, cards, subject, topic, difficulty } = req.body;
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(req.user.email);

    db.transaction(() => {
        db.prepare('DELETE FROM flashcards WHERE user_email = ? AND topic_id = ? AND subject = ? AND topic = ? AND difficulty = ?')
            .run(req.user.email, topicId, subject, topic, difficulty);
        const insertStmt = db.prepare(`
            INSERT INTO flashcards
            (user_email, user_id, topic_id, subject, topic, difficulty, front, back, question, answer, interval, repetition, efactor, next_review_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        for (const card of cards) {
            insertStmt.run(
                req.user.email,
                user?.id || null,
                topicId,
                subject,
                topic,
                difficulty,
                card.front,
                card.back,
                card.front,
                card.back,
                card.interval || 0,
                card.repetition || 0,
                card.efactor || 2.5,
                card.nextReviewDate || null
            );
        }
    })();

    res.json({ message: 'Flashcards synced' });
});

// --- AI Proxy ---

// AI rate limiter: 20 req/min per IP for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many AI requests. Please wait a moment.' }
});

app.post('/api/ai/generate', authenticateToken, aiLimiter, validate(aiGenerateSchema), sanitizePrompt, async (req, res) => {
    const { prompt, subject, topic, difficulty } = req.body;
    const studyPrompt = `You are Quorix AI, an expert educational tutor.
The student is studying: ${subject}
Topic: ${topic}
Difficulty level: ${difficulty}

Explain clearly and step by step.
Use examples suitable for the selected subject.
For math/science subjects, include formulas where useful.
For humanities subjects, include context, causes, effects, and examples.
For commerce/accounting subjects, include practical business examples.
Keep answers accurate, student-friendly, and focused on the selected subject.

Student request:
${prompt}`;
    try {
        const result = await generateCompletion(studyPrompt, prompt);
        res.json({ response: result.text, provider: result.provider });
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: 'AI service temporarily unavailable' });
    }
});

// --- Phase 2-3: Mount Feature Route Modules ---
const { mountPracticeTestRoutes } = require('./routes/practiceTests');
const { mountChallengeRoutes } = require('./routes/challenges');
const { mountAnalyticsRoutes } = require('./routes/analytics');
const { mountConceptRoutes } = require('./routes/concepts');

const aiService = require('./services/aiService');
mountPracticeTestRoutes(app, db, authenticateToken, aiService);
mountChallengeRoutes(app, db, authenticateToken, aiService, cron);
mountAnalyticsRoutes(app, db, authenticateToken);
mountConceptRoutes(app, db, authenticateToken, aiService);

// --- Offline Sync Endpoint (Phase 5.1) ---
app.post('/api/sync/offline-reviews', authenticateToken, (req, res) => {
    const { reviews } = req.body;
    if (!reviews || !Array.isArray(reviews)) {
        return res.status(400).json({ error: 'reviews array is required' });
    }

    let synced = 0;
    const conflicts = [];

    for (const review of reviews) {
        try {
            const card = db.prepare('SELECT * FROM flashcards WHERE id = ? AND user_email = ?')
                .get(review.cardId, req.user.email);
            
            if (!card) {
                conflicts.push({ cardId: review.cardId, reason: 'Card not found' });
                continue;
            }

            db.prepare(`
                UPDATE flashcards SET interval = ?, repetition = ?, efactor = ?, next_review_date = ?
                WHERE id = ? AND user_email = ?
            `).run(
                review.interval || card.interval,
                review.repetition || card.repetition,
                review.efactor || card.efactor,
                review.nextReviewDate || card.next_review_date,
                review.cardId,
                req.user.email
            );
            synced++;
        } catch (err) {
            conflicts.push({ cardId: review.cardId, reason: err.message });
        }
    }

    res.json({ synced, conflicts, total: reviews.length });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal Server Error' 
            : err.message
    });
});

// Cleanup expired tokens daily
cron.schedule('0 3 * * *', () => {
    cleanupExpiredTokens(db);
    console.log('[Cron] Cleaned up expired refresh tokens');
});

app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
