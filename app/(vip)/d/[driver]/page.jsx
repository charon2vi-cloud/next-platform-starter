import { getDriver, slugify } from 'lib/vip/drivers';
import { ReviewScreen, ProblemScreen } from '../../_review/review-screen';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Thank you' };

/**
 * The simple entry point: https://…/d/sofiane
 *
 * Short enough to paste into any QR generator (Adobe, Canva, a label printer)
 * and short enough to read out over the phone. The trade-off versus /r/<token>
 * is that it carries no signature, so anyone who guesses a driver's name could
 * submit a review credited to them. For a five-driver valet team that is an
 * acceptable trade for being able to make your own QR codes — but if driver
 * bonuses are ever paid straight from these numbers, print the signed badges
 * from the QR studio instead.
 *
 * Optional extras, both safe to omit:
 *   /d/sofiane?booking=VP-88213&vehicle=BMW%20X5
 */
export default async function SimpleReviewPage({ params, searchParams }) {
    const { driver: slug } = await params;
    const query = (await searchParams) || {};

    const record = await getDriver(slugify(slug));
    if (!record) {
        return <ProblemScreen titleKey="invalidTitle" bodyKey="invalidBody" />;
    }

    return (
        <ReviewScreen
            driver={{ id: record.id, name: record.name, photoUrl: record.photoUrl || '', known: true }}
            bookingRef={String(query.booking || '').slice(0, 40)}
            vehicle={String(query.vehicle || '').slice(0, 60)}
        />
    );
}
