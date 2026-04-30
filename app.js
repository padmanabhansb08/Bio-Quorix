require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Serve static frontend files.
app.use(express.static(path.join(__dirname, 'frontend', 'frontend')));

// Middleware for auth
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        stmt.run(name, email, hashedPassword);
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email, xp: user.xp, level: user.level, setupComplete: !!user.setup_complete } });
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

app.post('/api/user/update', authenticateToken, (req, res) => {
    const { level, interests, xp, streak, setupComplete } = req.body;
    const stmt = db.prepare(`
        UPDATE users 
        SET level = ?, interests = ?, xp = ?, streak = ?, setup_complete = ?, last_active = CURRENT_TIMESTAMP
        WHERE email = ?
    `);
    stmt.run(level, JSON.stringify(interests), xp, streak, setupComplete ? 1 : 0, req.user.email);
    res.json({ message: 'User updated' });
});

app.post('/api/user/activity', authenticateToken, (req, res) => {
    const { type, text } = req.body;
    const stmt = db.prepare('INSERT INTO activity (user_email, type, text) VALUES (?, ?, ?)');
    stmt.run(req.user.email, type, text);
    res.json({ message: 'Activity logged' });
});

// --- Quiz Routes ---

app.post('/api/quiz/record', authenticateToken, (req, res) => {
    const {
        topicId,
        topicName,
        score,
        totalQuestions,
        correctAnswers,
        subject = 'All Topics',
        topic = 'General',
        difficulty = 'Intermediate'
    } = req.body;
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

app.post('/api/flashcards/sync', authenticateToken, (req, res) => {
    const {
        topicId,
        cards,
        subject = 'All Topics',
        topic = 'General',
        difficulty = 'Intermediate'
    } = req.body;
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

app.post('/api/ai/generate', authenticateToken, async (req, res) => {
    const {
        prompt,
        subject = 'All Topics',
        topic = 'General',
        difficulty = 'Intermediate'
    } = req.body;
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
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not configured in .env');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: studyPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API Error:', errorText);
            throw new Error('AI service connection failed');
        }

        const data = await response.json();
        res.json({ response: data.choices[0].message.content });
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
});
