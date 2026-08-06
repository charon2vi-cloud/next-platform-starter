import { getDictionary, t } from './i18n.js';
import { brand } from './config.js';

const CONJUNCTIONS = { en: 'and', es: 'y', fr: 'et', de: 'und', nl: 'en' };

const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1);

/**
 * Compose the review body from one-tap chips, the customer's own additions and
 * the driver credit line.
 *
 * The customer always sees and can edit the result before anything is copied —
 * we assemble a draft, we never author a review on someone's behalf.
 */
export function composeReview({ language, driverName, chips = [], extra = '', includeDriverName = true }) {
    const dictionary = getDictionary(language);
    const parts = [t(dictionary, 'reviewIntro', { brand: brand.name })];

    if (chips.length) {
        // "A, b and c." reads like a person wrote it; a capitalised bullet list does not.
        // German is left alone because its nouns are capitalised by grammar.
        const phrases = chips.map((chip, index) => (index === 0 || language === 'de' ? chip : lowerFirst(chip)));
        const list =
            phrases.length === 1
                ? phrases[0]
                : `${phrases.slice(0, -1).join(', ')} ${CONJUNCTIONS[language] || CONJUNCTIONS.en} ${phrases[phrases.length - 1]}`;
        parts.push(`${list}.`);
    }

    const trimmedExtra = extra.trim();
    if (trimmedExtra) parts.push(trimmedExtra);

    if (includeDriverName && driverName) {
        parts.push(t(dictionary, 'reviewSignature', { name: driverName }));
    }

    return parts.join(' ');
}
