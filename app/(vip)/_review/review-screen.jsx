import { headers } from 'next/headers';
import { resolveLanguage, getDictionary } from 'lib/vip/i18n';
import { brand, googleWriteReviewUrl, googleReviewLinkConfigured, privateFeedbackThreshold } from 'lib/vip/config';
import { ReviewFlow } from './review-flow';

/**
 * Shared wiring for the two ways a customer can reach the review interface:
 * a simple /d/<driver> link, or a signed /r/<token> QR.
 */

export async function preferredLanguage() {
    const headerList = await headers();
    return resolveLanguage(headerList.get('accept-language'));
}

export async function ReviewScreen({ driver, bookingRef = '', vehicle = '' }) {
    const language = await preferredLanguage();

    return (
        <ReviewFlow
            driver={driver}
            bookingRef={bookingRef}
            vehicle={vehicle}
            initialLanguage={language}
            googleReviewUrl={googleWriteReviewUrl()}
            googleLinkConfigured={googleReviewLinkConfigured()}
            brand={brand}
            privateFeedbackThreshold={privateFeedbackThreshold}
        />
    );
}

export async function ProblemScreen({ titleKey, bodyKey }) {
    const dictionary = getDictionary(await preferredLanguage());

    return (
        <div className="vip-shell items-center justify-center px-6 text-center">
            <div className="max-w-sm mx-auto vip-rise">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo} alt={brand.name} className="h-10 w-auto mx-auto mb-8" />
                <p className="text-5xl" aria-hidden="true">
                    🔒
                </p>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{dictionary[titleKey]}</h1>
                <p className="mt-3 text-sm vip-muted">{dictionary[bodyKey]}</p>
                <a className="vip-btn vip-btn-secondary mt-8" href={brand.website}>
                    {dictionary.visitWebsite}
                </a>
            </div>
        </div>
    );
}
