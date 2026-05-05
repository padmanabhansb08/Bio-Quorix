/** @module validateEnv — Validates all required environment variables at startup using Zod */
const { z } = require('zod');

const envSchema = z.object({
    GROQ_API_KEY: z.string().min(20, 'GROQ_API_KEY must be at least 20 characters'),
    JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
    PORT: z.coerce.number().default(8000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AI_MODEL: z.string().default('llama-3.3-70b-versatile'),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    // Optional providers for fallback chain
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    // Optional services
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
});

/**
 * Validates environment variables. Throws a clear error if any are invalid.
 * Must be called at the very start of app.js, after dotenv.config().
 */
function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues.map(issue => {
            return `  ❌ ${issue.path.join('.')}: ${issue.message}`;
        });

        console.error('\n╔══════════════════════════════════════════════╗');
        console.error('║   QUORIX AI — Environment Validation Failed  ║');
        console.error('╚══════════════════════════════════════════════╝\n');
        console.error(errors.join('\n'));
        console.error('\nPlease check your .env file. See .env.example for reference.\n');
        process.exit(1);
    }

    // Merge defaults back into process.env
    Object.entries(result.data).forEach(([key, value]) => {
        if (value !== undefined) process.env[key] = String(value);
    });

    console.log(`[Env] ✅ All environment variables validated (${process.env.NODE_ENV} mode)`);
    return result.data;
}

module.exports = { validateEnv };
