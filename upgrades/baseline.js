/**
 * This is the upgrade file required for implementation of Drizzle and its migration files on existing installs.
 *
 * Previously, sequelize handled database updates automatically,
 * but as of May 2026 it's no longer supported on Debian 12 (and no longer supported in general...)
 */

import fs from 'fs';
import Database from 'better-sqlite3'; // Or 'bun:sqlite', 'sqlite3' depending on your driver

// 1. Configuration - Update paths to match your folder structure
const DB_PATH = process.env.DB_PATH || './warlock.sqlite';
const JOURNAL_PATH = './db/migrations/meta/_journal.json';

function bootstrapProduction() {
	// 2. Check if the database and journal files exist
	if (!fs.existsSync(DB_PATH)) {
		console.error(`Database not found at ${DB_PATH}. Skipping baseline.`);
		process.exit(0); // Exit safely if DB doesn't exist yet
	}
	if (!fs.existsSync(JOURNAL_PATH)) {
		console.error(`Drizzle journal not found at ${JOURNAL_PATH}. Check your paths.`);
		process.exit(1);
	}

	// 3. Extract the baseline migration timestamp
	const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));
	const baselineMigration = journal.entries?.[0];

	if (!baselineMigration) {
		console.error('No migrations found in _journal.json to baseline.');
		process.exit(1);
	}

	const baselineTimestamp = baselineMigration.when;
	console.log(`Found baseline migration timestamp: ${baselineTimestamp}`);

	// 4. Connect to production database and apply metadata
	const db = new Database(DB_PATH);

	try {
		db.transaction(() => {
			// Create metadata table if it is missing
			db.prepare(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "hash" text NOT NULL,
          "created_at" integer
        );
      `).run();

			// Check if the baseline or any migrations have already been registered
			const rowCount = db.prepare('SELECT count(*) as count FROM "__drizzle_migrations"').get();

			if (rowCount.count === 0) {
				// Seed the baseline token so Drizzle skips the 0000 file
				db.prepare(`
          INSERT INTO "__drizzle_migrations" (hash, created_at) 
          VALUES ('manual_baseline', ?);
        `).run(baselineTimestamp);

				console.log('Successfully injected migration metadata. Drizzle will now skip the initial setup.');
			} else {
				console.log('Migration metadata table already initialized. Skipping baselining.');
			}
		})();
	} catch (error) {
		console.error('Failed to inject migration metadata:', error);
		process.exit(1);
	} finally {
		db.close();
	}
}

bootstrapProduction();