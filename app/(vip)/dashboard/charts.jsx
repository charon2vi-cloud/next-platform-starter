'use client';

import { useState } from 'react';

/*
 * Hand-built charts: no charting library ships to the browser, which keeps the
 * dashboard fast on a phone at the valet desk.
 *
 * Colour is assigned by role and validated (lightness band, chroma floor, CVD
 * separation, contrast) for both the light and dark chart surfaces — see
 * dashboard.css .viz-root.
 */

const SERIES = [
    { key: 'scans', label: 'QR scans', colour: 'var(--series-scans)' },
    { key: 'posted', label: 'Reviews posted', colour: 'var(--series-posted)' }
];

function Legend() {
    return (
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--vip-text-muted)' }}>
            {SERIES.map((series) => (
                <span key={series.key} className="inline-flex items-center gap-1.5">
                    <span className="viz-legend-swatch" style={{ background: series.colour }} />
                    {series.label}
                </span>
            ))}
        </div>
    );
}

function TableView({ caption, rows, columns }) {
    return (
        <details className="mt-3">
            <summary className="text-xs cursor-pointer" style={{ color: 'var(--vip-text-muted)' }}>
                View as table
            </summary>
            <div className="dash-scroll mt-2">
                <table className="dash-table">
                    <caption className="sr-only">{caption}</caption>
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key} scope="col">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index}>
                                {columns.map((column) => (
                                    <td key={column.key}>{row[column.key]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

/** Grouped bars: scans vs reviews posted, one pair per day. */
export function DailyChart({ data, title }) {
    const [hovered, setHovered] = useState(null);

    if (!data.length) {
        return <EmptyChart title={title} />;
    }

    const max = Math.max(1, ...data.map((row) => Math.max(row.scans, row.posted)));
    const peakIndex = data.reduce((best, row, index) => (row.posted > data[best].posted ? index : best), 0);

    return (
        <section className="viz-root">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">{title}</h2>
                <Legend />
            </div>

            {/* pt-6 reserves room for the peak's direct label; the baseline rule and the
                max tick are the only chrome — grid lines would compete with 60 thin bars. */}
            <div className="relative mt-4 pt-6 dash-scroll">
                <span
                    className="absolute left-0 top-0 text-[11px] tabular-nums"
                    style={{ color: 'var(--vip-text-muted)' }}
                >
                    {max}
                </span>
                <div
                    className="flex items-end gap-[3px] h-44 min-w-full"
                    style={{ minWidth: data.length * 18, borderBottom: '1px solid var(--viz-grid)' }}
                >
                    {data.map((row, index) => (
                        <div
                            key={row.date}
                            className="viz-col relative flex-1 flex items-end justify-center gap-[2px] h-full"
                            onMouseEnter={() => setHovered(index)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(index)}
                            onBlur={() => setHovered(null)}
                            tabIndex={0}
                            aria-label={`${row.date}: ${row.scans} scans, ${row.posted} posted`}
                        >
                            {SERIES.map((series) => (
                                <div
                                    key={series.key}
                                    className="viz-bar w-full"
                                    style={{
                                        // A floor of 2px keeps a zero day visible as a day.
                                        height: `max(2px, ${(row[series.key] / max) * 100}%)`,
                                        background: series.colour,
                                        maxWidth: 7
                                    }}
                                />
                            ))}

                            {index === peakIndex && row.posted > 0 && (
                                <span
                                    className="absolute -top-5 text-[11px] font-semibold whitespace-nowrap"
                                    style={{ color: 'var(--vip-text)' }}
                                >
                                    {row.posted}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {hovered !== null && (
                    <div
                        className="viz-tooltip"
                        style={{
                            left: `min(calc(100% - 9rem), ${(hovered / Math.max(1, data.length - 1)) * 100}%)`,
                            top: -8
                        }}
                    >
                        <div className="font-semibold">{data[hovered].date}</div>
                        {SERIES.map((series) => (
                            <div key={series.key} className="flex items-center gap-1.5">
                                <span className="viz-legend-swatch" style={{ background: series.colour }} />
                                {series.label}: {data[hovered][series.key]}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-between mt-2 text-[11px]" style={{ color: 'var(--vip-text-muted)' }}>
                <span>{data[0]?.date}</span>
                <span>{data[data.length - 1]?.date}</span>
            </div>

            <TableView
                caption={title}
                rows={data}
                columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'scans', label: 'Scans' },
                    { key: 'posted', label: 'Posted' },
                    { key: 'averageRating', label: 'Avg rating' }
                ]}
            />
        </section>
    );
}

/**
 * Rating distribution. One hue, stepped light to dark with rating — a sequential
 * ramp, because 1★–5★ is an ordered magnitude, not five separate identities.
 */
const RAMP = ['#e8d59a', '#dcc072', '#cfa93f', '#b8901f', '#8f6d13'];

export function RatingHistogram({ histogram, title }) {
    const [hovered, setHovered] = useState(null);
    const entries = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: histogram[stars] || 0 }));
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);

    if (!total) return <EmptyChart title={title} />;

    return (
        <section className="viz-root">
            <h2 className="text-base font-bold">{title}</h2>
            <div className="mt-4 space-y-2">
                {entries.map((entry) => {
                    const share = (entry.count / total) * 100;
                    return (
                        <div
                            key={entry.stars}
                            className="flex items-center gap-3"
                            onMouseEnter={() => setHovered(entry.stars)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <span className="w-10 text-xs tabular-nums" style={{ color: 'var(--vip-text-muted)' }}>
                                {entry.stars} ★
                            </span>
                            <div className="grow h-3 rounded-full overflow-hidden" style={{ background: 'var(--vip-surface-2)' }}>
                                <div
                                    style={{
                                        width: `${Math.max(share, entry.count ? 1.5 : 0)}%`,
                                        height: '100%',
                                        borderRadius: 4,
                                        background: RAMP[entry.stars - 1],
                                        opacity: hovered && hovered !== entry.stars ? 0.55 : 1,
                                        transition: 'opacity 0.15s ease'
                                    }}
                                />
                            </div>
                            <span className="w-20 text-right text-xs tabular-nums">
                                {entry.count} · {share.toFixed(0)}%
                            </span>
                        </div>
                    );
                })}
            </div>

            <TableView
                caption={title}
                rows={entries.map((entry) => ({
                    stars: `${entry.stars} star`,
                    count: entry.count,
                    share: `${((entry.count / total) * 100).toFixed(1)}%`
                }))}
                columns={[
                    { key: 'stars', label: 'Rating' },
                    { key: 'count', label: 'Count' },
                    { key: 'share', label: 'Share' }
                ]}
            />
        </section>
    );
}

function EmptyChart({ title }) {
    return (
        <section>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="mt-6 mb-6 text-sm text-center" style={{ color: 'var(--vip-text-muted)' }}>
                No data yet — it appears here as soon as the first QR code is scanned.
            </p>
        </section>
    );
}
