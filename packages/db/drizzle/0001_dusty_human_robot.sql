CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`booking_id` text,
	`recipient_email` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`scheduled_for` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_idempotency_idx` ON `notification_deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_due_idx` ON `notification_deliveries` (`status`,`scheduled_for`);