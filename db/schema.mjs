import { sqliteTable, integer, numeric, index, text } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("Users", {
	id: integer().primaryKey(),
	username: text({ length: 255 }),
	password: text({ length: 255 }),
	createdAt: numeric().notNull(),
	updatedAt: numeric().notNull(),
	secret_2fa: text("secret_2fa", { length: 255 }),
});

export const meta = sqliteTable("Meta", {
	id: integer().primaryKey(),
	key: text({ length: 255 }),
	value: text({ length: 255 }),
});

export const metrics = sqliteTable("Metrics", {
	id: integer().primaryKey(),
	ip: text({ length: 255 }).notNull(),
	app_guid: text("app_guid", { length: 255 }).notNull(),
	service: text({ length: 255 }).notNull(),
	timestamp: integer().notNull(),
	cpu_usage: integer("cpu_usage"),
	memory_usage: integer("memory_usage"),
	player_count: integer("player_count"),
	response_time: integer("response_time"),
	status: integer(),
},
(table) => [
	index("metrics_app_guid_service_timestamp").on(table.app_guid, table.service, table.timestamp),
	index("metrics_ip_service_timestamp").on(table.ip, table.service, table.timestamp),
]);

export const hostMetrics = sqliteTable("HostMetrics", {
	id: integer().primaryKey(),
	ip: text({ length: 255 }).notNull(),
	timestamp: integer().notNull(),
	cpu: integer(),
	memory: integer(),
	disk: integer(),
	rx_last: integer("rx_last"),
	rx: integer(),
	tx_last: integer("tx_last"),
	tx: integer(),
},
(table) => [
	index("host_metrics_ip_timestamp").on(table.ip, table.timestamp),
]);

export const hosts = sqliteTable("Hosts", {
	id: integer().primaryKey(),
	ip: text({ length: 255 }),
	createdAt: numeric().notNull(),
	updatedAt: numeric().notNull(),
});

