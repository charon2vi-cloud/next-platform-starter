'use client';

import { useMemo } from 'react';

const COLOURS = ['#d4af37', '#f2cf5b', '#ffffff', '#7aa2ff', '#4ade80'];

/** Pure-CSS confetti: no canvas, no library, nothing to load on a phone data connection. */
export function Confetti({ pieces = 70 }) {
    const shards = useMemo(
        () =>
            Array.from({ length: pieces }, (_, index) => ({
                id: index,
                left: Math.random() * 100,
                drift: `${(Math.random() - 0.5) * 40}vw`,
                spin: `${Math.random() * 900 - 450}deg`,
                duration: `${2.2 + Math.random() * 1.8}s`,
                delay: `${Math.random() * 0.7}s`,
                colour: COLOURS[index % COLOURS.length],
                round: index % 4 === 0
            })),
        [pieces]
    );

    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-50">
            {shards.map((shard) => (
                <span
                    key={shard.id}
                    className="vip-confetti-piece"
                    style={{
                        left: `${shard.left}%`,
                        background: shard.colour,
                        borderRadius: shard.round ? '50%' : '2px',
                        '--vip-drift': shard.drift,
                        '--vip-spin': shard.spin,
                        '--vip-duration': shard.duration,
                        '--vip-delay': shard.delay
                    }}
                />
            ))}
        </div>
    );
}
