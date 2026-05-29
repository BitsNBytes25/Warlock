-- Current sql file was generated after introspecting the database
CREATE TABLE `Users` (
	`id` integer PRIMARY KEY,
	`username` text(255),
	`password` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL,
	`secret_2fa` text(255)
);
--> statement-breakpoint
CREATE TABLE `Hosts` (
	`id` integer PRIMARY KEY,
	`ip` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Meta` (
	`id` integer PRIMARY KEY,
	`key` text(255),
	`value` text(255),
	`createdAt` numeric NOT NULL,
	`updatedAt` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Metrics` (
	`id` integer PRIMARY KEY,
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
CREATE INDEX `metrics_app_guid_service_timestamp` ON `Metrics` (`app_guid`,`service`,`timestamp`);--> statement-breakpoint
CREATE INDEX `metrics_ip_service_timestamp` ON `Metrics` (`ip`,`service`,`timestamp`);--> statement-breakpoint
CREATE TABLE `HostMetrics` (
	`id` integer PRIMARY KEY,
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
CREATE INDEX `host_metrics_ip_timestamp` ON `HostMetrics` (`ip`,`timestamp`);
