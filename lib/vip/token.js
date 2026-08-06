import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { defaultTokenTtlSeconds } from './config.js';

/**
 * Signed QR payloads.
 *
 * A QR code never carries a secret and is never a database lookup key that an
 * attacker could enumerate. It carries a *signed claim*:
 *
 *     https://vipparkingalicante.com/r/<base64url(payload)>.<base64url(mac)>
 *
 * The MAC is an HMAC-SHA256 over the encoded payload, truncated to 128 bits.
 * Without VIP_QR_SECRET nobody can mint a QR that attributes reviews to a driver,
 * which is what stops drivers from farming each other's (or fake) credit.
 *
 * Payload keys are single letters to keep the QR small enough to stay crisp when
 * printed on a keychain tag:
 *   v  version        d  driver id       n  driver name (denormalised fallback)
 *   b  booking ref    c  vehicle         i  issued at (unix seconds)
 *   x  expires at (unix seconds, omitted for permanent driver badges)
 *   j  jti, random id that makes each booking QR unique
 */

const VERSION = 1;
const MAC_BYTES = 16;

let warnedAboutDevSecret = false;

function secret() {
    const configured = process.env.VIP_QR_SECRET;
    if (configured && configured.length >= 16) return configured;

    // Keep local development and preview deploys working, but make it loud.
    if (!warnedAboutDevSecret) {
        warnedAboutDevSecret = true;
        console.warn(
            '[vip] VIP_QR_SECRET is not set (or is shorter than 16 chars). ' +
                'Falling back to an insecure development secret — set a real one before printing QR codes.'
        );
    }
    return 'vip-parking-development-secret-do-not-use-in-production';
}

function b64url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function macFor(encodedPayload) {
    return createHmac('sha256', secret()).update(encodedPayload).digest().subarray(0, MAC_BYTES);
}

/**
 * Build the token that goes inside a QR code.
 *
 * @param {object} claim
 * @param {string} claim.driverId
 * @param {string} claim.driverName
 * @param {string} [claim.bookingRef]
 * @param {string} [claim.vehicle]
 * @param {number|null} [claim.ttlSeconds] null => permanent badge QR
 * @param {number} [claim.issuedAt] unix seconds, defaults to now
 */
export function signToken({ driverId, driverName, bookingRef, vehicle, ttlSeconds, issuedAt } = {}) {
    if (!driverId) throw new Error('signToken: driverId is required');

    const now = issuedAt ?? Math.floor(Date.now() / 1000);
    const payload = { v: VERSION, d: driverId, i: now };

    if (driverName) payload.n = driverName;
    if (bookingRef) payload.b = bookingRef;
    if (vehicle) payload.c = vehicle;

    // ttlSeconds === null is an explicit "permanent driver badge".
    if (ttlSeconds !== null) {
        payload.x = now + (ttlSeconds ?? defaultTokenTtlSeconds);
        payload.j = randomBytes(4).toString('base64url');
    }

    const encoded = b64url(JSON.stringify(payload));
    return `${encoded}.${b64url(macFor(encoded))}`;
}

/**
 * Verify and decode a token from a scanned QR.
 * Never throws — callers get a discriminated result they can render.
 *
 * @returns {{ok: true, claim: object} | {ok: false, reason: 'malformed'|'bad-signature'|'expired'}}
 */
export function verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };

    const [encoded, providedMac] = token.split('.');
    if (!encoded || !providedMac) return { ok: false, reason: 'malformed' };

    let provided;
    try {
        provided = Buffer.from(providedMac, 'base64url');
    } catch {
        return { ok: false, reason: 'malformed' };
    }

    const expected = macFor(encoded);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return { ok: false, reason: 'bad-signature' };
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        return { ok: false, reason: 'malformed' };
    }
    if (!payload || payload.v !== VERSION || !payload.d) return { ok: false, reason: 'malformed' };

    if (payload.x && payload.x < Math.floor(Date.now() / 1000)) {
        return { ok: false, reason: 'expired' };
    }

    return {
        ok: true,
        claim: {
            driverId: String(payload.d),
            driverName: payload.n ? String(payload.n) : '',
            bookingRef: payload.b ? String(payload.b) : '',
            vehicle: payload.c ? String(payload.c) : '',
            issuedAt: payload.i ?? null,
            expiresAt: payload.x ?? null,
            permanent: !payload.x
        }
    };
}

/** Absolute URL a QR code should encode. */
export function reviewUrlForToken(token, origin) {
    const base = (origin || process.env.NEXT_PUBLIC_VIP_ORIGIN || 'https://vipparkingalicante.com').replace(
        /\/+$/,
        ''
    );
    return `${base}/r/${token}`;
}
