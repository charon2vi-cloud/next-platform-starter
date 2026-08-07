import './qr.css';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { requireDashboard } from 'lib/vip/guard';
import { listDrivers } from 'lib/vip/drivers';
import { signToken, reviewUrlForToken } from 'lib/vip/token';
import { brand, defaultTokenTtlSeconds } from 'lib/vip/config';
import { PrintButton } from './print-button';
import { CopyLink } from './copy-link';

export const dynamic = 'force-dynamic';

/** Where the QR should point. Explicit env wins; otherwise trust the request host. */
async function origin() {
    if (process.env.NEXT_PUBLIC_VIP_ORIGIN) return process.env.NEXT_PUBLIC_VIP_ORIGIN;

    const headerList = await headers();
    const host = headerList.get('x-forwarded-host') || headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
    return host ? `${protocol}://${host}` : 'https://vipparkingalicante.com';
}

function renderQr(url) {
    // Error-correction level M survives a scuffed, laminated badge without
    // bloating the code; higher levels make the modules too small to scan fast.
    return QRCode.toString(url, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#101a2eff', light: '#ffffffff' }
    });
}

function Badge({ title, subtitle, svg, url }) {
    return (
        <div className="qr-badge">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-60">{brand.shortName}</p>
            <div className="mt-2" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-2 text-base font-extrabold leading-tight">{title}</p>
            {subtitle && <p className="text-[11px] opacity-70 mt-0.5">{subtitle}</p>}
            <p className="mt-2 text-[9px] opacity-45 break-all leading-tight">{url}</p>
        </div>
    );
}

export default async function QrStudioPage({ searchParams }) {
    await requireDashboard();

    const params = await searchParams;
    const [drivers, base] = await Promise.all([listDrivers(), origin()]);

    const bookingRef = String(params?.booking || '').trim();
    const vehicle = String(params?.vehicle || '').trim();
    const selectedDriver = String(params?.driver || '').trim();

    // Permanent badge QR for every driver — printed once, used for every handover.
    const badges = await Promise.all(
        drivers.map(async (driver) => {
            const url = reviewUrlForToken(
                signToken({ driverId: driver.id, driverName: driver.name, ttlSeconds: null }),
                base
            );
            return { driver, url, svg: await renderQr(url) };
        })
    );

    // Optional one-off QR bound to a single booking.
    let bookingBadge = null;
    if (selectedDriver && (bookingRef || vehicle)) {
        const driver = drivers.find((entry) => entry.id === selectedDriver);
        const url = reviewUrlForToken(
            signToken({
                driverId: selectedDriver,
                driverName: driver?.name || selectedDriver,
                bookingRef,
                vehicle,
                ttlSeconds: defaultTokenTtlSeconds
            }),
            base
        );
        bookingBadge = {
            url,
            svg: await renderQr(url),
            title: driver?.name || selectedDriver,
            subtitle: [bookingRef, vehicle].filter(Boolean).join(' · ')
        };
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">QR studio</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                        Every code is cryptographically signed, so a review can only ever be credited to the driver
                        whose badge was actually scanned.
                    </p>
                </div>
                <PrintButton />
            </div>

            <div className="dash-panel dash-no-print">
                <h2 className="text-base font-bold">Simple links — for Adobe, Canva or any QR maker</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                    Copy a link and paste it into whichever QR generator you like. These are short, permanent, and
                    readable out loud. The customer lands on the review screen with the driver already filled in.
                </p>

                <div className="mt-4 space-y-4">
                    <div>
                        <p className="text-sm font-semibold">Whole team — one code for everyone</p>
                        <p className="text-xs mb-1.5" style={{ color: 'var(--vip-text-muted)' }}>
                            The customer taps whoever handed their car back.
                        </p>
                        <CopyLink url={base} label="team" />
                    </div>

                    {drivers.map((driver) => (
                        <div key={driver.id}>
                            <p className="text-sm font-semibold">{driver.name}</p>
                            <CopyLink url={`${base}/d/${driver.id}`} label={driver.name} />
                        </div>
                    ))}

                    {drivers.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--vip-text-muted)' }}>
                            Add drivers first and their links appear here.
                        </p>
                    )}
                </div>
            </div>

            <div className="dash-panel dash-no-print">
                <h2 className="text-base font-bold">One-off booking code</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--vip-text-muted)' }}>
                    Optional. Adds the booking reference and vehicle to the customer&apos;s screen, and expires after{' '}
                    {Math.round(defaultTokenTtlSeconds / 86400)} days.
                </p>

                <form className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end mt-4">
                    <label className="block">
                        <span className="text-sm font-semibold">Driver</span>
                        <select className="dash-input mt-1.5" name="driver" defaultValue={selectedDriver} required>
                            <option value="">Select…</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-sm font-semibold">Booking ref</span>
                        <input className="dash-input mt-1.5" name="booking" defaultValue={bookingRef} placeholder="VP-88213" />
                    </label>
                    <label className="block">
                        <span className="text-sm font-semibold">Vehicle</span>
                        <input className="dash-input mt-1.5" name="vehicle" defaultValue={vehicle} placeholder="BMW X5 · 1234 ABC" />
                    </label>
                    <button type="submit" className="vip-btn vip-btn-primary sm:w-auto">
                        Generate
                    </button>
                </form>

                {bookingBadge && (
                    <div className="mt-5 max-w-[240px]">
                        <Badge
                            title={bookingBadge.title}
                            subtitle={bookingBadge.subtitle}
                            svg={bookingBadge.svg}
                            url={bookingBadge.url}
                        />
                    </div>
                )}
            </div>

            <div className="dash-panel">
                <h2 className="text-base font-bold">Driver badges</h2>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--vip-text-muted)' }}>
                    Ready-made codes — print once, laminate, clip to the lanyard. These carry a signature, so unlike
                    the simple links above they cannot be forged to credit the wrong driver.
                </p>

                {badges.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--vip-text-muted)' }}>
                        Add drivers first and their badges appear here.
                    </p>
                ) : (
                    <div className="qr-grid">
                        {badges.map((badge) => (
                            <Badge
                                key={badge.driver.id}
                                title={badge.driver.name}
                                subtitle="Scan to leave a review"
                                svg={badge.svg}
                                url={badge.url}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
