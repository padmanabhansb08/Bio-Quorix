/** @module sm2.test — Exhaustive tests for the SM-2 spaced repetition algorithm */
const { describe, it, expect } = require('vitest');

/**
 * SM-2 Algorithm implementation (extracted for testability).
 * quality: 0-5 (0-2 = fail, 3-5 = pass)
 */
function sm2(card, quality) {
    let { interval, repetition, efactor } = card;

    if (quality >= 3) {
        // Correct answer
        if (repetition === 0) interval = 1;
        else if (repetition === 1) interval = 6;
        else interval = Math.round(interval * efactor);
        repetition++;
    } else {
        // Incorrect answer — reset
        interval = 1;
        repetition = 0;
    }

    // Update ease factor
    efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Clamp ease factor
    if (efactor < 1.3) efactor = 1.3;
    if (efactor > 2.5) efactor = 2.5;

    return {
        interval,
        repetition,
        efactor: Math.round(efactor * 100) / 100,
        nextReviewDate: Date.now() + interval * 24 * 60 * 60 * 1000
    };
}

describe('SM-2 Algorithm', () => {
    it('should increase interval on correct answer (quality 4)', () => {
        const card = { interval: 6, repetition: 2, efactor: 2.5 };
        const result = sm2(card, 4);
        expect(result.interval).toBe(15); // 6 * 2.5 = 15
        expect(result.repetition).toBe(3);
    });

    it('should reset interval on incorrect answer (quality 1)', () => {
        const card = { interval: 15, repetition: 5, efactor: 2.3 };
        const result = sm2(card, 1);
        expect(result.interval).toBe(1);
        expect(result.repetition).toBe(0);
    });

    it('should clamp ease factor at minimum 1.3', () => {
        const card = { interval: 1, repetition: 0, efactor: 1.3 };
        const result = sm2(card, 0); // Very poor
        expect(result.efactor).toBe(1.3);
    });

    it('should clamp ease factor at maximum 2.5', () => {
        const card = { interval: 1, repetition: 0, efactor: 2.5 };
        const result = sm2(card, 5); // Perfect
        expect(result.efactor).toBe(2.5);
    });

    it('should handle first review correctly (repetition 0, quality 4)', () => {
        const card = { interval: 0, repetition: 0, efactor: 2.5 };
        const result = sm2(card, 4);
        expect(result.interval).toBe(1);
        expect(result.repetition).toBe(1);
    });

    it('should set interval to 6 on second correct review', () => {
        const card = { interval: 1, repetition: 1, efactor: 2.5 };
        const result = sm2(card, 4);
        expect(result.interval).toBe(6);
        expect(result.repetition).toBe(2);
    });

    it('should decrease ease factor on quality 3 (barely pass)', () => {
        const card = { interval: 6, repetition: 2, efactor: 2.5 };
        const result = sm2(card, 3);
        expect(result.efactor).toBeLessThan(2.5);
    });

    it('should return a future nextReviewDate', () => {
        const card = { interval: 1, repetition: 0, efactor: 2.5 };
        const result = sm2(card, 4);
        expect(result.nextReviewDate).toBeGreaterThan(Date.now());
    });

    it('should progressively increase intervals on consecutive correct answers', () => {
        let card = { interval: 0, repetition: 0, efactor: 2.5 };
        const intervals = [];

        for (let i = 0; i < 5; i++) {
            card = sm2(card, 4);
            intervals.push(card.interval);
        }

        // Each interval should be >= previous
        for (let i = 1; i < intervals.length; i++) {
            expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
        }
    });
});

module.exports = { sm2 };
