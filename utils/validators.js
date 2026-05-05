/** @module validators — Zod request body validators for all API routes */
const { z } = require('zod');

// --- Auth Schemas ---
const signupSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

// --- User Schemas ---
const updateUserSchema = z.object({
    level: z.string().optional(),
    interests: z.array(z.string()).optional(),
    xp: z.number().int().min(0).optional(),
    streak: z.number().int().min(0).optional(),
    setupComplete: z.boolean().optional(),
    streakFreezes: z.number().int().min(0).optional(),
});

const activitySchema = z.object({
    type: z.string().min(1, 'Activity type is required'),
    text: z.string().min(1, 'Activity text is required').max(500, 'Activity text too long'),
});

// --- Quiz Schemas ---
const quizRecordSchema = z.object({
    topicId: z.string().min(1),
    topicName: z.string().min(1),
    score: z.number().int().min(0).max(100),
    totalQuestions: z.number().int().min(1),
    correctAnswers: z.number().int().min(0),
    subject: z.string().default('All Topics'),
    topic: z.string().default('General'),
    difficulty: z.string().default('Intermediate'),
});

// --- Flashcard Schemas ---
const flashcardCardSchema = z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    interval: z.number().optional(),
    repetition: z.number().optional(),
    efactor: z.number().optional(),
    nextReviewDate: z.number().nullable().optional(),
});

const flashcardSyncSchema = z.object({
    topicId: z.string().min(1),
    cards: z.array(flashcardCardSchema).min(1, 'At least one card is required'),
    subject: z.string().default('All Topics'),
    topic: z.string().default('General'),
    difficulty: z.string().default('Intermediate'),
});

// --- AI Schemas ---
const aiGenerateSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long'),
    subject: z.string().default('All Topics'),
    topic: z.string().default('General'),
    difficulty: z.string().default('Intermediate'),
});

// --- Practice Test Schemas ---
const practiceTestGenerateSchema = z.object({
    subject: z.string().min(1, 'Subject is required'),
    topic: z.string().min(1, 'Topic is required'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    count: z.number().int().min(5).max(20).default(10),
});

// --- Push Notification Schemas ---
const pushSubscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
    }),
}).passthrough(); // Allow additional fields from browser

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * Returns 400 with structured error details on failure.
 * @param {z.ZodSchema} schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));
            return res.status(400).json({
                error: 'Validation failed',
                details,
            });
        }
        // Replace body with parsed (and defaulted) data
        req.body = result.data;
        next();
    };
}

module.exports = {
    validate,
    signupSchema,
    loginSchema,
    updateUserSchema,
    activitySchema,
    quizRecordSchema,
    flashcardSyncSchema,
    aiGenerateSchema,
    practiceTestGenerateSchema,
    pushSubscriptionSchema,
};
