CREATE TABLE bridge_crm_records_with_analytics (
  user_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('contact', 'place', 'settings', 'analytics', 'meta')),
  record_id TEXT NOT NULL,
  payload_json TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  sync_cursor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, record_type, record_id),
  FOREIGN KEY (user_id) REFERENCES bridge_users(id) ON DELETE CASCADE
);

INSERT INTO bridge_crm_records_with_analytics (
  user_id,
  record_type,
  record_id,
  payload_json,
  revision,
  sync_cursor,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  user_id,
  record_type,
  record_id,
  payload_json,
  revision,
  sync_cursor,
  created_at,
  updated_at,
  deleted_at
FROM bridge_crm_records;

DROP INDEX bridge_crm_records_pull;
DROP TABLE bridge_crm_records;
ALTER TABLE bridge_crm_records_with_analytics RENAME TO bridge_crm_records;

CREATE INDEX bridge_crm_records_pull
  ON bridge_crm_records(user_id, sync_cursor);
