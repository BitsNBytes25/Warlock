import {drizzle} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';


const sqlite = new Database(process.env.DB_PATH || 'warlock.sqlite', { verbose: console.debug });

// Instantiate Drizzle instance globally
export const db = drizzle(sqlite, { schema });
