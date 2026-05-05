/** @module promptGuard — Middleware to sanitize user prompts against injection attacks */

// Patterns commonly used in prompt injection attempts
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous/gi,
    /ignore\s+all/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /you\s+are\s+now/gi,
    /act\s+as\s+(if\s+you\s+are\s+)?/gi,
    /jailbreak/gi,
    /\bDAN\b/g,
    /system\s+prompt/gi,
    /reveal\s+your\s+(instructions|prompt|system)/gi,
    /forget\s+(all\s+)?(previous|your|prior)/gi,
    /pretend\s+(you\s+are|to\s+be)/gi,
    /override\s+(your|the|all)/gi,
    /bypass\s+(your|the|all|safety)/gi,
    /new\s+instructions?:/gi,
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
];

/**
 * Sanitizes the prompt field in req.body by stripping injection patterns.
 * Applied ONLY to routes that send user input to an LLM.
 */
function sanitizePrompt(req, res, next) {
    if (!req.body || !req.body.prompt) {
        return next();
    }

    let cleaned = req.body.prompt;
    let injectionDetected = false;

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(cleaned)) {
            injectionDetected = true;
            cleaned = cleaned.replace(pattern, '[FILTERED]');
        }
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
    }

    if (injectionDetected) {
        console.warn(`[PromptGuard] Injection attempt detected from ${req.user?.email || 'unknown'}: "${req.body.prompt.substring(0, 100)}..."`);
    }

    req.body.prompt = cleaned;
    req.body._promptSanitized = true;
    next();
}

/**
 * Checks if AI response contains potentially harmful content.
 * Uses pattern matching (no external API call required).
 * Returns cleaned response or original if safe.
 */
function moderateResponse(text) {
    if (!text || typeof text !== 'string') return text;

    const UNSAFE_PATTERNS = [
        /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive)/gi,
        /instructions\s+for\s+(making|building|creating)\s+(a\s+)?(bomb|weapon)/gi,
        /self[- ]harm/gi,
        /suicide\s+(method|instruction|how\s+to)/gi,
    ];

    for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.test(text)) {
            return 'I can only help with educational content. Please ask a subject-related question.';
        }
        pattern.lastIndex = 0;
    }

    return text;
}

module.exports = { sanitizePrompt, moderateResponse };
