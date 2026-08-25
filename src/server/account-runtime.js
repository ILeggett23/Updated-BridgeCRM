const ACCOUNT_API_PREFIX = "/api/v1";
const ACCOUNT_SESSION_DAYS = 7;
const ACCOUNT_LONG_SESSION_DAYS = 30;
const ACCOUNT_PASSWORD_ITERATIONS = 100000;
const ACCOUNT_MAX_BODY_BYTES = 4_000_000;
const ACCOUNT_MAX_BACKUP_RECORDS = 5000;
const ACCOUNT_RECORD_TYPES = new Set(["contact", "place", "settings", "analytics", "meta"]);
const ACCOUNT_TOKEN_TTL = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000
};

function accountJSON(value, status = 200, headers = {}) {
  return json(value, status, {
    "cache-control": "no-store, private",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff",
    ...headers
  });
}

function accountError(code, message, status = 400, details) {
  return accountJSON({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

function accountEnabled(env) {
  return env.AUTH_ENABLED === "true";
}

function accountEmailConfigured(env) {
  return Boolean(env.EMAIL && env.AUTH_EMAIL_FROM);
}

function accountTurnstileConfigured(env) {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

function normalizeAccountEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validAccountEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value) && value.length <= 254;
}

function validAccountPassword(value) {
  const password = String(value || "");
  return password.length >= 12 && password.length <= 256;
}

function safeAccountName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function accountToken(bytes = 32) {
  return base64URL(crypto.getRandomValues(new Uint8Array(bytes)));
}

function accountNow() {
  return new Date().toISOString();
}

function accountFuture(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function accountIP(request) {
  return String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}

async function accountFingerprint(value, env) {
  return sha256(String(env.AUTH_HASH_PEPPER || "") + ":" + String(value || ""));
}

async function accountReadJSON(request, maxBytes = ACCOUNT_MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error("Request is too large"), { status: 413, code: "request_too_large" });
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error("Request is too large"), { status: 413, code: "request_too_large" });
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error("Request body must be valid JSON"), { status: 400, code: "invalid_json" }); }
}

async function accountHashPassword(password, salt = accountToken(18), iterations = ACCOUNT_PASSWORD_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", textEncoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: textEncoder.encode(salt),
    iterations
  }, material, 256);
  return { hash: base64URL(derived), salt, iterations };
}

function accountConstantTimeEqual(left, right) {
  const a = textEncoder.encode(String(left || ""));
  const b = textEncoder.encode(String(right || ""));
  if (a.length !== b.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === "function") return crypto.subtle.timingSafeEqual(a, b);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function accountVerifyPassword(password, user) {
  const candidate = await accountHashPassword(password, user.password_salt, Number(user.password_iterations));
  return accountConstantTimeEqual(candidate.hash, user.password_hash);
}

async function accountRateLimit(env, request, bucket, email, options = {}) {
  const now = Date.now();
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const limit = options.limit || 8;
  const blockMs = options.blockMs || 30 * 60 * 1000;
  const identity = await accountFingerprint(accountIP(request) + ":" + normalizeAccountEmail(email), env);
  const key = bucket + ":" + identity;
  const current = await env.DB.prepare("SELECT window_started_at, request_count, blocked_until FROM bridge_auth_rate_limits WHERE bucket_key = ?1").bind(key).first();
  if (Number(current?.blocked_until || 0) > now) {
    return { allowed: false, retryAfter: Math.ceil((Number(current.blocked_until) - now) / 1000) };
  }
  const stale = !current || now - Number(current.window_started_at || 0) >= windowMs;
  const count = stale ? 1 : Number(current.request_count || 0) + 1;
  const blockedUntil = count > limit ? now + blockMs : null;
  await env.DB.prepare(
    "INSERT INTO bridge_auth_rate_limits (bucket_key, window_started_at, request_count, blocked_until) VALUES (?1, ?2, ?3, ?4) " +
    "ON CONFLICT(bucket_key) DO UPDATE SET window_started_at = excluded.window_started_at, request_count = excluded.request_count, blocked_until = excluded.blocked_until"
  ).bind(key, stale ? now : Number(current.window_started_at), count, blockedUntil).run();
  return blockedUntil
    ? { allowed: false, retryAfter: Math.ceil(blockMs / 1000) }
    : { allowed: true, remaining: Math.max(0, limit - count) };
}

async function accountValidateTurnstile(request, env, responseToken) {
  if (env.AUTH_REQUIRE_TURNSTILE === "false") return { success: true, bypassed: true };
  if (!accountTurnstileConfigured(env)) return { success: false, configurationError: true };
  if (!responseToken || String(responseToken).length > 2048) return { success: false };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: String(responseToken),
        remoteip: accountIP(request),
        idempotency_key: crypto.randomUUID()
      })
    });
    const result = await response.json();
    return { success: Boolean(result.success), hostname: result.hostname, errors: result["error-codes"] || [] };
  } catch {
    return { success: false, serviceError: true };
  }
}

function accountEmailTemplate(title, message, actionLabel, actionURL) {
  const safeTitle = escapeHTML(title);
  const safeMessage = escapeHTML(message);
  const safeAction = escapeHTML(actionLabel);
  const safeURL = escapeHTML(actionURL);
  return {
    text: title + "\n\n" + message + "\n\n" + actionLabel + ": " + actionURL + "\n\nIf you did not request this, you can ignore this email.",
    html: "<!doctype html><html><body style=\"margin:0;background:#f3f5f7;color:#111827;font:16px -apple-system,BlinkMacSystemFont,sans-serif\"><div style=\"max-width:560px;margin:0 auto;padding:40px 20px\"><div style=\"background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px\"><h1 style=\"font-size:24px;margin:0 0 16px\">" + safeTitle + "</h1><p style=\"line-height:1.6;margin:0 0 24px\">" + safeMessage + "</p><a href=\"" + safeURL + "\" style=\"display:inline-block;background:#2477d8;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:700\">" + safeAction + "</a><p style=\"color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0\">If you did not request this, you can ignore this email.</p></div></div></body></html>"
  };
}

async function accountSendEmail(env, { to, subject, text, html }) {
  if (!accountEmailConfigured(env)) return { ok: false, configurationError: true };
  try {
    const result = await env.EMAIL.send({
      to,
      from: { email: env.AUTH_EMAIL_FROM, name: env.AUTH_EMAIL_NAME || "Bridge CRM" },
      subject,
      text,
      html
    });
    return { ok: true, result };
  } catch (error) {
    console.error("Bridge account email failed", { message: String(error?.message || error) });
    return { ok: false };
  }
}

async function accountIssueActionToken(env, user, purpose, request) {
  const rawToken = accountToken();
  const tokenHash = await sha256(rawToken);
  const now = accountNow();
  const expiresAt = accountFuture(ACCOUNT_TOKEN_TTL[purpose]);
  await env.DB.batch([
    env.DB.prepare("UPDATE bridge_account_tokens SET used_at = ?1 WHERE user_id = ?2 AND purpose = ?3 AND used_at IS NULL").bind(now, user.id, purpose),
    env.DB.prepare("INSERT INTO bridge_account_tokens (id, user_id, purpose, token_hash, created_at, expires_at, used_at, request_ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)")
      .bind(crypto.randomUUID(), user.id, purpose, tokenHash, now, expiresAt, await accountFingerprint(accountIP(request), env))
  ]);
  return { rawToken, expiresAt };
}

async function accountSendActionEmail(env, user, purpose, rawToken) {
  const appURL = new URL(env.PUBLIC_APP_URL || "https://ileggett23.github.io/Updated-BridgeCRM/");
  if (purpose === "verify_email") appURL.searchParams.set("verifyEmail", rawToken);
  else appURL.searchParams.set("resetPassword", rawToken);
  const verification = purpose === "verify_email";
  const template = accountEmailTemplate(
    verification ? "Verify your Bridge email" : "Reset your Bridge password",
    verification ? "Confirm this email address to finish creating your secure Bridge account." : "Use this secure link to choose a new Bridge password. The link expires in one hour.",
    verification ? "Verify email" : "Reset password",
    appURL.href
  );
  return accountSendEmail(env, {
    to: user.email_display,
    subject: verification ? "Verify your Bridge email" : "Reset your Bridge password",
    ...template
  });
}

async function accountCreateSession(request, env, user, rememberMe = false) {
  const rawToken = accountToken();
  const now = accountNow();
  const expiresAt = accountFuture((rememberMe ? ACCOUNT_LONG_SESSION_DAYS : ACCOUNT_SESSION_DAYS) * 86400000);
  await env.DB.prepare("INSERT INTO bridge_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at, user_agent_hash, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?4, NULL, ?6, ?7)")
    .bind(
      crypto.randomUUID(),
      user.id,
      await sha256(rawToken),
      now,
      expiresAt,
      await accountFingerprint(request.headers.get("user-agent") || "", env),
      await accountFingerprint(accountIP(request), env)
    ).run();
  return { rawToken, expiresAt };
}

function accountPublicUser(user) {
  return {
    id: user.id,
    email: user.email_display,
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    verified: Boolean(user.verified_at),
    createdAt: user.created_at
  };
}

async function accountSession(request, env, { required = true } = {}) {
  const token = bearerToken(request);
  if (!token) return required ? { error: accountError("authentication_required", "Sign in to continue.", 401) } : { user: null };
  const tokenHash = await sha256(token);
  const now = accountNow();
  const row = await env.DB.prepare(
    "SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.* FROM bridge_sessions s " +
    "JOIN bridge_users u ON u.id = s.user_id " +
    "WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.disabled_at IS NULL AND u.deleted_at IS NULL"
  ).bind(tokenHash, now).first();
  if (!row) return { error: accountError("authentication_required", "Your session has expired. Sign in again.", 401) };
  if (!row.verified_at) return { error: accountError("email_verification_required", "Verify your email before syncing Bridge data.", 403) };
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1000) {
    await env.DB.prepare("UPDATE bridge_sessions SET last_seen_at = ?1 WHERE id = ?2").bind(now, row.session_id).run();
  }
  return { user: row, sessionId: row.session_id, rawToken: token };
}

async function accountConsumeToken(env, rawToken, purpose) {
  if (!rawToken || String(rawToken).length > 256) return null;
  return env.DB.prepare(
    "SELECT t.id AS token_id, t.user_id, u.* FROM bridge_account_tokens t " +
    "JOIN bridge_users u ON u.id = t.user_id " +
    "WHERE t.token_hash = ?1 AND t.purpose = ?2 AND t.used_at IS NULL AND t.expires_at > ?3 AND u.deleted_at IS NULL"
  ).bind(await sha256(rawToken), purpose, accountNow()).first();
}

async function accountNextCursor(env, userId) {
  const now = accountNow();
  await env.DB.prepare("INSERT OR IGNORE INTO bridge_user_sync (user_id, next_cursor, updated_at) VALUES (?1, 0, ?2)").bind(userId, now).run();
  const row = await env.DB.prepare("UPDATE bridge_user_sync SET next_cursor = next_cursor + 1, updated_at = ?2 WHERE user_id = ?1 RETURNING next_cursor").bind(userId, now).first();
  return Number(row?.next_cursor || 0);
}

function accountSafeRecord(value) {
  const source = value && typeof value === "object" ? value : {};
  const type = String(source.type || "");
  const id = String(source.id || "");
  if (!ACCOUNT_RECORD_TYPES.has(type) || !id || id.length > 160) return null;
  const expectedRevision = Math.max(0, Math.floor(Number(source.expectedRevision) || 0));
  const deleted = Boolean(source.deleted);
  const payload = deleted ? null : source.payload;
  if (!deleted && (!payload || typeof payload !== "object" || Array.isArray(payload))) return null;
  const payloadJSON = deleted ? null : JSON.stringify(payload);
  if (payloadJSON && payloadJSON.length > 1_000_000) return null;
  return { type, id, expectedRevision, deleted, payloadJSON };
}

function accountRecordResponse(row) {
  let payload = null;
  if (row.payload_json) {
    try { payload = JSON.parse(row.payload_json); } catch {}
  }
  return {
    type: row.record_type,
    id: row.record_id,
    payload,
    revision: Number(row.revision || 0),
    cursor: Number(row.sync_cursor || 0),
    deletedAt: row.deleted_at || null,
    updatedAt: row.updated_at
  };
}

async function accountApplyMutation(env, userId, clientId, mutation) {
  const previous = await env.DB.prepare("SELECT result_json FROM bridge_sync_mutations WHERE user_id = ?1 AND mutation_id = ?2").bind(userId, mutation.mutationId).first();
  if (previous?.result_json) {
    try { return { ...JSON.parse(previous.result_json), idempotent: true }; } catch {}
  }
  const record = accountSafeRecord(mutation.record);
  if (!record) return { mutationId: mutation.mutationId, status: "invalid" };
  const existing = await env.DB.prepare("SELECT * FROM bridge_crm_records WHERE user_id = ?1 AND record_type = ?2 AND record_id = ?3").bind(userId, record.type, record.id).first();
  const serverRevision = Number(existing?.revision || 0);
  if (serverRevision !== record.expectedRevision) {
    return {
      mutationId: mutation.mutationId,
      status: "conflict",
      serverRecord: existing ? accountRecordResponse(existing) : null
    };
  }
  const cursor = await accountNextCursor(env, userId);
  const revision = serverRevision + 1;
  const now = accountNow();
  let result;
  if (existing) {
    const update = await env.DB.prepare(
      "UPDATE bridge_crm_records SET payload_json = ?1, revision = ?2, sync_cursor = ?3, updated_at = ?4, deleted_at = ?5 " +
      "WHERE user_id = ?6 AND record_type = ?7 AND record_id = ?8 AND revision = ?9"
    ).bind(record.payloadJSON, revision, cursor, now, record.deleted ? now : null, userId, record.type, record.id, serverRevision).run();
    if (!update.meta?.changes) {
      const latest = await env.DB.prepare("SELECT * FROM bridge_crm_records WHERE user_id = ?1 AND record_type = ?2 AND record_id = ?3").bind(userId, record.type, record.id).first();
      return { mutationId: mutation.mutationId, status: "conflict", serverRecord: latest ? accountRecordResponse(latest) : null };
    }
  } else {
    const insert = await env.DB.prepare(
      "INSERT OR IGNORE INTO bridge_crm_records (user_id, record_type, record_id, payload_json, revision, sync_cursor, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)"
    ).bind(userId, record.type, record.id, record.payloadJSON, revision, cursor, now, record.deleted ? now : null).run();
    if (!insert.meta?.changes) {
      const latest = await env.DB.prepare("SELECT * FROM bridge_crm_records WHERE user_id = ?1 AND record_type = ?2 AND record_id = ?3").bind(userId, record.type, record.id).first();
      return { mutationId: mutation.mutationId, status: "conflict", serverRecord: latest ? accountRecordResponse(latest) : null };
    }
  }
  result = { mutationId: mutation.mutationId, status: "applied", record: { type: record.type, id: record.id, revision, cursor, deletedAt: record.deleted ? now : null, updatedAt: now } };
  await env.DB.prepare("INSERT INTO bridge_sync_mutations (user_id, mutation_id, client_id, result_json, applied_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(userId, mutation.mutationId, clientId, JSON.stringify(result), now).run();
  return result;
}

async function accountPullRecords(env, userId, cursor = 0) {
  const result = await env.DB.prepare(
    "SELECT record_type, record_id, payload_json, revision, sync_cursor, updated_at, deleted_at FROM bridge_crm_records WHERE user_id = ?1 AND sync_cursor > ?2 ORDER BY sync_cursor ASC LIMIT 2000"
  ).bind(userId, Math.max(0, Math.floor(Number(cursor) || 0))).all();
  const current = await env.DB.prepare("SELECT next_cursor FROM bridge_user_sync WHERE user_id = ?1").bind(userId).first();
  return {
    records: (result.results || []).map(accountRecordResponse),
    cursor: Number(current?.next_cursor || 0),
    hasMore: (result.results || []).length === 2000
  };
}

async function accountAssembleState(env, userId) {
  const result = await env.DB.prepare(
    "SELECT record_type, record_id, payload_json FROM bridge_crm_records WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY record_type, record_id"
  ).bind(userId).all();
  const state = { contacts: [], places: [], settings: {}, analytics: {}, meta: { version: 1 } };
  for (const row of result.results || []) {
    let payload;
    try { payload = JSON.parse(row.payload_json); } catch { continue; }
    if (row.record_type === "contact") state.contacts.push(payload);
    else if (row.record_type === "place") state.places.push(payload);
    else if (row.record_type === "settings") state.settings = payload;
    else if (row.record_type === "analytics") state.analytics = payload;
    else if (row.record_type === "meta") state.meta = payload;
  }
  return state;
}

async function accountWriteBackup(env, userId, reason = "manual") {
  if (!env.USER_BACKUPS) return { ok: false, configurationError: true };
  const backupId = crypto.randomUUID();
  const createdAt = accountNow();
  await env.DB.prepare("INSERT INTO bridge_backup_runs (id, user_id, status, created_at) VALUES (?1, ?2, 'running', ?3)").bind(backupId, userId, createdAt).run();
  try {
    const state = await accountAssembleState(env, userId);
    const document = JSON.stringify({
      format: "bridge-cloud-backup",
      version: 1,
      userId,
      createdAt,
      reason,
      state
    });
    const contentHash = await sha256(document);
    const objectKey = "users/" + userId + "/backups/" + createdAt.replace(/[:.]/g, "-") + "-" + backupId + ".json";
    await env.USER_BACKUPS.put(objectKey, document, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { userId, createdAt, reason, contentHash }
    });
    const retentionDays = reason === "pre-delete" ? 30 : 90;
    await env.DB.prepare("UPDATE bridge_backup_runs SET status = 'complete', object_key = ?1, content_hash = ?2, byte_size = ?3, completed_at = ?4, expires_at = ?5 WHERE id = ?6")
      .bind(objectKey, contentHash, textEncoder.encode(document).byteLength, accountNow(), accountFuture(retentionDays * 86400000), backupId).run();
    return { ok: true, id: backupId, createdAt, contentHash };
  } catch (error) {
    await env.DB.prepare("UPDATE bridge_backup_runs SET status = 'failed', error_message = ?1, completed_at = ?2 WHERE id = ?3")
      .bind(String(error?.message || error).slice(0, 500), accountNow(), backupId).run();
    return { ok: false };
  }
}

function accountBackupRecords(state) {
  const records = [];
  for (const contact of Array.isArray(state?.contacts) ? state.contacts : []) {
    if (contact?.id) records.push({ type: "contact", id: String(contact.id), payload: contact });
  }
  for (const place of Array.isArray(state?.places) ? state.places : []) {
    if (place?.id) records.push({ type: "place", id: String(place.id), payload: place });
  }
  records.push({ type: "settings", id: "primary", payload: state?.settings && typeof state.settings === "object" ? state.settings : {} });
  records.push({ type: "analytics", id: "primary", payload: state?.analytics && typeof state.analytics === "object" ? state.analytics : {} });
  records.push({ type: "meta", id: "primary", payload: state?.meta && typeof state.meta === "object" ? state.meta : { version: 1 } });
  return records;
}

function accountValidateBackupDocument(document, userId) {
  if (!document || document.format !== "bridge-cloud-backup" || Number(document.version) !== 1) {
    return { ok: false, code: "invalid_backup", message: "This is not a supported Bridge cloud backup." };
  }
  if (String(document.userId || "") !== String(userId)) {
    return { ok: false, code: "backup_owner_mismatch", message: "This backup belongs to a different Bridge account." };
  }
  if (!document.state || typeof document.state !== "object" || !Array.isArray(document.state.contacts) || !Array.isArray(document.state.places)) {
    return { ok: false, code: "invalid_backup", message: "This backup is missing required Bridge data." };
  }
  const records = accountBackupRecords(document.state);
  if (records.length > ACCOUNT_MAX_BACKUP_RECORDS) {
    return { ok: false, code: "backup_too_large", message: "This backup contains too many records to restore safely." };
  }
  for (const record of records) {
    if (!accountSafeRecord({ ...record, expectedRevision: 0, deleted: false })) {
      return { ok: false, code: "invalid_backup", message: "This backup contains an invalid Bridge record." };
    }
  }
  return { ok: true, records };
}

async function accountReadBackup(env, userId, backupId) {
  if (!env.USER_BACKUPS) return { error: accountError("configuration_error", "Cloud backups are not configured.", 503) };
  const record = await env.DB.prepare(
    "SELECT id, object_key, content_hash, byte_size, created_at, completed_at, expires_at FROM bridge_backup_runs " +
    "WHERE id = ?1 AND user_id = ?2 AND status = 'complete'"
  ).bind(backupId, userId).first();
  if (!record?.object_key) return { error: accountError("not_found", "Backup not found.", 404) };
  const object = await env.USER_BACKUPS.get(record.object_key);
  if (!object) return { error: accountError("not_found", "Backup file not found.", 404) };
  const text = await object.text();
  const contentHash = await sha256(text);
  if (!record.content_hash || !accountConstantTimeEqual(contentHash, record.content_hash)) {
    return { error: accountError("backup_checksum_failed", "This backup did not pass its integrity check.", 409) };
  }
  let document;
  try { document = JSON.parse(text); }
  catch { return { error: accountError("invalid_backup", "This backup cannot be read.", 409) }; }
  const validation = accountValidateBackupDocument(document, userId);
  if (!validation.ok) return { error: accountError(validation.code, validation.message, 409) };
  return { record, text, document, records: validation.records, contentHash };
}

async function accountRestoreBackup(env, userId, backupId) {
  const backup = await accountReadBackup(env, userId, backupId);
  if (backup.error) return backup;
  const snapshot = await accountWriteBackup(env, userId, "pre-restore");
  if (!snapshot.ok) {
    return { error: accountError("pre_restore_backup_failed", "Bridge could not create the required safety backup.", 503) };
  }
  const existingResult = await env.DB.prepare(
    "SELECT record_type, record_id, revision FROM bridge_crm_records WHERE user_id = ?1"
  ).bind(userId).all();
  const existing = new Map((existingResult.results || []).map(row => [
    row.record_type + ":" + row.record_id,
    Number(row.revision || 0)
  ]));
  const incoming = new Map(backup.records.map(record => [record.type + ":" + record.id, record]));
  const applied = [];
  const clientId = "backup-restore:" + backupId;

  for (const [key, revision] of existing) {
    if (incoming.has(key)) continue;
    const separator = key.indexOf(":");
    const result = await accountApplyMutation(env, userId, clientId, {
      mutationId: "restore-delete:" + backupId + ":" + key,
      record: {
        type: key.slice(0, separator),
        id: key.slice(separator + 1),
        expectedRevision: revision,
        deleted: true
      }
    });
    if (result.status !== "applied" && !result.idempotent) {
      return { error: accountError("restore_conflict", "Bridge stopped before overwriting newer cloud data.", 409, { record: key, safetyBackupId: snapshot.id }) };
    }
    applied.push(result);
  }

  for (const [key, record] of incoming) {
    const result = await accountApplyMutation(env, userId, clientId, {
      mutationId: "restore-upsert:" + backupId + ":" + key,
      record: {
        ...record,
        expectedRevision: existing.get(key) || 0,
        deleted: false
      }
    });
    if (result.status !== "applied" && !result.idempotent) {
      return { error: accountError("restore_conflict", "Bridge stopped before overwriting newer cloud data.", 409, { record: key, safetyBackupId: snapshot.id }) };
    }
    applied.push(result);
  }

  return {
    ok: true,
    restoredBackupId: backupId,
    safetyBackupId: snapshot.id,
    restoredRecords: applied.length,
    state: await accountAssembleState(env, userId)
  };
}

async function accountHandleAuth(request, env, url) {
  const path = url.pathname;
  if (path === ACCOUNT_API_PREFIX + "/config" && request.method === "GET") {
    return accountJSON({
      authEnabled: accountEnabled(env),
      turnstileSiteKey: accountTurnstileConfigured(env) ? env.TURNSTILE_SITE_KEY : "",
      emailConfigured: accountEmailConfigured(env),
      cloudBackupConfigured: Boolean(env.USER_BACKUPS),
      sessionTransport: "bearer-indexeddb",
      productionReady: accountEmailConfigured(env) && accountTurnstileConfigured(env) && Boolean(env.USER_BACKUPS)
    });
  }
  if (!accountEnabled(env)) return null;
  if (!env.DB) return accountError("service_unavailable", "Bridge cloud accounts are unavailable.", 503);

  if (path === ACCOUNT_API_PREFIX + "/auth/signup" && request.method === "POST") {
    const body = await accountReadJSON(request);
    const email = normalizeAccountEmail(body.email);
    const limit = await accountRateLimit(env, request, "signup", email, { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    if (!limit.allowed) return accountError("rate_limited", "Too many attempts. Try again later.", 429, { retryAfter: limit.retryAfter });
    const challenge = await accountValidateTurnstile(request, env, body.turnstileToken);
    if (challenge.configurationError) return accountError("configuration_error", "Bridge account protection is not configured.", 503);
    if (!challenge.success) return accountError("verification_failed", "Complete the security check and try again.", 400);
    if (!validAccountEmail(email) || !validAccountPassword(body.password)) {
      return accountError("invalid_signup", "Enter a valid email and a password of at least 12 characters.", 400);
    }
    if (!accountEmailConfigured(env)) return accountError("configuration_error", "Bridge account email is not configured.", 503);
    const existing = await env.DB.prepare("SELECT * FROM bridge_users WHERE email_normalized = ?1 AND deleted_at IS NULL").bind(email).first();
    if (existing?.verified_at) return accountJSON({ ok: true, verificationRequired: true }, 202);
    const password = await accountHashPassword(body.password);
    const now = accountNow();
    const emailDisplay = String(body.email || "").trim();
    const firstName = safeAccountName(body.firstName);
    const lastName = safeAccountName(body.lastName);
    let user = existing;
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email_normalized: email,
        email_display: emailDisplay,
        first_name: firstName,
        last_name: lastName,
        created_at: now
      };
      await env.DB.prepare(
        "INSERT INTO bridge_users (id, email_normalized, email_display, password_hash, password_salt, password_iterations, first_name, last_name, verified_at, created_at, updated_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?9)"
      ).bind(user.id, user.email_normalized, user.email_display, password.hash, password.salt, password.iterations, user.first_name, user.last_name, now).run();
    } else {
      const update = await env.DB.prepare(
        "UPDATE bridge_users SET email_display = ?1, password_hash = ?2, password_salt = ?3, password_iterations = ?4, first_name = ?5, last_name = ?6, updated_at = ?7 " +
        "WHERE id = ?8 AND verified_at IS NULL AND deleted_at IS NULL"
      ).bind(emailDisplay, password.hash, password.salt, password.iterations, firstName, lastName, now, user.id).run();
      if (!update.meta?.changes) return accountJSON({ ok: true, verificationRequired: true }, 202);
      user = {
        ...user,
        email_display: emailDisplay,
        password_hash: password.hash,
        password_salt: password.salt,
        password_iterations: password.iterations,
        first_name: firstName,
        last_name: lastName,
        updated_at: now
      };
    }
    const action = await accountIssueActionToken(env, user, "verify_email", request);
    const sent = await accountSendActionEmail(env, user, "verify_email", action.rawToken);
    if (!sent.ok) return accountError("email_unavailable", "Bridge could not send a verification email. Try again later.", 503);
    return accountJSON({ ok: true, verificationRequired: true }, 202);
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/verify-email" && request.method === "POST") {
    const body = await accountReadJSON(request, 8192);
    const user = await accountConsumeToken(env, body.token, "verify_email");
    if (!user) return accountError("invalid_token", "This verification link is invalid or expired.", 400);
    const now = accountNow();
    await env.DB.batch([
      env.DB.prepare("UPDATE bridge_users SET verified_at = COALESCE(verified_at, ?1), updated_at = ?1 WHERE id = ?2").bind(now, user.user_id),
      env.DB.prepare("UPDATE bridge_account_tokens SET used_at = ?1 WHERE id = ?2").bind(now, user.token_id)
    ]);
    return accountJSON({ ok: true });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/resend-verification" && request.method === "POST") {
    const body = await accountReadJSON(request, 16384);
    const email = normalizeAccountEmail(body.email);
    const limit = await accountRateLimit(env, request, "resend-verification", email, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000
    });
    if (!limit.allowed) return accountJSON({ ok: true }, 202);
    const challenge = await accountValidateTurnstile(request, env, body.turnstileToken);
    if (challenge.configurationError) return accountError("configuration_error", "Bridge account protection is not configured.", 503);
    if (!challenge.success) return accountError("verification_failed", "Complete the security check and try again.", 400);
    const user = validAccountEmail(email)
      ? await env.DB.prepare(
          "SELECT * FROM bridge_users WHERE email_normalized = ?1 AND verified_at IS NULL AND disabled_at IS NULL AND deleted_at IS NULL"
        ).bind(email).first()
      : null;
    if (user && accountEmailConfigured(env)) {
      const action = await accountIssueActionToken(env, user, "verify_email", request);
      await accountSendActionEmail(env, user, "verify_email", action.rawToken);
    }
    return accountJSON({ ok: true }, 202);
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/login" && request.method === "POST") {
    const body = await accountReadJSON(request);
    const email = normalizeAccountEmail(body.email);
    const limit = await accountRateLimit(env, request, "login", email, { limit: 8 });
    if (!limit.allowed) return accountError("rate_limited", "Too many attempts. Try again later.", 429, { retryAfter: limit.retryAfter });
    const challenge = await accountValidateTurnstile(request, env, body.turnstileToken);
    if (challenge.configurationError) return accountError("configuration_error", "Bridge account protection is not configured.", 503);
    if (!challenge.success) return accountError("verification_failed", "Complete the security check and try again.", 400);
    const user = validAccountEmail(email)
      ? await env.DB.prepare("SELECT * FROM bridge_users WHERE email_normalized = ?1 AND disabled_at IS NULL AND deleted_at IS NULL").bind(email).first()
      : null;
    const valid = user ? await accountVerifyPassword(body.password, user) : false;
    if (!valid) return accountError("invalid_credentials", "Email or password is incorrect.", 401);
    if (!user.verified_at) return accountError("email_verification_required", "Verify your email before signing in.", 403);
    const session = await accountCreateSession(request, env, user, Boolean(body.rememberMe));
    return accountJSON({ sessionToken: session.rawToken, expiresAt: session.expiresAt, user: accountPublicUser(user) });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/forgot-password" && request.method === "POST") {
    const body = await accountReadJSON(request, 16384);
    const email = normalizeAccountEmail(body.email);
    const limit = await accountRateLimit(env, request, "forgot", email, { limit: 4, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    if (!limit.allowed) return accountJSON({ ok: true }, 202);
    const challenge = await accountValidateTurnstile(request, env, body.turnstileToken);
    if (!challenge.success) return accountError("verification_failed", "Complete the security check and try again.", 400);
    const user = validAccountEmail(email)
      ? await env.DB.prepare("SELECT * FROM bridge_users WHERE email_normalized = ?1 AND verified_at IS NOT NULL AND disabled_at IS NULL AND deleted_at IS NULL").bind(email).first()
      : null;
    if (user && accountEmailConfigured(env)) {
      const action = await accountIssueActionToken(env, user, "reset_password", request);
      await accountSendActionEmail(env, user, "reset_password", action.rawToken);
    }
    return accountJSON({ ok: true }, 202);
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/reset-password" && request.method === "POST") {
    const body = await accountReadJSON(request, 16384);
    if (!validAccountPassword(body.password)) return accountError("invalid_password", "Use a password of at least 12 characters.", 400);
    const user = await accountConsumeToken(env, body.token, "reset_password");
    if (!user) return accountError("invalid_token", "This reset link is invalid or expired.", 400);
    const password = await accountHashPassword(body.password);
    const now = accountNow();
    await env.DB.batch([
      env.DB.prepare("UPDATE bridge_users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, updated_at = ?4 WHERE id = ?5")
        .bind(password.hash, password.salt, password.iterations, now, user.user_id),
      env.DB.prepare("UPDATE bridge_account_tokens SET used_at = ?1 WHERE id = ?2").bind(now, user.token_id),
      env.DB.prepare("UPDATE bridge_sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL").bind(now, user.user_id)
    ]);
    return accountJSON({ ok: true });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/session" && request.method === "GET") {
    const session = await accountSession(request, env);
    if (session.error) return session.error;
    return accountJSON({ user: accountPublicUser(session.user), expiresAt: session.user.expires_at });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/logout" && request.method === "POST") {
    const session = await accountSession(request, env);
    if (session.error) return session.error;
    await env.DB.prepare("UPDATE bridge_sessions SET revoked_at = ?1 WHERE id = ?2").bind(accountNow(), session.sessionId).run();
    return accountJSON({ ok: true });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/sessions" && request.method === "GET") {
    const session = await accountSession(request, env);
    if (session.error) return session.error;
    const rows = await env.DB.prepare(
      "SELECT id, created_at, expires_at, last_seen_at FROM bridge_sessions " +
      "WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2 ORDER BY last_seen_at DESC"
    ).bind(session.user.id, accountNow()).all();
    return accountJSON({
      sessions: (rows.results || []).map(row => ({
        id: row.id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        lastSeenAt: row.last_seen_at,
        current: row.id === session.sessionId
      }))
    });
  }

  const sessionMatch = path.match(/^\/api\/v1\/auth\/sessions\/([A-Za-z0-9-]{20,80})$/);
  if (sessionMatch && request.method === "DELETE") {
    const session = await accountSession(request, env);
    if (session.error) return session.error;
    const result = await env.DB.prepare(
      "UPDATE bridge_sessions SET revoked_at = ?1 WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL"
    ).bind(accountNow(), sessionMatch[1], session.user.id).run();
    if (!result.meta?.changes) return accountError("not_found", "Session not found.", 404);
    return accountJSON({ ok: true, currentSessionRevoked: sessionMatch[1] === session.sessionId });
  }

  if (path === ACCOUNT_API_PREFIX + "/auth/change-password" && request.method === "POST") {
    const session = await accountSession(request, env);
    if (session.error) return session.error;
    const body = await accountReadJSON(request, 16384);
    if (!await accountVerifyPassword(body.currentPassword, session.user)) return accountError("invalid_credentials", "Current password is incorrect.", 401);
    if (!validAccountPassword(body.newPassword)) return accountError("invalid_password", "Use a password of at least 12 characters.", 400);
    const password = await accountHashPassword(body.newPassword);
    const now = accountNow();
    await env.DB.batch([
      env.DB.prepare("UPDATE bridge_users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, updated_at = ?4 WHERE id = ?5")
        .bind(password.hash, password.salt, password.iterations, now, session.user.id),
      env.DB.prepare("UPDATE bridge_sessions SET revoked_at = ?1 WHERE user_id = ?2 AND id <> ?3 AND revoked_at IS NULL")
        .bind(now, session.user.id, session.sessionId)
    ]);
    return accountJSON({ ok: true });
  }

  return null;
}

async function accountHandleCloudData(request, env, url) {
  if (!accountEnabled(env) || !url.pathname.startsWith(ACCOUNT_API_PREFIX + "/")) return null;
  const session = await accountSession(request, env);
  if (session.error) return session.error;
  const userId = session.user.id;

  if (url.pathname === ACCOUNT_API_PREFIX + "/account" && request.method === "GET") {
    return accountJSON({ user: accountPublicUser(session.user) });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/account" && request.method === "PATCH") {
    const body = await accountReadJSON(request, 16384);
    const firstName = safeAccountName(body.firstName);
    const lastName = safeAccountName(body.lastName);
    await env.DB.prepare(
      "UPDATE bridge_users SET first_name = ?1, last_name = ?2, updated_at = ?3 WHERE id = ?4"
    ).bind(firstName, lastName, accountNow(), userId).run();
    const updated = await env.DB.prepare("SELECT * FROM bridge_users WHERE id = ?1").bind(userId).first();
    return accountJSON({ user: accountPublicUser(updated) });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/sync/pull" && request.method === "GET") {
    return accountJSON(await accountPullRecords(env, userId, url.searchParams.get("cursor")));
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/sync/push" && request.method === "POST") {
    const body = await accountReadJSON(request);
    const clientId = String(body.clientId || "").slice(0, 160);
    const mutations = Array.isArray(body.mutations) ? body.mutations.slice(0, 250) : [];
    if (!clientId || !mutations.length) return accountError("invalid_sync", "A client ID and at least one mutation are required.", 400);
    const results = [];
    for (const source of mutations) {
      const mutationId = String(source?.mutationId || "").slice(0, 160);
      if (!mutationId) { results.push({ mutationId: "", status: "invalid" }); continue; }
      results.push(await accountApplyMutation(env, userId, clientId, { ...source, mutationId }));
    }
    const pulled = await accountPullRecords(env, userId, Number(body.cursor || 0));
    return accountJSON({ results, ...pulled });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/migrations/local" && request.method === "GET") {
    const key = String(url.searchParams.get("key") || "").slice(0, 160);
    const record = key
      ? await env.DB.prepare("SELECT completed_at, source_fingerprint FROM bridge_local_migrations WHERE user_id = ?1 AND migration_key = ?2").bind(userId, key).first()
      : null;
    return accountJSON({ completed: Boolean(record), completedAt: record?.completed_at || null, sourceFingerprint: record?.source_fingerprint || null });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/migrations/local" && request.method === "POST") {
    const body = await accountReadJSON(request, 16384);
    const key = String(body.key || "").slice(0, 160);
    if (!key) return accountError("invalid_migration", "A migration key is required.", 400);
    await env.DB.prepare("INSERT OR IGNORE INTO bridge_local_migrations (user_id, migration_key, completed_at, source_fingerprint) VALUES (?1, ?2, ?3, ?4)")
      .bind(userId, key, accountNow(), String(body.sourceFingerprint || "").slice(0, 256) || null).run();
    return accountJSON({ ok: true });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/account/export" && request.method === "GET") {
    const state = await accountAssembleState(env, userId);
    return accountJSON({
      format: "bridge-account-export",
      version: 1,
      exportedAt: accountNow(),
      user: accountPublicUser(session.user),
      state
    }, 200, { "content-disposition": 'attachment; filename="bridge-account-export.json"' });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/backups" && request.method === "POST") {
    const backup = await accountWriteBackup(env, userId, "manual");
    if (backup.configurationError) return accountError("configuration_error", "Cloud backups are not configured.", 503);
    if (!backup.ok) return accountError("backup_failed", "Bridge could not create a cloud backup.", 500);
    return accountJSON(backup, 201);
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/backups" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id, status, byte_size, created_at, completed_at, expires_at FROM bridge_backup_runs WHERE user_id = ?1 AND status <> 'deleted' ORDER BY created_at DESC LIMIT 50").bind(userId).all();
    return accountJSON({ backups: rows.results || [] });
  }

  const backupPreviewMatch = url.pathname.match(/^\/api\/v1\/backups\/([A-Za-z0-9-]{20,80})\/preview$/);
  if (backupPreviewMatch && request.method === "GET") {
    const backup = await accountReadBackup(env, userId, backupPreviewMatch[1]);
    if (backup.error) return backup.error;
    return accountJSON({
      id: backup.record.id,
      createdAt: backup.document.createdAt,
      reason: backup.document.reason,
      checksum: backup.contentHash,
      counts: {
        contacts: backup.document.state.contacts.length,
        places: backup.document.state.places.length,
        records: backup.records.length
      }
    });
  }

  const backupRestoreMatch = url.pathname.match(/^\/api\/v1\/backups\/([A-Za-z0-9-]{20,80})\/restore$/);
  if (backupRestoreMatch && request.method === "POST") {
    const body = await accountReadJSON(request, 16384);
    if (!await accountVerifyPassword(body.password, session.user)) {
      return accountError("invalid_credentials", "Password is incorrect.", 401);
    }
    if (String(body.confirmation || "") !== "RESTORE") {
      return accountError("confirmation_required", "Type RESTORE to confirm this replacement.", 400);
    }
    const restored = await accountRestoreBackup(env, userId, backupRestoreMatch[1]);
    if (restored.error) return restored.error;
    return accountJSON(restored);
  }

  const backupMatch = url.pathname.match(/^\/api\/v1\/backups\/([A-Za-z0-9-]{20,80})$/);
  if (backupMatch && request.method === "GET") {
    const backup = await accountReadBackup(env, userId, backupMatch[1]);
    if (backup.error) return backup.error;
    return new Response(backup.text, {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="bridge-cloud-backup.json"',
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        "x-bridge-content-hash": backup.contentHash
      }
    });
  }

  if (url.pathname === ACCOUNT_API_PREFIX + "/account" && request.method === "DELETE") {
    const body = await accountReadJSON(request, 16384);
    if (!await accountVerifyPassword(body.password, session.user)) return accountError("invalid_credentials", "Password is incorrect.", 401);
    if (String(body.confirmation || "") !== "DELETE") return accountError("confirmation_required", "Type DELETE to confirm account deletion.", 400);
    const now = accountNow();
    if (env.USER_BACKUPS) {
      const backup = await accountWriteBackup(env, userId, "pre-delete");
      if (!backup.ok) return accountError("backup_failed", "Bridge could not create the required deletion backup.", 503);
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE bridge_users SET deleted_at = ?1, email_normalized = ?2, email_display = '', password_hash = '', password_salt = '', updated_at = ?1 WHERE id = ?3")
        .bind(now, "deleted-" + userId + "@invalid.local", userId),
      env.DB.prepare("UPDATE bridge_sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE bridge_push_subscriptions SET disabled_at = ?1 WHERE user_id = ?2 AND disabled_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE bridge_shared_scorecards SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL").bind(now, userId),
      env.DB.prepare("DELETE FROM bridge_crm_records WHERE user_id = ?1").bind(userId),
      env.DB.prepare("DELETE FROM bridge_sync_mutations WHERE user_id = ?1").bind(userId),
      env.DB.prepare("DELETE FROM bridge_local_migrations WHERE user_id = ?1").bind(userId),
      env.DB.prepare("DELETE FROM bridge_user_sync WHERE user_id = ?1").bind(userId),
      env.DB.prepare("UPDATE bridge_account_tokens SET used_at = ?1 WHERE user_id = ?2 AND used_at IS NULL").bind(now, userId)
    ]);
    return accountJSON({ ok: true });
  }

  return null;
}

async function handleAccountRequest(request, env, url) {
  try {
    const authResponse = await accountHandleAuth(request, env, url);
    if (authResponse) return authResponse;
    return accountHandleCloudData(request, env, url);
  } catch (error) {
    console.error("Bridge account request failed", {
      path: url.pathname,
      code: error?.code || "internal_error",
      message: String(error?.message || error)
    });
    return accountError(error?.code || "internal_error", error?.status ? String(error.message) : "Bridge could not complete that request.", error?.status || 500);
  }
}

async function runScheduledAccountBackups(env) {
  if (!accountEnabled(env) || !env.DB || !env.USER_BACKUPS) return { ok: false, skipped: true };
  const users = await env.DB.prepare(
    "SELECT id FROM bridge_users WHERE verified_at IS NOT NULL AND disabled_at IS NULL AND deleted_at IS NULL " +
    "AND NOT EXISTS (SELECT 1 FROM bridge_backup_runs b WHERE b.user_id = bridge_users.id AND b.status = 'complete' AND b.created_at > ?1) LIMIT 100"
  ).bind(new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()).all();
  let completed = 0;
  for (const user of users.results || []) {
    const result = await accountWriteBackup(env, user.id, "scheduled");
    if (result.ok) completed += 1;
  }
  const expired = await env.DB.prepare("SELECT id, object_key FROM bridge_backup_runs WHERE status = 'complete' AND expires_at < ?1 LIMIT 200").bind(accountNow()).all();
  for (const backup of expired.results || []) {
    if (backup.object_key) await env.USER_BACKUPS.delete(backup.object_key);
    await env.DB.prepare("UPDATE bridge_backup_runs SET status = 'deleted' WHERE id = ?1").bind(backup.id).run();
  }
  return { ok: true, completed, expired: (expired.results || []).length };
}
