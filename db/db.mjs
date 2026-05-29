import {drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.mjs';
import {logger} from "../libs/logger.mjs";

const db_log = msg => {
	logger.debug('db:', msg);
}

const sqlite = new Database(process.env.DB_PATH || 'warlock.sqlite', { verbose: db_log });

// Instantiate Drizzle instance globally
export const db = drizzle(sqlite, { schema });
