'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE, issueSession, passwordMatches, dashboardProtected } from 'lib/vip/auth';
import { requireDashboard } from 'lib/vip/guard';
import { saveDriver, deleteDriver } from 'lib/vip/drivers';

export async function loginAction(_previous, formData) {
    if (!dashboardProtected()) redirect('/dashboard');

    if (!passwordMatches(formData.get('password'))) {
        return { error: 'Incorrect password.' };
    }

    const session = issueSession();
    const store = await cookies();
    store.set(SESSION_COOKIE, session.value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/dashboard',
        maxAge: session.maxAge
    });
    redirect('/dashboard');
}

export async function logoutAction() {
    const store = await cookies();
    store.delete({ name: SESSION_COOKIE, path: '/dashboard' });
    redirect('/dashboard/login');
}

export async function saveDriverAction(_previous, formData) {
    await requireDashboard();

    const name = String(formData.get('name') || '').trim();
    if (!name) return { error: 'A driver needs a name.' };

    try {
        await saveDriver({
            id: String(formData.get('id') || '').trim() || undefined,
            name,
            photoUrl: String(formData.get('photoUrl') || '').trim(),
            active: formData.get('active') !== 'false'
        });
    } catch (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/drivers');
    revalidatePath('/dashboard/qr');
    return { ok: true, message: `Saved ${name}.` };
}

export async function deleteDriverAction(formData) {
    await requireDashboard();
    await deleteDriver(String(formData.get('id') || ''));
    revalidatePath('/dashboard/drivers');
    revalidatePath('/dashboard/qr');
}
