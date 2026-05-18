/** @module aiService — Unified AI provider with automatic fallback chain */
const { moderateResponse } = require('../middleware/promptGuard');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PROVIDERS = {
    gemini: {
        name: 'Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        envKey: 'GEMINI_API_KEY',
        model: () => 'gemma-3-27b-it',
        timeout: 15000,
    },
    groq: {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        envKey: 'GROQ_API_KEY',
        model: () => process.env.AI_MODEL || 'openai/gpt-oss-20b',
        timeout: 8000,
    },
    openai: {
        name: 'OpenAI',
        url: 'https://api.openai.com/v1/chat/completions',
        envKey: 'OPENAI_API_KEY',
        model: () => 'gpt-4o-mini',
        timeout: 15000,
    }
};

/**
 * Attempts to call a single AI provider.
 * @param {object} provider - Provider config from PROVIDERS
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function callProvider(provider, systemPrompt, userPrompt) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) throw new Error(`${provider.name}: API key not configured`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

    try {
        const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: provider.model(),
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${provider.name} returned ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error(`${provider.name}: Empty response`);

        return { text, provider: provider.name };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error(`${provider.name}: Request timed out after ${provider.timeout}ms`);
        }
        throw err;
    }
}

/**
 * Generates an AI completion with automatic fallback through the provider chain.
 * Groq → OpenAI → Gemini → Graceful error
 * 
 * @param {string} systemPrompt - System-level instruction
 * @param {string} userPrompt - User's input
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function generateCompletion(systemPrompt, userPrompt) {
    const providerOrder = [PROVIDERS.groq, PROVIDERS.gemini, PROVIDERS.openai];
    const errors = [];

    for (const provider of providerOrder) {
        // Skip providers without API keys
        if (!process.env[provider.envKey]) {
            continue;
        }

        try {
            console.log(`[AI] Attempting ${provider.name}...`);
            const result = await callProvider(provider, systemPrompt, userPrompt);

            // Run content moderation on the response
            result.text = moderateResponse(result.text);

            console.log(`[AI] ✅ ${provider.name} responded successfully`);
            return result;
        } catch (err) {
            console.warn(`[AI] ⚠️ ${provider.name} failed: ${err.message}`);
            errors.push({ provider: provider.name, error: err.message });
        }
    }

    // All providers failed
    console.error('[AI] ❌ All providers failed:', JSON.stringify(errors));
    return {
        text: 'The AI tutor is temporarily unavailable. Your progress has been saved. Please try again in a moment.',
        provider: 'fallback',
        errors
    };
}

module.exports = { generateCompletion, callProvider, PROVIDERS };
