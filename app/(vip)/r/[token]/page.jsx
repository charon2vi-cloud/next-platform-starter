import { headers } from 'next/headers';
import { verifyToken } from 'lib/vip/token';
import { resolveDriver } from 'lib/vip/drivers';
import { resolveLanguage, getDictionary } from 'lib/vip/i18n';
import { brand, googleWriteReviewUrl, googleReviewLinkConfigured, privateFeedbackThreshold } from 'lib/vip/config';
import { ReviewFlow } from './review-flow';

// Every scan carries a different token, and the driver roster can change at any
// time, so this page is always rendered fresh.
export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Thank you'
};

async function preferredLanguage() {
    const headerList = await headers();
    return resolveLanguage(headerList.get('accept-language'));
}

function ProblemScreen({ dictionary, title, body }) {
    return (
        <div className="vip-shell items-center justify-center px-6 text-center">
            <div className="max-w-sm mx-auto vip-rise">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo} alt={brand.name} className="h-10 w-auto mx-auto mb-8" />
                <p className="text-5xl" aria-hidden="true">
                    🔒
                </p>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
                <p className="mt-3 text-sm vip-muted">{body}</p>
                <a className="vip-btn vip-btn-secondary mt-8" href={brand.website}>
                    {dictionary.visitWebsite}
                </a>
            </div>
        </div>
    );
}

export default async function ReviewPage({ params }) {
    const { token } = await params;
    const language = await preferredLanguage();
    const dictionary = getDictionary(language);

    const result = verifyToken(token);

    if (!result.ok) {
        const expired = result.reason === 'expired';
        return (
            <ProblemScreen
                dictionary={dictionary}
                title={expired ? dictionary.expiredTitle : dictionary.invalidTitle}
                body={expired ? dictionary.expiredBody : dictionary.invalidBody}
            />
        );
    }

    const { claim } = result;
    const driver = await resolveDriver(claim);

    return (
        <ReviewFlow
            driver={driver}
            bookingRef={claim.bookingRef}
            vehicle={claim.vehicle}
            initialLanguage={language}
            googleReviewUrl={googleWriteReviewUrl()}
            googleLinkConfigured={googleReviewLinkConfigured()}
            brand={brand}
            privateFeedbackThreshold={privateFeedbackThreshold}
        />
    );
}
