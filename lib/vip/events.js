import { randomUUID } from 'node:crypto';
import { STORES, listJSON, putJSON } from './store.js';

/**
 * Funnel events. Every scan writes a trail so the dashboard can show a real
 * conversion rate rather than just a review count.
 *
 *   scan      QR opened the page
 *   rated     customer picked a star rating
 *   feedback  customer sent private feedback (kept internal, never published)
 *   handoff   customer was sent to Google's review composer
 *   posted    customer came back and confirmed they posted it
 */
export const EVENT_TYPES = ['scan', 'rated', 'feedback', 'handoff', 'posted'];

/** Events are keyed `YYYY-MM-DD/<uuid>` so a date range is a cheap prefix list. */
function keyFor(date, id) {
    return `${dayKey(date)}/${id}`;
}

export function dayKey(date = new Date()) {
    return new Date(date).toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
    return new Date(date).toISOString().slice(0, 7);
}

export async function recordEvent(event) {
    if (!EVENT_TYPES.includes(event.type)) throw new Error(`recordEvent: unknown type ${event.type}`);

    const now = new Date();
    const record = {
        id: randomUUID(),
        type: event.type,
        driverId: event.driverId || 'unknown',
        driverName: event.driverName || '',
        bookingRef: event.bookingRef || '',
        rating: typeof event.rating === 'number' ? event.rating : null,
        comment: typeof event.comment === 'string' ? event.comment.slice(0, 2000) : '',
        language: event.language || '',
        sessionId: event.sessionId || '',
        createdAt: now.toISOString()
    };

    await putJSON(STORES.events, keyFor(now, record.id), record);
    return record;
}

/** Every event from the last `days` days (inclusive of today). */
export async function loadEvents({ days = 30 } = {}) {
    const prefixes = [];
    for (let i = 0; i < days; i += 1) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - i);
        prefixes.push(`${dayKey(date)}/`);
    }

    const batches = await Promise.all(prefixes.map((prefix) => listJSON(STORES.events, prefix)));
    return batches.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function emptyDriverRow(driverId, driverName) {
    return {
        driverId,
        driverName: driverName || driverId,
        scans: 0,
        rated: 0,
        handoffs: 0,
        posted: 0,
        privateFeedback: 0,
        ratingSum: 0,
        ratingCount: 0,
        fiveStars: 0,
        averageRating: 0,
        conversionRate: 0
    };
}

function finalise(row) {
    row.averageRating = row.ratingCount ? Number((row.ratingSum / row.ratingCount).toFixed(2)) : 0;
    // Conversion = "scanned the QR" -> "confirmed the review was posted on Google".
    row.conversionRate = row.scans ? Number(((row.posted / row.scans) * 100).toFixed(1)) : 0;
    row.handoffRate = row.scans ? Number(((row.handoffs / row.scans) * 100).toFixed(1)) : 0;
    return row;
}

/**
 * Roll raw events up into everything the dashboard renders.
 * Deliberately computed on read: at valet-desk volumes this is a handful of
 * blob reads, and it means no aggregate can ever drift out of sync.
 */
export function summarise(events, { drivers = [] } = {}) {
    const totals = emptyDriverRow('all', 'All drivers');
    const byDriver = new Map();
    const byDay = new Map();
    const byMonth = new Map();
    const ratingHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const driver of drivers) byDriver.set(driver.id, emptyDriverRow(driver.id, driver.name));

    for (const event of events) {
        if (!byDriver.has(event.driverId)) {
            byDriver.set(event.driverId, emptyDriverRow(event.driverId, event.driverName));
        }
        const driverRow = byDriver.get(event.driverId);
        if (event.driverName && driverRow.driverName === driverRow.driverId) {
            driverRow.driverName = event.driverName;
        }

        const day = event.createdAt.slice(0, 10);
        const month = event.createdAt.slice(0, 7);
        if (!byDay.has(day)) byDay.set(day, { date: day, scans: 0, posted: 0, ratingSum: 0, ratingCount: 0 });
        if (!byMonth.has(month)) {
            byMonth.set(month, { month, scans: 0, posted: 0, ratingSum: 0, ratingCount: 0 });
        }
        const dayRow = byDay.get(day);
        const monthRow = byMonth.get(month);

        for (const row of [totals, driverRow]) {
            if (event.type === 'scan') row.scans += 1;
            if (event.type === 'rated') row.rated += 1;
            if (event.type === 'handoff') row.handoffs += 1;
            if (event.type === 'posted') row.posted += 1;
            if (event.type === 'feedback') row.privateFeedback += 1;
        }

        if (event.type === 'scan') {
            dayRow.scans += 1;
            monthRow.scans += 1;
        }
        if (event.type === 'posted') {
            dayRow.posted += 1;
            monthRow.posted += 1;
        }

        // Only the `rated` event carries the authoritative star value, so
        // averages can never be double-counted by later funnel steps.
        if (event.type === 'rated' && event.rating >= 1 && event.rating <= 5) {
            for (const row of [totals, driverRow]) {
                row.ratingSum += event.rating;
                row.ratingCount += 1;
                if (event.rating === 5) row.fiveStars += 1;
            }
            dayRow.ratingSum += event.rating;
            dayRow.ratingCount += 1;
            monthRow.ratingSum += event.rating;
            monthRow.ratingCount += 1;
            ratingHistogram[event.rating] += 1;
        }
    }

    const withAverage = (row) => ({
        ...row,
        averageRating: row.ratingCount ? Number((row.ratingSum / row.ratingCount).toFixed(2)) : 0
    });

    return {
        totals: finalise(totals),
        leaderboard: [...byDriver.values()]
            .map(finalise)
            .sort((a, b) => b.posted - a.posted || b.averageRating - a.averageRating || b.scans - a.scans),
        daily: [...byDay.values()].map(withAverage).sort((a, b) => a.date.localeCompare(b.date)),
        monthly: [...byMonth.values()].map(withAverage).sort((a, b) => a.month.localeCompare(b.month)),
        ratingHistogram
    };
}

/** Most recent private (low-rating) feedback, for the dashboard's service-recovery list. */
export function recentPrivateFeedback(events, limit = 20) {
    return events.filter((event) => event.type === 'feedback' && event.comment).slice(0, limit);
}
