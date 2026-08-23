CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`days` text,
	`stats` text,
	`log` text,
	`error_message` text,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;