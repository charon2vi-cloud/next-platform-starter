import './dashboard.css';
import Link from 'next/link';
import { brand } from 'lib/vip/config';
import { dashboardProtected } from 'lib/vip/auth';
import { logoutAction } from './actions';

export const metadata = { title: 'Dashboard' };

const NAV = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/drivers', label: 'Drivers' },
    { href: '/dashboard/qr', label: 'QR studio' }
];

export default function DashboardLayout({ children }) {
    return (
        <div>
            <header
                className="dash-no-print sticky top-0 z-10 border-b backdrop-blur"
                style={{ borderColor: 'var(--vip-border)', background: 'color-mix(in oklab, var(--vip-bg) 88%, transparent)' }}
            >
                <div className="max-w-[1140px] mx-auto px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brand.logo} alt={brand.name} className="h-7 w-auto" />
                    <nav className="flex items-center gap-1 grow">
                        {NAV.map((item) => (
                            <Link key={item.href} href={item.href} className="dash-nav-link no-underline">
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    {dashboardProtected() && (
                        <form action={logoutAction}>
                            <button type="submit" className="dash-nav-link" style={{ border: 0, background: 'none', cursor: 'pointer' }}>
                                Sign out
                            </button>
                        </form>
                    )}
                </div>
            </header>
            <div className="dash-shell">{children}</div>
        </div>
    );
}
