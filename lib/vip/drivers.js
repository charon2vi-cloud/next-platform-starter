import { STORES, getJSON, listJSON, putJSON, removeKey } from './store.js';

/** Turn a display name into a stable, URL-safe driver id. */
export function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}

export async function listDrivers() {
    const drivers = await listJSON(STORES.drivers);
    return drivers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDriver(id) {
    if (!id) return null;
    return getJSON(STORES.drivers, id);
}

export async function saveDriver({ id, name, photoUrl = '', languages = [], active = true }) {
    const driverId = id || slugify(name);
    if (!driverId) throw new Error('saveDriver: a driver needs a name');

    const existing = await getDriver(driverId);
    const driver = {
        id: driverId,
        name: String(name || existing?.name || driverId).trim(),
        photoUrl: photoUrl || existing?.photoUrl || '',
        languages: languages.length ? languages : existing?.languages || [],
        active,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await putJSON(STORES.drivers, driverId, driver);
    return driver;
}

export async function deleteDriver(id) {
    await removeKey(STORES.drivers, id);
}

/**
 * The driver shown on the review page.
 * The signed token already carries a name, so a scan still renders correctly
 * even before the driver has been added to the roster.
 */
export async function resolveDriver(claim) {
    const stored = await getDriver(claim.driverId);
    return {
        id: claim.driverId,
        name: stored?.name || claim.driverName || 'your driver',
        photoUrl: stored?.photoUrl || '',
        known: Boolean(stored)
    };
}
