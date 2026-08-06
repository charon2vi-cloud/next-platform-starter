'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions';

export default function LoginPage() {
    const [state, formAction, pending] = useActionState(loginAction, {});

    return (
        <div className="max-w-sm mx-auto pt-16">
            <h1 className="text-2xl font-extrabold tracking-tight">Dashboard sign in</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--vip-text-muted)' }}>
                Enter the manager password to see review performance.
            </p>

            <form action={formAction} className="mt-6 space-y-3">
                <label className="block">
                    <span className="text-sm font-semibold">Password</span>
                    <input
                        className="dash-input mt-1.5"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        required
                        autoFocus
                    />
                </label>

                {state?.error && (
                    <p className="text-sm" role="alert" style={{ color: '#c0392b' }}>
                        {state.error}
                    </p>
                )}

                <button type="submit" className="vip-btn vip-btn-primary" disabled={pending}>
                    {pending ? 'Checking…' : 'Sign in'}
                </button>
            </form>
        </div>
    );
}
