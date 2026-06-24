ALTER TABLE `notification_deliveries` ADD `reminder_at` integer;--> statement-breakpoint
CREATE TRIGGER `bookings_no_overlap_insert`
BEFORE INSERT ON `bookings`
WHEN NEW.`deleted_at` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `bookings` AS existing
    WHERE existing.`machine_id` = NEW.`machine_id`
      AND existing.`deleted_at` IS NULL
      AND existing.`starts_at` < NEW.`ends_at`
      AND existing.`ends_at` > NEW.`starts_at`
  )
BEGIN
  SELECT RAISE(ABORT, 'booking_overlap');
END;--> statement-breakpoint
CREATE TRIGGER `bookings_no_overlap_update`
BEFORE UPDATE OF `machine_id`, `starts_at`, `ends_at`, `deleted_at` ON `bookings`
WHEN NEW.`deleted_at` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `bookings` AS existing
    WHERE existing.`id` <> NEW.`id`
      AND existing.`machine_id` = NEW.`machine_id`
      AND existing.`deleted_at` IS NULL
      AND existing.`starts_at` < NEW.`ends_at`
      AND existing.`ends_at` > NEW.`starts_at`
  )
BEGIN
  SELECT RAISE(ABORT, 'booking_overlap');
END;
