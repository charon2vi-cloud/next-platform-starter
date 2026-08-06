/**
 * Central configuration for the VIP Parking Alicante review system.
 * Everything here is overridable with environment variables so the same build
 * can be pointed at staging / another location without a code change.
 */

export const brand = {
    name: process.env.NEXT_PUBLIC_VIP_BRAND_NAME || 'VIP Parking Alicante',
    shortName: 'VIP Parking',
    website: process.env.NEXT_PUBLIC_VIP_WEBSITE || 'https://vipparkingalicante.com',
    logo: process.env.NEXT_PUBLIC_VIP_LOGO || '/vip/logo.svg',
    supportEmail: process.env.NEXT_PUBLIC_VIP_SUPPORT_EMAIL || 'info@vipparkingalicante.com'
};

/**
 * The Google Place ID of the business listing.
 *
 * How to find it: https://developers.google.com/maps/documentation/places/web-service/place-id
 * Paste the business name into the "Place ID Finder" and copy the `ChIJ...` value.
 * Alternatively, Google Business Profile > Read reviews > Share review form gives
 * you a `g.page/r/<id>/review` short link, which can be set as VIP_GOOGLE_REVIEW_URL.
 */
export const googlePlaceId = process.env.NEXT_PUBLIC_VIP_GOOGLE_PLACE_ID || '';

/** Fallback: the public Maps listing, used when no Place ID has been configured yet. */
export const googleMapsUrl =
    process.env.NEXT_PUBLIC_VIP_GOOGLE_MAPS_URL || 'https://maps.app.goo.gl/REdk8DZG58KokFhd9';

/**
 * Deep link that opens Google's "write a review" dialog directly.
 *
 * IMPORTANT: Google offers no supported parameter to pre-fill the review body or
 * the star rating. This URL can only *open* the composer — the customer types or
 * pastes the text and presses Post themselves. See VIP-PARKING-REVIEW-SYSTEM.md.
 */
export function googleWriteReviewUrl() {
    if (process.env.NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL) {
        return process.env.NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL;
    }
    if (googlePlaceId) {
        return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`;
    }
    return googleMapsUrl;
}

/** True when the operator still has to configure a real review deep link. */
export function googleReviewLinkConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL || googlePlaceId);
}

/** Ratings at or below this value are routed to private feedback *in addition to* Google. */
export const privateFeedbackThreshold = 3;

/** Seconds a booking-scoped QR code stays valid when no explicit expiry is given. */
export const defaultTokenTtlSeconds = 60 * 60 * 24 * 3;
