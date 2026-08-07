'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StarRating } from './stars';
import { Confetti } from './confetti';
import { LANGUAGES, getDictionary, t } from 'lib/vip/i18n';
import { composeReview } from 'lib/vip/review-text';

/* ------------------------------------------------------------------ utils */

function haptic(pattern = 12) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch {
            /* unsupported, never mind */
        }
    }
}

function sessionId() {
    if (typeof window === 'undefined') return '';
    let id = window.sessionStorage.getItem('vip-session');
    if (!id) {
        id = crypto.randomUUID();
        window.sessionStorage.setItem('vip-session', id);
    }
    return id;
}

/** Clipboard API needs HTTPS + permission; fall back to a hidden selection copy. */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(area);
            area.select();
            area.setSelectionRange(0, text.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(area);
            return ok;
        } catch {
            return false;
        }
    }
}

/* ------------------------------------------------------------- sub-pieces */

function DriverBadge({ driver, dictionary, bookingRef, vehicle }) {
    const initials = driver.name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="flex items-center gap-3.5">
            {driver.photoUrl ? (
                // Driver photos are operator-supplied URLs, so plain <img> keeps
                // next/image remote-pattern config out of the deployment story.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={driver.photoUrl}
                    alt=""
                    width={60}
                    height={60}
                    className="w-15 h-15 rounded-full object-cover shrink-0"
                    style={{ width: 60, height: 60, border: '2px solid var(--color-vip-gold)' }}
                />
            ) : (
                <div
                    aria-hidden="true"
                    className="shrink-0 grid place-items-center rounded-full font-bold text-xl"
                    style={{
                        width: 60,
                        height: 60,
                        background: 'linear-gradient(140deg, #f2cf5b, #d4af37)',
                        color: '#101a2e'
                    }}
                >
                    {initials || '★'}
                </div>
            )}

            <div className="min-w-0">
                <p className="text-sm vip-muted">{dictionary.deliveredBy}</p>
                <p className="text-2xl font-bold leading-tight truncate">{driver.name}</p>
                {(bookingRef || vehicle) && (
                    <p className="text-xs vip-muted mt-1 truncate">
                        {bookingRef && `${dictionary.booking} ${bookingRef}`}
                        {bookingRef && vehicle && ' · '}
                        {vehicle}
                    </p>
                )}
            </div>
        </div>
    );
}

function LanguagePicker({ language, onChange }) {
    return (
        <div className="flex justify-center gap-1">
            {LANGUAGES.map((entry) => (
                <button
                    key={entry.code}
                    type="button"
                    onClick={() => onChange(entry.code)}
                    aria-label={entry.label}
                    aria-pressed={language === entry.code}
                    className="px-2 py-1 rounded-lg text-lg leading-none transition-opacity"
                    style={{
                        opacity: language === entry.code ? 1 : 0.4,
                        background: language === entry.code ? 'var(--vip-surface-2)' : 'transparent'
                    }}
                >
                    <span aria-hidden="true">{entry.flag}</span>
                </button>
            ))}
        </div>
    );
}

function Step({ children, stepKey }) {
    return (
        <div key={stepKey} className="vip-rise">
            {children}
        </div>
    );
}

/* ------------------------------------------------------------------- flow */

const STEPS = {
    welcome: 'welcome',
    rating: 'rating',
    compose: 'compose',
    handoff: 'handoff',
    confirm: 'confirm',
    done: 'done',
    private: 'private',
    privateDone: 'privateDone'
};

export function ReviewFlow({
    driver,
    bookingRef,
    vehicle,
    initialLanguage,
    googleReviewUrl,
    googleLinkConfigured,
    brand,
    privateFeedbackThreshold
}) {
    const [language, setLanguage] = useState(initialLanguage);
    const [step, setStep] = useState(STEPS.welcome);
    const [rating, setRating] = useState(0);
    const [selectedChips, setSelectedChips] = useState([]);
    const [extra, setExtra] = useState('');
    const [includeDriverName, setIncludeDriverName] = useState(true);
    const [copied, setCopied] = useState(false);
    const [justCopied, setJustCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [handedOff, setHandedOff] = useState(false);

    const dictionary = useMemo(() => getDictionary(language), [language]);
    const lowRating = rating > 0 && rating <= privateFeedbackThreshold;

    /* --- telemetry -------------------------------------------------- */

    const track = useCallback(
        (type, payload = {}) => {
            const body = JSON.stringify({
                type,
                driverId: driver.id,
                driverName: driver.name,
                bookingRef,
                language,
                sessionId: sessionId(),
                ...payload
            });

            // keepalive so the `handoff` beacon survives the tab switching to Google.
            return fetch('/api/vip/track', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body,
                keepalive: true
            }).catch(() => {
                /* analytics must never block the customer */
            });
        },
        [driver.id, driver.name, bookingRef, language]
    );

    const scanTracked = useRef(false);
    useEffect(() => {
        if (scanTracked.current) return;
        scanTracked.current = true;
        track('scan');
    }, [track]);

    // A short beat on the thank-you splash, then straight into the ask.
    useEffect(() => {
        if (step !== STEPS.welcome) return undefined;
        const timer = setTimeout(() => setStep(STEPS.rating), 1900);
        return () => clearTimeout(timer);
    }, [step]);

    // When the customer comes back from Google, ask whether it worked.
    useEffect(() => {
        if (!handedOff) return undefined;
        const onVisible = () => {
            if (document.visibilityState === 'visible') setStep(STEPS.confirm);
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [handedOff]);

    /* --- derived ---------------------------------------------------- */

    const reviewText = useMemo(
        () =>
            composeReview({
                language,
                driverName: driver.name,
                chips: selectedChips,
                extra,
                includeDriverName
            }),
        [language, driver.name, selectedChips, extra, includeDriverName]
    );

    const [editedText, setEditedText] = useState(null);
    const finalText = editedText ?? reviewText;

    const chipSource = lowRating ? dictionary.issueChips : dictionary.chips;

    const toggleChip = (chip) => {
        haptic(8);
        setEditedText(null); // regenerate the draft from the new selection
        setSelectedChips((current) =>
            current.includes(chip) ? current.filter((entry) => entry !== chip) : [...current, chip]
        );
    };

    const changeLanguage = (code) => {
        // Chips are language-specific, so a switch has to clear the selection.
        setSelectedChips([]);
        setEditedText(null);
        setLanguage(code);
    };

    /* --- actions ---------------------------------------------------- */

    const chooseRating = (value) => {
        haptic(value === 5 ? [10, 40, 18] : 12);
        setRating(value);
        setSelectedChips([]);
        setEditedText(null);
        track('rated', { rating: value });
        setTimeout(() => setStep(STEPS.compose), 420);
    };

    const goToGoogle = async () => {
        haptic(14);
        setSending(true);
        const ok = await copyText(finalText);
        setCopied(ok);
        await track('handoff', { rating, comment: finalText });
        setSending(false);
        setStep(STEPS.handoff);
    };

    const openGoogle = () => {
        setHandedOff(true);
        window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
    };

    const sendPrivate = async () => {
        setSending(true);
        await track('feedback', { rating, comment: finalText });
        setSending(false);
        haptic([10, 30, 10]);
        setStep(STEPS.privateDone);
    };

    const confirmPosted = async () => {
        haptic([12, 40, 12, 40, 24]);
        await track('posted', { rating, comment: finalText });
        setStep(STEPS.done);
    };

    /* --- render ----------------------------------------------------- */

    return (
        <div className="vip-shell">
            {step === STEPS.done && <Confetti />}

            <header className="px-5 pt-5 pb-2 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={brand.logo}
                    alt={brand.name}
                    className="h-10 w-auto"
                    style={{ color: 'var(--vip-text)' }}
                />
                <LanguagePicker language={language} onChange={changeLanguage} />
            </header>

            <main className="grow flex flex-col justify-center px-5 py-4">
                <div className="w-full max-w-md mx-auto">
                    {step === STEPS.welcome && (
                        <Step stepKey="welcome">
                            <div className="text-center">
                                <p className="text-6xl mb-4 vip-pop" aria-hidden="true">
                                    🚗
                                </p>
                                <h1 className="text-4xl font-extrabold tracking-tight vip-shimmer">
                                    {dictionary.splashTitle}
                                </h1>
                                <p className="mt-3 vip-muted">{dictionary.splashSubtitle}</p>
                            </div>
                            <div className="vip-card p-5 mt-8">
                                <DriverBadge
                                    driver={driver}
                                    dictionary={dictionary}
                                    bookingRef={bookingRef}
                                    vehicle={vehicle}
                                />
                            </div>
                        </Step>
                    )}

                    {step === STEPS.rating && (
                        <Step stepKey="rating">
                            <div className="vip-card p-5">
                                <DriverBadge
                                    driver={driver}
                                    dictionary={dictionary}
                                    bookingRef={bookingRef}
                                    vehicle={vehicle}
                                />
                            </div>
                            <h1 className="mt-8 text-center text-3xl font-extrabold tracking-tight">
                                {dictionary.ratingQuestion}
                            </h1>
                            <p className="mt-2 text-center text-sm vip-muted">{dictionary.ratingHint}</p>
                            <div className="mt-7">
                                <StarRating value={rating} onChange={chooseRating} labels={dictionary.ratingLabels} />
                            </div>
                        </Step>
                    )}

                    {step === STEPS.compose && (
                        <Step stepKey="compose">
                            <h1 className="text-2xl font-extrabold tracking-tight">
                                {lowRating ? dictionary.issuesTitle : dictionary.chipsTitle}
                            </h1>
                            <p className="mt-1.5 text-sm vip-muted">
                                {lowRating ? dictionary.issuesHint : dictionary.chipsHint}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {chipSource.map((chip) => (
                                    <button
                                        key={chip}
                                        type="button"
                                        className="vip-chip"
                                        data-selected={selectedChips.includes(chip)}
                                        aria-pressed={selectedChips.includes(chip)}
                                        onClick={() => toggleChip(chip)}
                                    >
                                        {selectedChips.includes(chip) && <span aria-hidden="true">✓</span>}
                                        {chip}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6">
                                <label htmlFor="vip-comment" className="block text-sm font-semibold">
                                    {dictionary.commentTitle}
                                </label>
                                <p className="mt-1 text-xs vip-muted">{dictionary.commentHint}</p>
                                <textarea
                                    id="vip-comment"
                                    className="vip-field mt-2"
                                    rows={5}
                                    value={finalText}
                                    placeholder={dictionary.commentPlaceholder}
                                    onChange={(event) => setEditedText(event.target.value)}
                                />
                            </div>

                            <label className="mt-4 flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeDriverName}
                                    onChange={(event) => {
                                        setEditedText(null);
                                        setIncludeDriverName(event.target.checked);
                                    }}
                                    className="mt-0.5 w-5 h-5 shrink-0 accent-[#d4af37]"
                                />
                                <span className="text-sm">
                                    <span className="font-semibold">
                                        {t(dictionary, 'includeDriverName', { name: driver.name })}
                                    </span>
                                    <span className="block vip-muted text-xs mt-0.5">
                                        {t(dictionary, 'includeDriverNameHint', { name: driver.name })}
                                    </span>
                                </span>
                            </label>

                            <div className="mt-6 space-y-2.5">
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-primary"
                                    onClick={goToGoogle}
                                    disabled={sending}
                                >
                                    <GoogleGlyph />
                                    {dictionary.postOnGoogle}
                                </button>

                                {/*
                                  Deliberately shown to *everyone*, not only unhappy customers:
                                  routing low ratings away from Google is review gating and
                                  breaks Google's policies. Both doors stay open at every rating.
                                */}
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-secondary"
                                    onClick={() => setStep(STEPS.private)}
                                    disabled={sending}
                                >
                                    {dictionary.privateInstead}
                                </button>

                                <button
                                    type="button"
                                    className="vip-btn vip-btn-ghost"
                                    onClick={() => setStep(STEPS.rating)}
                                >
                                    ← {dictionary.back}
                                </button>
                            </div>
                        </Step>
                    )}

                    {step === STEPS.handoff && (
                        <Step stepKey="handoff">
                            <div className="text-center">
                                <p className="text-5xl vip-pop" aria-hidden="true">
                                    {copied ? '📋' : '📝'}
                                </p>
                                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                                    {copied ? dictionary.copiedTitle : dictionary.commentTitle}
                                </h1>
                                <p
                                    className="mt-3 text-sm vip-muted"
                                    dangerouslySetInnerHTML={{ __html: dictionary.copiedBody }}
                                />
                            </div>

                            <div className="vip-card p-4 mt-5 text-sm" style={{ background: 'var(--vip-surface-2)' }}>
                                {finalText}
                            </div>

                            <div className="mt-6 space-y-2.5">
                                {/*
                                  Once they have been sent to Google, the primary action becomes
                                  "continue". Returning from another tab does not reliably fire a
                                  visibility event on every mobile browser, so the way back to the
                                  confirmation step — and therefore to the `posted` conversion
                                  event — must never depend on that listener alone.
                                */}
                                {handedOff && (
                                    <button
                                        type="button"
                                        className="vip-btn vip-btn-primary"
                                        onClick={() => setStep(STEPS.confirm)}
                                    >
                                        {dictionary.continue} →
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className={`vip-btn ${handedOff ? 'vip-btn-secondary' : 'vip-btn-primary'}`}
                                    onClick={openGoogle}
                                >
                                    <GoogleGlyph />
                                    {dictionary.openGoogle}
                                </button>
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-secondary"
                                    onClick={async () => {
                                        const ok = await copyText(finalText);
                                        setCopied(ok);
                                        haptic(10);
                                        if (ok) {
                                            // Flash the confirmation, then go back to the
                                            // action label so the button stays tappable-looking.
                                            setJustCopied(true);
                                            setTimeout(() => setJustCopied(false), 2000);
                                        }
                                    }}
                                >
                                    {justCopied ? dictionary.copiedManualDone : dictionary.copiedManual}
                                </button>
                            </div>

                            {!googleLinkConfigured && (
                                <p className="mt-4 text-xs text-center" style={{ color: '#b45309' }}>
                                    Set NEXT_PUBLIC_VIP_GOOGLE_PLACE_ID to open the review composer directly.
                                </p>
                            )}
                        </Step>
                    )}

                    {step === STEPS.confirm && (
                        <Step stepKey="confirm">
                            <div className="text-center">
                                <p className="text-5xl vip-pop" aria-hidden="true">
                                    🤞
                                </p>
                                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                                    {dictionary.confirmTitle}
                                </h1>
                            </div>
                            <div className="mt-7 space-y-2.5">
                                <button type="button" className="vip-btn vip-btn-primary" onClick={confirmPosted}>
                                    {dictionary.confirmYes}
                                </button>
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-secondary"
                                    onClick={() => setStep(STEPS.handoff)}
                                >
                                    {dictionary.confirmNo}
                                </button>
                            </div>
                        </Step>
                    )}

                    {step === STEPS.private && (
                        <Step stepKey="private">
                            <h1 className="text-2xl font-extrabold tracking-tight">{dictionary.privateTitle}</h1>
                            <p className="mt-1.5 text-sm vip-muted">{dictionary.privateHint}</p>
                            <textarea
                                className="vip-field mt-4"
                                rows={6}
                                value={finalText}
                                onChange={(event) => setEditedText(event.target.value)}
                                placeholder={dictionary.commentPlaceholder}
                            />
                            <div className="mt-5 space-y-2.5">
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-primary"
                                    onClick={sendPrivate}
                                    disabled={sending}
                                >
                                    {dictionary.privateSend}
                                </button>
                                <button
                                    type="button"
                                    className="vip-btn vip-btn-ghost"
                                    onClick={() => setStep(STEPS.compose)}
                                >
                                    ← {dictionary.back}
                                </button>
                            </div>
                        </Step>
                    )}

                    {step === STEPS.privateDone && (
                        <Step stepKey="privateDone">
                            <div className="text-center">
                                <p className="text-5xl vip-pop" aria-hidden="true">
                                    🙏
                                </p>
                                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                                    {dictionary.privateDone}
                                </h1>
                                <p className="mt-3 text-sm vip-muted">{dictionary.alsoPublic}</p>
                            </div>
                            <div className="mt-7 space-y-2.5">
                                <button type="button" className="vip-btn vip-btn-secondary" onClick={goToGoogle}>
                                    <GoogleGlyph />
                                    {dictionary.postOnGoogle}
                                </button>
                                <a className="vip-btn vip-btn-ghost" href={brand.website}>
                                    {dictionary.visitWebsite}
                                </a>
                            </div>
                        </Step>
                    )}

                    {step === STEPS.done && (
                        <Step stepKey="done">
                            <div className="text-center">
                                <p className="text-6xl vip-pop" aria-hidden="true">
                                    🎉
                                </p>
                                <h1 className="mt-4 text-3xl font-extrabold tracking-tight vip-shimmer">
                                    {dictionary.thanksTitle}
                                </h1>
                                <p className="mt-3 vip-muted">
                                    {t(dictionary, 'thanksBody', { name: driver.name })}
                                </p>
                            </div>
                            <div className="mt-8">
                                <a className="vip-btn vip-btn-secondary" href={brand.website}>
                                    {dictionary.visitWebsite}
                                </a>
                            </div>
                        </Step>
                    )}
                </div>
            </main>

            <footer className="px-5 py-5 text-center text-xs vip-muted">
                {brand.name} · {new Date().getFullYear()}
            </footer>
        </div>
    );
}

function GoogleGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.7 5.2C42.2 35.4 45 30.2 45 24z"
            />
            <path
                fill="#34A853"
                d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4C29.8 36.6 27.2 37.5 24 37.5c-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 40.9 15.4 46 24 46z"
            />
            <path fill="#FBBC05" d="M11.5 28.4A13.4 13.4 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.1-5.6A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9l7.1-5.5z" />
            <path
                fill="#EA4335"
                d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 8 7.1 4.4 14.1l7.1 5.5C13.3 14.3 18.2 10.5 24 10.5z"
            />
        </svg>
    );
}
