/** @module logger — Structured JSON logging with Winston for production monitoring */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'quorix-ai' },
    transports: [
        // Console: colorized for dev, JSON for production
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? winston.format.json()
                : winston.format.combine(
                    winston.format.colorize(),
                    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${timestamp} [${level}] ${message}${metaStr}`;
                    })
                )
        }),
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
    ],
});

/**
 * Morgan stream adapter — pipes HTTP request logs through Winston.
 */
const morganStream = {
    write: (message) => {
        logger.info(message.trim(), { type: 'http' });
    }
};

module.exports = { logger, morganStream };
