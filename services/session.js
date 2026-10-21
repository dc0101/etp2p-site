// Shared client-side session limits for the marketplace and trade page.
export const LAST_ACTIVE_KEY = "etp2p_auth_last_active";
export const SESSION_STARTED_KEY = "etp2p_auth_started_at";
export const SESSION_USER_KEY = "etp2p_auth_user_id";
export const REAUTH_REQUIRED_KEY = "etp2p_reauth_required";

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

const ACTIVITY_WRITE_THROTTLE_MS = 5000;
let lastActivityWriteAt = 0;

function storedTime(key) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function lastSignInTime(user) {
  const value = Date.parse(user?.last_sign_in_at || "");
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function clearSessionTracking() {
  localStorage.removeItem(LAST_ACTIVE_KEY);
  localStorage.removeItem(SESSION_STARTED_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
  lastActivityWriteAt = 0;
}

export function beginSessionTracking(session) {
  const userId = session?.user?.id;
  if (!userId) {
    clearSessionTracking();
    return false;
  }

  const now = Date.now();
  const startedAt = lastSignInTime(session.user) || now;
  localStorage.setItem(SESSION_USER_KEY, userId);
  localStorage.setItem(SESSION_STARTED_KEY, String(startedAt));
  localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  lastActivityWriteAt = now;
  return true;
}

export function ensureSessionTracking(session) {
  const userId = session?.user?.id;
  if (!userId) {
    clearSessionTracking();
    return false;
  }

  const now = Date.now();
  const signedInAt = lastSignInTime(session.user);
  const previousUserId = localStorage.getItem(SESSION_USER_KEY);
  let startedAt = storedTime(SESSION_STARTED_KEY);
  let lastActiveAt = storedTime(LAST_ACTIVE_KEY);

  if (previousUserId && previousUserId !== userId) {
    startedAt = signedInAt || now;
    lastActiveAt = signedInAt || now;
  } else {
    // Migrate the prior idle marker and Supabase sign-in timestamp on first use.
    startedAt = startedAt || signedInAt || lastActiveAt || now;
    lastActiveAt = lastActiveAt || signedInAt || now;
  }

  localStorage.setItem(SESSION_USER_KEY, userId);
  localStorage.setItem(SESSION_STARTED_KEY, String(startedAt));
  localStorage.setItem(LAST_ACTIVE_KEY, String(lastActiveAt));
  lastActivityWriteAt = lastActiveAt;
  return !isSessionExpired(now);
}

export function isSessionExpired(now = Date.now()) {
  const lastActiveAt = storedTime(LAST_ACTIVE_KEY);
  const startedAt = storedTime(SESSION_STARTED_KEY);
  if (!lastActiveAt || !startedAt) return true;
  if (lastActiveAt > now + 60_000 || startedAt > now + 60_000) return true;
  return now - lastActiveAt >= IDLE_TIMEOUT_MS || now - startedAt >= ABSOLUTE_TIMEOUT_MS;
}

export function recordSessionActivity(now = Date.now()) {
  if (isSessionExpired(now)) return false;

  const lastActiveAt = storedTime(LAST_ACTIVE_KEY);
  if (
    now - lastActivityWriteAt >= ACTIVITY_WRITE_THROTTLE_MS &&
    now - lastActiveAt >= ACTIVITY_WRITE_THROTTLE_MS
  ) {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
    lastActivityWriteAt = now;
  }
  return true;
}

export function markReauthenticationRequired() {
  localStorage.setItem(REAUTH_REQUIRED_KEY, "1");
}

export function consumeReauthenticationRequired() {
  const required = localStorage.getItem(REAUTH_REQUIRED_KEY) === "1";
  localStorage.removeItem(REAUTH_REQUIRED_KEY);
  return required;
}
