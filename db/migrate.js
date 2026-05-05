/** @module migrate — Sequential SQL migration runner for Quorix AI */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Runs all pending migrations in sequential order.
 * Tracks applied migrations in a `_migrations` table.
 * Only additive — never drops tables or columns.
 */
function runMigrations(db) {
    // Ensure migrations tracking table exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure migrations directory exists
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
        console.log('[Migrations] Created migrations directory.');
        return;
    }

    // Get all .sql files sorted by name
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (migrationFiles.length === 0) {
        console.log('[Migrations] No migration files found.');
        return;
    }

    // Get already-applied migrations
    const applied = new Set(
        db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
    );

    let appliedCount = 0;

    for (const file of migrationFiles) {
        if (applied.has(file)) continue;

        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        try {
            db.exec(sql);
            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`[Migrations] ✅ Applied: ${file}`);
            appliedCount++;
        } catch (err) {
            console.error(`[Migrations] ❌ Failed: ${file} — ${err.message}`);
            throw err; // Stop on failure — don't apply subsequent migrations
        }
    }

    if (appliedCount === 0) {
        console.log('[Migrations] All migrations already applied.');
    } else {
        console.log(`[Migrations] Applied ${appliedCount} new migration(s).`);
    }
}

module.exports = { runMigrations };
