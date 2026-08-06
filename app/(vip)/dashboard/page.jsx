import { requireDashboard } from 'lib/vip/guard';
import { loadEvents, summarise, recentPrivateFeedback } from 'lib/vip/events';
import { listDrivers } from 'lib/vip/drivers';
import { dashboardProtected } from 'lib/vip/auth';
import { DailyChart, RatingHistogram } from './charts';

export const dynamic = 'force-dynamic';

const RANGE_DAYS = 30;

function Tile({ label, value, hint }) {
    return (
        <div className="dash-panel">
            <p className="dash-tile-label">{label}</p>
            <p className="dash-tile-value mt-1">{value}</p>
            {hint && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--vip-text-muted)' }}>
                    {hint}
                </p>
            )}
        </div>
    );
}

/** Fill gaps so a quiet day still shows up as a quiet day rather than vanishing. */
function fillDays(daily, days) {
    const byDate = new Map(daily.map((row) => [row.date, row]));
    const filled = [];

    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - i);
        const key = date.toISOString().slice(0, 10);
        filled.push(byDate.get(key) || { date: key, scans: 0, posted: 0, averageRating: 0 });
    }
    return filled;
}

export default async function DashboardPage() {
    await requireDashboard();

    const [events, drivers] = await Promise.all([loadEvents({ days: RANGE_DAYS }), listDrivers()]);
    const { totals, leaderboard, daily, monthly, ratingHistogram } = summarise(events, { drivers });
    const feedback = recentPrivateFeedback(events, 8);

    const medals = ['🥇', '🥈', '🥉'];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Review performance</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                        Last {RANGE_DAYS} days
                    </p>
                </div>
            </div>

            {!dashboardProtected() && (
                <p
                    className="text-sm rounded-xl p-3"
                    style={{ background: 'color-mix(in oklab, #eab308 18%, var(--vip-surface))' }}
                >
                    <strong>This dashboard is unprotected.</strong> Set <code>VIP_DASHBOARD_PASSWORD</code> in your
                    Netlify environment variables before sharing the link.
                </p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile label="Reviews posted" value={totals.posted} hint={`${totals.scans} QR scans`} />
                <Tile
                    label="Average rating"
                    value={totals.averageRating ? `${totals.averageRating.toFixed(2)} ★` : '—'}
                    hint={`${totals.fiveStars} five-star ratings`}
                />
                <Tile
                    label="Conversion rate"
                    value={`${totals.conversionRate}%`}
                    hint="Scan → confirmed Google review"
                />
                <Tile
                    label="Reached Google"
                    value={`${totals.handoffRate}%`}
                    hint={`${totals.handoffs} handoffs to the review composer`}
                />
            </div>

            <div className="dash-panel">
                <DailyChart data={fillDays(daily, RANGE_DAYS)} title="Daily activity" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="dash-panel">
                    <RatingHistogram histogram={ratingHistogram} title="Rating distribution" />
                </div>

                <div className="dash-panel">
                    <h2 className="text-base font-bold">Monthly totals</h2>
                    <div className="dash-scroll mt-3">
                        <table className="dash-table">
                            <thead>
                                <tr>
                                    <th scope="col">Month</th>
                                    <th scope="col">Scans</th>
                                    <th scope="col">Posted</th>
                                    <th scope="col">Avg rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthly.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ color: 'var(--vip-text-muted)' }}>
                                            No data yet.
                                        </td>
                                    </tr>
                                )}
                                {monthly.map((row) => (
                                    <tr key={row.month}>
                                        <td>{row.month}</td>
                                        <td>{row.scans}</td>
                                        <td>{row.posted}</td>
                                        <td>{row.averageRating ? `${row.averageRating.toFixed(2)} ★` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="dash-panel">
                <h2 className="text-base font-bold">Driver leaderboard</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                    Ranked by confirmed Google reviews, then by average rating.
                </p>
                <div className="dash-scroll mt-3">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Driver</th>
                                <th scope="col">Posted</th>
                                <th scope="col">Scans</th>
                                <th scope="col">Conversion</th>
                                <th scope="col">Avg rating</th>
                                <th scope="col">5★</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ color: 'var(--vip-text-muted)' }}>
                                        Add drivers and print their QR codes to get started.
                                    </td>
                                </tr>
                            )}
                            {leaderboard.map((row, index) => (
                                <tr key={row.driverId}>
                                    <td>{medals[index] || index + 1}</td>
                                    <td className="font-semibold">{row.driverName}</td>
                                    <td>{row.posted}</td>
                                    <td>{row.scans}</td>
                                    <td>{row.conversionRate}%</td>
                                    <td>{row.averageRating ? `${row.averageRating.toFixed(2)} ★` : '—'}</td>
                                    <td>{row.fiveStars}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="dash-panel">
                <h2 className="text-base font-bold">Private feedback</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                    Sent straight to the manager and never published. Treat these as service recovery.
                </p>
                <ul className="mt-3 space-y-3">
                    {feedback.length === 0 && (
                        <li className="text-sm" style={{ color: 'var(--vip-text-muted)' }}>
                            Nothing here — that is good news.
                        </li>
                    )}
                    {feedback.map((entry) => (
                        <li key={entry.id} className="text-sm border-t pt-3" style={{ borderColor: 'var(--vip-border)' }}>
                            <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--vip-text-muted)' }}>
                                <span>{new Date(entry.createdAt).toLocaleString()}</span>
                                <span>· {entry.driverName || entry.driverId}</span>
                                {entry.rating && <span>· {entry.rating} ★</span>}
                                {entry.bookingRef && <span>· {entry.bookingRef}</span>}
                            </div>
                            <p className="mt-1">{entry.comment}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
