-- Remove the unused launcher placeholders.  This only removes the app
-- directory entries; it does not delete any feature data.
DELETE FROM apps WHERE id IN ('app_3', 'app_4');
