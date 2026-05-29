PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text(255),
	`password` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL,
	`secret_2fa` text(255)
);
--> statement-breakpoint
INSERT INTO `__new_Users`("id", "username", "password", "createdAt", "updatedAt", "secret_2fa") SELECT "id", "username", "password", "createdAt", "updatedAt", "secret_2fa" FROM `Users`;--> statement-breakpoint
DROP TABLE `Users`;--> statement-breakpoint
ALTER TABLE `__new_Users` RENAME TO `Users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_Hosts` (
	`id` integer PRIMARY KEY NOT NULL,
	`ip` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Hosts`("id", "ip", "createdAt", "updatedAt") SELECT "id", "ip", "createdAt", "updatedAt" FROM `Hosts`;--> statement-breakpoint
DROP TABLE `Hosts`;--> statement-breakpoint
ALTER TABLE `__new_Hosts` RENAME TO `Hosts`;--> statement-breakpoint
CREATE TABLE `__new_Meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text(255),
	`value` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Meta`("id", "key", "value", "createdAt", "updatedAt") SELECT "id", "key", "value", "createdAt", "updatedAt" FROM `Meta`;--> statement-breakpoint
DROP TABLE `Meta`;--> statement-breakpoint
ALTER TABLE `__new_Meta` RENAME TO `Meta`;--> statement-breakpoint
CREATE TABLE `__new_Metrics` (
	`id` integer PRIMARY KEY NOT NULL,
	`ip` text(255) NOT NULL,
	`app_guid` text(255) NOT NULL,
	`service` text(255) NOT NULL,
	`timestamp` integer NOT NULL,
	`cpu_usage` integer,
	`memory_usage` integer,
	`player_count` integer,
	`response_time` integer,
	`status` integer
);
--> statement-breakpoint
INSERT INTO `__new_Metrics`("id", "ip", "app_guid", "service", "timestamp", "cpu_usage", "memory_usage", "player_count", "response_time", "status") SELECT "id", "ip", "app_guid", "service", "timestamp", "cpu_usage", "memory_usage", "player_count", "response_time", "status" FROM `Metrics`;--> statement-breakpoint
DROP TABLE `Metrics`;--> statement-breakpoint
ALTER TABLE `__new_Metrics` RENAME TO `Metrics`;--> statement-breakpoint
CREATE INDEX `metrics_app_guid_service_timestamp` ON `Metrics` (`app_guid`,`service`,`timestamp`);--> statement-breakpoint
CREATE INDEX `metrics_ip_service_timestamp` ON `Metrics` (`ip`,`service`,`timestamp`);--> statement-breakpoint
CREATE TABLE `__new_HostMetrics` (
	`id` integer PRIMARY KEY NOT NULL,
	`ip` text(255) NOT NULL,
	`timestamp` integer NOT NULL,
	`cpu` integer,
	`memory` integer,
	`disk` integer,
	`rx_last` integer,
	`rx` integer,
	`tx_last` integer,
	`tx` integer
);
--> statement-breakpoint
INSERT INTO `__new_HostMetrics`("id", "ip", "timestamp", "cpu", "memory", "disk", "rx_last", "rx", "tx_last", "tx") SELECT "id", "ip", "timestamp", "cpu", "memory", "disk", "rx_last", "rx", "tx_last", "tx" FROM `HostMetrics`;--> statement-breakpoint
DROP TABLE `HostMetrics`;--> statement-breakpoint
ALTER TABLE `__new_HostMetrics` RENAME TO `HostMetrics`;--> statement-breakpoint
CREATE INDEX `host_metrics_ip_timestamp` ON `HostMetrics` (`ip`,`timestamp`);