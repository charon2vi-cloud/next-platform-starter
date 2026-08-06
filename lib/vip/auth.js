import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Dashboard access.
 *
 * One shared operator password (VIP_DASHBOARD_PASSWORD) exchanged for a signed,
 * expiring cookie. That is the right weight for a valet desk with a handful of
 * managers; swap for real accounts if the team ever needs per-user audit trails.
 */

export const SESSION_COOKIE = 'vip_dashboard';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function signingKey() {
    return process.env.VIP_DASHBOARD_SECRET || process.env.VIP_QR_SECRET || 'vip-dashboard-development-secret';
}

export function dashboardPassword() {
    return process.env.VIP_DASHBOARD_PASSWORD || '';
}

/** No password configured => the dashboard is open. Loud, but better than a false sense of safety. */
export function dashboardProtected() {
    return Boolean(dashboardPassword());
}

export function issueSession(now = Date.now()) {
    const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
    const mac = createHmac('sha256', signingKey()).update(String(expiresAt)).digest('base64url');
    return { value: `${expiresAt}.${mac}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySession(value) {
    if (!value || typeof value !== 'string') return false;

    const [expiresAt, mac] = value.split('.');
    if (!expiresAt || !mac) return false;
    if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;

    const expected = createHmac('sha256', signingKey()).update(expiresAt).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time password comparison so the endpoint can't be timed. */
export function passwordMatches(candidate) {
    const expected = dashboardPassword();
    if (!expected) return true;

    const a = Buffer.from(String(candidate || ''));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}
