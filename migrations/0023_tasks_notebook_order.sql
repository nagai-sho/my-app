ALTER TABLE task_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE task_items AS current_task
   SET sort_order = (
     SELECT COUNT(*)
       FROM task_items AS earlier_task
      WHERE earlier_task.owner_id = current_task.owner_id
        AND (
          earlier_task.created_at < current_task.created_at
          OR (
            earlier_task.created_at = current_task.created_at
            AND earlier_task.rowid <= current_task.rowid
          )
        )
   );

CREATE INDEX IF NOT EXISTS idx_task_items_owner_sort
  ON task_items(owner_id, sort_order ASC);
