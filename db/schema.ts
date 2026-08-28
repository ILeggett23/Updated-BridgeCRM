export const hostedReminderSchema = {
  subscriptions: "bridge_push_subscriptions",
  deliveries: "bridge_push_deliveries",
  scorecards: "bridge_shared_scorecards"
} as const;

// The Worker uses the SQL migrations directly, but keeping the table contract
// here makes the account and sync surface discoverable to Drizzle tooling and
// prevents the reference schema from drifting away from the deployed D1
// tables.
export const accountSchema = {
  users: "bridge_users",
  sessions: "bridge_sessions",
  actionTokens: "bridge_account_tokens",
  rateLimits: "bridge_auth_rate_limits",
  backups: "bridge_backup_runs"
} as const;

export const cloudSyncSchema = {
  userSync: "bridge_user_sync",
  records: "bridge_crm_records",
  mutations: "bridge_sync_mutations",
  localMigrations: "bridge_local_migrations"
} as const;

export const cloudRecordTypes = ["contact", "place", "settings", "analytics", "meta"] as const;
