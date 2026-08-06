import Link from 'next/link';
import { requireDashboard } from 'lib/vip/guard';
import { listDrivers } from 'lib/vip/drivers';
import { deleteDriverAction } from '../actions';
import { DriverForm } from './driver-form';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
    await requireDashboard();
    const drivers = await listDrivers();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Drivers</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                    A driver only needs to exist here to get a photo and a tidy display name. Their signed QR code
                    keeps working either way.
                </p>
            </div>

            <div className="dash-panel">
                <DriverForm />
            </div>

            <div className="dash-panel">
                <div className="dash-scroll">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th scope="col">Driver</th>
                                <th scope="col">ID</th>
                                <th scope="col">Added</th>
                                <th scope="col" />
                            </tr>
                        </thead>
                        <tbody>
                            {drivers.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ color: 'var(--vip-text-muted)' }}>
                                        No drivers yet. Add the first one above.
                                    </td>
                                </tr>
                            )}
                            {drivers.map((driver) => (
                                <tr key={driver.id}>
                                    <td>
                                        <span className="flex items-center gap-2.5">
                                            {driver.photoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={driver.photoUrl}
                                                    alt=""
                                                    className="rounded-full object-cover"
                                                    style={{ width: 32, height: 32 }}
                                                />
                                            ) : (
                                                <span
                                                    aria-hidden="true"
                                                    className="grid place-items-center rounded-full text-xs font-bold"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        background: 'var(--color-vip-gold)',
                                                        color: '#101a2e'
                                                    }}
                                                >
                                                    {driver.name.slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                            <span className="font-semibold">{driver.name}</span>
                                        </span>
                                    </td>
                                    <td>
                                        <code>{driver.id}</code>
                                    </td>
                                    <td>{new Date(driver.createdAt).toLocaleDateString()}</td>
                                    <td className="text-right whitespace-nowrap">
                                        <Link href={`/dashboard/qr?driver=${driver.id}`} className="text-sm">
                                            QR code
                                        </Link>
                                        <form action={deleteDriverAction} className="inline ml-3">
                                            <input type="hidden" name="id" value={driver.id} />
                                            <button
                                                type="submit"
                                                className="text-sm"
                                                style={{ background: 'none', border: 0, cursor: 'pointer', color: '#c0392b' }}
                                            >
                                                Remove
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
