import './vip.css';
import { brand } from 'lib/vip/config';

export const metadata = {
    title: {
        template: `%s | ${brand.name}`,
        default: brand.name
    },
    description: 'Leave a review for the driver who looked after you.',
    robots: { index: false, follow: false }
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#fdfbf6' },
        { media: '(prefers-color-scheme: dark)', color: '#080d17' }
    ]
};

export default function VipLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/vip/icon.svg" type="image/svg+xml" />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}
