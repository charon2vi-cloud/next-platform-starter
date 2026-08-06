'use client';

export function PrintButton({ children = 'Print badges' }) {
    return (
        <button type="button" className="vip-btn vip-btn-secondary sm:w-auto dash-no-print" onClick={() => window.print()}>
            🖨 {children}
        </button>
    );
}
