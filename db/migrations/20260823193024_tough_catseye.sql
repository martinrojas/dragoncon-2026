CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`username` text,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`contact` text,
	`app_version` text,
	`user_agent` text,
	`page_url` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
