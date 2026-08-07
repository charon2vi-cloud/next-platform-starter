import Link from 'next/link';
import { listDrivers } from 'lib/vip/drivers';
import { getDictionary } from 'lib/vip/i18n';
import { brand } from 'lib/vip/config';
import { preferredLanguage } from './_review/review-screen';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Leave a review',
    robots: { index: false, follow: false }
};

/**
 * The public front door.
 *
 * Doubles as the fallback QR target: print one company-wide code pointing here
 * and the customer taps the driver who handed their car back. That is one code
 * for the whole team instead of one per driver.
 */
export default async function VipHomePage() {
    const language = await preferredLanguage();
    const dictionary = getDictionary(language);
    const drivers = (await listDrivers()).filter((driver) => driver.active !== false);

    return (
        <div className="vip-shell">
            <main className="grow flex flex-col justify-center px-5 py-8">
                <div className="w-full max-w-md mx-auto vip-rise">
                    <div className="text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={brand.logo} alt={brand.name} className="h-11 w-auto mx-auto" />
                        <p className="text-5xl mt-8" aria-hidden="true">
                            🚗
                        </p>
                        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{dictionary.splashTitle}</h1>
                        <p className="mt-3 vip-muted">{dictionary.splashSubtitle}</p>
                    </div>

                    {drivers.length > 0 ? (
                        <>
                            <p className="mt-9 mb-3 text-sm font-semibold text-center">{dictionary.deliveredBy}</p>
                            <div className="space-y-2.5">
                                {drivers.map((driver) => (
                                    <Link
                                        key={driver.id}
                                        href={`/d/${driver.id}`}
                                        className="vip-card no-underline flex items-center gap-3.5 p-3.5"
                                    >
                                        {driver.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={driver.photoUrl}
                                                alt=""
                                                className="rounded-full object-cover shrink-0"
                                                style={{ width: 48, height: 48 }}
                                            />
                                        ) : (
                                            <span
                                                aria-hidden="true"
                                                className="shrink-0 grid place-items-center rounded-full font-bold"
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                    background: 'linear-gradient(140deg, #f2cf5b, #d4af37)',
                                                    color: '#101a2e'
                                                }}
                                            >
                                                {driver.name.slice(0, 1).toUpperCase()}
                                            </span>
                                        )}
                                        <span className="text-lg font-bold grow">{driver.name}</span>
                                        <span aria-hidden="true" className="vip-muted text-xl">
                                            →
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="vip-card p-5 mt-9 text-center text-sm vip-muted">
                            No drivers have been added yet. Add them in the{' '}
                            <Link href="/dashboard/drivers">dashboard</Link> and they will appear here.
                        </div>
                    )}
                </div>
            </main>

            <footer className="px-5 py-6 text-center text-xs vip-muted">
                <a href={brand.website}>{brand.name}</a>
                <span aria-hidden="true"> · </span>
                <Link href="/dashboard">Staff</Link>
            </footer>
        </div>
    );
}
