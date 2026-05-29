import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",                    // Tells Drizzle you are using SQLite
	schema: "./db/schema.mjs",         // Path to the schema file we created earlier
	out: './db/migrations',
	dbCredentials: {
		url: process.env.DB_PATH || 'warlock.sqlite',           // Path to your actual local SQLite database file
	},
});