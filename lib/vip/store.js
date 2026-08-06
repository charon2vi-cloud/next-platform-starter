import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * Thin persistence layer over Netlify Blobs.
 *
 * On Netlify (deploys, `netlify dev`) this is backed by Netlify Blobs. Plain
 * `next dev` has no Blobs runtime, so we transparently fall back to a JSON file
 * store under .netlify/vip-dev-store/ — the app stays fully usable locally
 * instead of crashing on every read.
 */

const fallbackRoot = path.join(process.cwd(), '.netlify', 'vip-dev-store');
const blobStores = new Map();
let blobsUnavailable = false;

async function blobStore(name) {
    if (blobsUnavailable) return null;
    if (blobStores.has(name)) return blobStores.get(name);

    try {
        const { getStore } = await import('@netlify/blobs');
        const store = getStore({ name, consistency: 'strong' });
        blobStores.set(name, store);
        return store;
    } catch (error) {
        blobsUnavailable = true;
        console.warn(`[vip] Netlify Blobs unavailable (${error.message}); using local file store.`);
        return null;
    }
}

// Keys contain "/" (e.g. "2026-08-06/abc"); encode them into flat filenames.
const encodeKey = (key) => encodeURIComponent(key);
const decodeKey = (file) => decodeURIComponent(file.replace(/\.json$/, ''));

function fallbackPath(name, key) {
    return path.join(fallbackRoot, name, `${encodeKey(key)}.json`);
}

export async function putJSON(name, key, value) {
    const store = await blobStore(name);
    if (store) {
        await store.setJSON(key, value);
        return;
    }
    const file = fallbackPath(name, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value), 'utf8');
}

export async function getJSON(name, key) {
    const store = await blobStore(name);
    if (store) {
        try {
            return await store.get(key, { type: 'json' });
        } catch {
            return null;
        }
    }
    try {
        return JSON.parse(await readFile(fallbackPath(name, key), 'utf8'));
    } catch {
        return null;
    }
}

export async function removeKey(name, key) {
    const store = await blobStore(name);
    if (store) {
        await store.delete(key);
        return;
    }
    try {
        await unlink(fallbackPath(name, key));
    } catch {
        /* already gone */
    }
}

export async function listKeys(name, prefix = '') {
    const store = await blobStore(name);
    if (store) {
        try {
            const { blobs } = await store.list({ prefix });
            return blobs.map((blob) => blob.key);
        } catch {
            return [];
        }
    }
    try {
        const files = await readdir(path.join(fallbackRoot, name));
        return files.map(decodeKey).filter((key) => key.startsWith(prefix));
    } catch {
        return [];
    }
}

/** Read every value under a prefix. Concurrency-capped so large ranges stay polite. */
export async function listJSON(name, prefix = '', { limit = 5000 } = {}) {
    const keys = (await listKeys(name, prefix)).slice(0, limit);
    const results = [];
    const batchSize = 25;

    for (let i = 0; i < keys.length; i += batchSize) {
        const batch = await Promise.all(keys.slice(i, i + batchSize).map((key) => getJSON(name, key)));
        for (const value of batch) if (value) results.push(value);
    }
    return results;
}

export const STORES = {
    drivers: 'vip-drivers',
    events: 'vip-events'
};
