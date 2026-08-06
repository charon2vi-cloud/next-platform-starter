import { NextResponse } from 'next/server';
import { recordEvent, EVENT_TYPES } from 'lib/vip/events';

export const dynamic = 'force-dynamic';

/**
 * Funnel beacon from the review page.
 *
 * This endpoint is intentionally unauthenticated — it is called from a public
 * page by customers who have no account. It is therefore treated as untrusted:
 * only known event types are accepted, fields are clamped, and nothing here can
 * mint driver credit that a signed QR did not already grant.
 */
export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    if (!EVENT_TYPES.includes(payload?.type)) {
        return NextResponse.json({ error: 'unknown event type' }, { status: 400 });
    }

    const rating = Number(payload.rating);

    try {
        await recordEvent({
            type: payload.type,
            driverId: String(payload.driverId || 'unknown').slice(0, 64),
            driverName: String(payload.driverName || '').slice(0, 80),
            bookingRef: String(payload.bookingRef || '').slice(0, 40),
            rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
            comment: String(payload.comment || '').slice(0, 2000),
            language: String(payload.language || '').slice(0, 5),
            sessionId: String(payload.sessionId || '').slice(0, 64)
        });
    } catch (error) {
        console.error('[vip] failed to record event', error);
        return NextResponse.json({ error: 'could not record event' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
