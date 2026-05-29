import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './warlock.sqlite';

async function runProductionMigrations() {
	console.log('Connecting to database for migrations...');
	const sqlite = new Database(DB_PATH);
	const db = drizzle(sqlite);

	try {
		console.log('Running pending migrations...');

		// This looks at your local folder and applies unrun .sql files
		await migrate(db, {
			migrationsFolder: path.resolve('./db/migrations')
		});

		console.log('Migrations applied successfully!');
	} catch (error) {
		console.error('Migration execution failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

runProductionMigrations();