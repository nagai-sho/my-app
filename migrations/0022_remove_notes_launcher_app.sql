PRAGMA foreign_keys = ON;

-- Remove the unused Notes placeholder from the launcher only.
DELETE FROM apps WHERE id = 'app_1';
