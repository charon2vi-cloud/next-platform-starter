'use client';

const StarIcon = ({ filled }) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <path
            d="M12 2.6l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.42l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.6z"
            fill={filled ? 'url(#vip-star-gradient)' : 'transparent'}
            stroke={filled ? 'none' : 'currentColor'}
            strokeWidth="1.4"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * The rating selector. Large hit targets (56px+) because this is tapped
 * one-handed, outdoors, often while holding luggage.
 */
export function StarRating({ value, onChange, labels }) {
    return (
        <div>
            <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                    <linearGradient id="vip-star-gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f2cf5b" />
                        <stop offset="100%" stopColor="#d4af37" />
                    </linearGradient>
                </defs>
            </svg>

            <div
                role="radiogroup"
                aria-label={labels[4]}
                className="flex items-center justify-center gap-1.5 sm:gap-2.5"
            >
                {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= value;
                    return (
                        <button
                            key={star}
                            type="button"
                            role="radio"
                            aria-checked={value === star}
                            aria-label={`${star} — ${labels[star - 1]}`}
                            onClick={() => onChange(star)}
                            className="p-1.5 transition-transform duration-200 active:scale-90"
                            style={{
                                width: 'min(18vw, 4.25rem)',
                                height: 'min(18vw, 4.25rem)',
                                color: 'var(--vip-text-muted)',
                                // Each newly lit star pops a beat after the previous one.
                                animation: filled ? `vip-pop 0.36s var(--ease-vip) ${(star - 1) * 0.045}s both` : 'none'
                            }}
                        >
                            <StarIcon filled={filled} />
                        </button>
                    );
                })}
            </div>

            <p
                aria-live="polite"
                className="mt-3 text-center text-lg font-semibold min-h-7"
                style={{ color: value ? 'var(--color-vip-gold)' : 'transparent' }}
            >
                {value ? labels[value - 1] : '—'}
            </p>
        </div>
    );
}
