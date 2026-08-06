'use client';

import { useActionState } from 'react';
import { saveDriverAction } from '../actions';

export function DriverForm() {
    const [state, formAction, pending] = useActionState(saveDriverAction, {});

    return (
        <form action={formAction} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block">
                <span className="text-sm font-semibold">Driver name</span>
                <input className="dash-input mt-1.5" name="name" placeholder="Sofiane" required />
            </label>

            <label className="block">
                <span className="text-sm font-semibold">Photo URL (optional)</span>
                <input className="dash-input mt-1.5" name="photoUrl" type="url" placeholder="https://…/sofiane.jpg" />
            </label>

            <button type="submit" className="vip-btn vip-btn-primary sm:w-auto" disabled={pending}>
                {pending ? 'Saving…' : 'Add driver'}
            </button>

            {state?.error && (
                <p className="sm:col-span-3 text-sm" role="alert" style={{ color: '#c0392b' }}>
                    {state.error}
                </p>
            )}
            {state?.message && (
                <p className="sm:col-span-3 text-sm" role="status" style={{ color: '#15803d' }}>
                    {state.message}
                </p>
            )}
        </form>
    );
}
