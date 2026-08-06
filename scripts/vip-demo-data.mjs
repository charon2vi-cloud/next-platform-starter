/**
 * Fills the review system with plausible demo activity so the dashboard can be
 * evaluated before the first real QR code is printed.
 *
 *   node scripts/vip-demo-data.mjs          # 30 days of activity
 *   node scripts/vip-demo-data.mjs 60       # 60 days
 *
 * Writes through the same storage layer as the app: Netlify Blobs when it is
 * available, otherwise the local .netlify/vip-dev-store/ fallback.
 */

import { randomUUID } from 'node:crypto';
import { STORES, putJSON } from '../lib/vip/store.js';
import { saveDriver } from '../lib/vip/drivers.js';

const DAYS = Number(process.argv[2]) || 30;

const DRIVERS = [
    { id: 'sofiane', name: 'Sofiane', weight: 1.35 },
    { id: 'marta', name: 'Marta', weight: 1.1 },
    { id: 'diego', name: 'Diego', weight: 0.9 },
    { id: 'anouk', name: 'Anouk', weight: 0.75 },
    { id: 'youssef', name: 'Youssef', weight: 0.6 }
];

const COMMENTS = [
    'Excellent service from VIP Parking Alicante at Alicante airport. Very friendly and professional and super fast drop-off. Delivered by {name} — thank you!',
    'Excellent service from VIP Parking Alicante at Alicante airport. Car was waiting on arrival and vehicle returned spotless. Delivered by {name} — thank you!',
    'Excellent service from VIP Parking Alicante at Alicante airport. Stress-free and easy and would use again. Delivered by {name} — thank you!'
];

const GRIPES = ['I waited too long at the terminal.', 'The meeting point was hard to find.'];
const LANGUAGES = ['en', 'es', 'fr', 'de', 'nl'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

async function write(event, when) {
    const record = { id: randomUUID(), createdAt: when.toISOString(), ...event };
    await putJSON(STORES.events, `${when.toISOString().slice(0, 10)}/${record.id}`, record);
}

for (const driver of DRIVERS) {
    await saveDriver({ id: driver.id, name: driver.name });
}

let scans = 0;
let posted = 0;

for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);

    // Summer weekends at ALC are busy; midweek is not.
    const weekendBoost = [0, 5, 6].includes(date.getUTCDay()) ? 1.6 : 1;

    for (const driver of DRIVERS) {
        const handovers = Math.round(Math.random() * 4 * driver.weight * weekendBoost);

        for (let i = 0; i < handovers; i += 1) {
            const when = new Date(date);
            when.setUTCHours(7 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

            const base = {
                driverId: driver.id,
                driverName: driver.name,
                bookingRef: `VP-${10000 + Math.floor(Math.random() * 89999)}`,
                language: pick(LANGUAGES),
                sessionId: randomUUID(),
                comment: ''
            };

            await write({ ...base, type: 'scan', rating: null }, when);
            scans += 1;

            // ~80% of scans rate; ~85% of those give five stars.
            if (Math.random() > 0.2) {
                const rating = Math.random() > 0.15 ? 5 : 3 + Math.floor(Math.random() * 2);
                await write({ ...base, type: 'rated', rating }, when);

                if (rating <= 3) {
                    await write({ ...base, type: 'feedback', rating, comment: pick(GRIPES) }, when);
                    continue;
                }

                if (Math.random() > 0.25) {
                    const comment = pick(COMMENTS).replace('{name}', driver.name);
                    await write({ ...base, type: 'handoff', rating, comment }, when);

                    if (Math.random() > 0.2) {
                        await write({ ...base, type: 'posted', rating, comment }, when);
                        posted += 1;
                    }
                }
            }
        }
    }
}

console.log(`Seeded ${DAYS} days: ${scans} scans, ${posted} posted reviews across ${DRIVERS.length} drivers.`);
