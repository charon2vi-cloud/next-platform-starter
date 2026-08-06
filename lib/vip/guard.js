import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, dashboardProtected, verifySession } from './auth.js';

/**
 * Call at the top of every dashboard page. Redirects to the login screen unless
 * the request carries a valid session cookie.
 */
export async function requireDashboard() {
    if (!dashboardProtected()) return { open: true };

    const store = await cookies();
    if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
        redirect('/dashboard/login');
    }
    return { open: false };
}
