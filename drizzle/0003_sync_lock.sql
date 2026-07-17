CREATE TABLE `sync_lock` (
  `id` integer PRIMARY KEY NOT NULL,
  `acquired_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `source` text NOT NULL
);
