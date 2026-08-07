'use client';

import { useState } from 'react';

/** Click-to-copy field holding a plain review URL, ready to paste into any QR generator. */
export function CopyLink({ url, label }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const area = document.createElement('textarea');
            area.value = url;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2">
            <input className="dash-input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} />
            <button
                type="button"
                onClick={copy}
                aria-label={`Copy ${label} link`}
                className="vip-btn vip-btn-secondary shrink-0"
                style={{ width: 'auto', minHeight: '2.75rem', paddingInline: '1rem', fontSize: '0.875rem' }}
            >
                {copied ? '✓ Copied' : 'Copy'}
            </button>
        </div>
    );
}
