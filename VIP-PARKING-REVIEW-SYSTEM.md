# VIP Parking Alicante — QR review system

A customer scans the driver's QR code, taps five stars, taps a few phrases, and
lands in Google's review composer with their review already on the clipboard.
The driver's name is in the text without anybody typing it.

This document covers what was built, how to run it, and — importantly — exactly
what Google does and does not allow, because that constrains the design more
than anything else.

---

## 1. What the customer sees

```
Driver hands back the car
        │
        ▼
Customer scans the QR on the driver's lanyard
        │
        ▼
/r/<signed-token>          ← page already knows the driver, booking and vehicle
        │
        ├─ "Thank you!" splash with the driver's photo and name
        ├─ "Was everything perfect?"  → five big stars
        ├─ One-tap phrases ("Very friendly", "Car was waiting on arrival"…)
        │   which compose an editable draft review, in their language
        │
        ▼
"Post on Google"
        │
        ├─ draft copied to the clipboard
        ├─ coaching screen: "Tap and hold, choose Paste, press Post"
        │
        ▼
Google's review composer opens (their account, their words, their post)
        │
        ▼
They come back → "Did you manage to post it?" → 🎉 confetti
```

No typing is ever required. The whole path is four taps.

---

## 2. Google's rules — the real constraints

This is the part that decides the architecture, so it is worth being precise.

### 2.1 There is no way to post a review programmatically

**No Google API can publish a review on a customer's behalf. None.** This is not
a quota or approval problem — the capability does not exist:

| API | What it does with reviews |
|---|---|
| **Business Profile API** (`mybusinessaccountmanagement`, `mybusiness*` v4 review endpoints) | `list`, `get`, `batchGet`, `updateReply`, `deleteReply`. **Read and reply only.** |
| **Places API / Places API (New)** | Returns up to **5** reviews per place, chosen by Google. Read only. |
| **Any OAuth scope** | There is no scope that grants "write a review as this user". |

So the only actor who can create a review is the signed-in customer, inside
Google's own UI. Everything else is theatre.

### 2.2 Limitations of the Business Profile API (for the reporting you may want later)

- **Access must be applied for.** New Cloud projects get **zero quota** on the
  Business Profile APIs. You submit an access request form and wait for Google to
  approve the project. Budget days-to-weeks, not minutes.
- **You must be a verified owner or manager** of the location.
- **Default quotas are low** and a quota increase is a separate request.
- **The v4 review endpoints are legacy.** Google has migrated most of the surface
  to newer APIs but reviews still sit on the older `mybusiness.googleapis.com/v4`
  path, which has been in a long deprecation shadow. Treat it as a dependency
  that can move.
- **Reviewer identity is limited** — you get a display name and profile photo,
  not an email or a stable customer identifier, so you cannot reliably join a
  Google review back to a specific booking. Matching is heuristic (driver name
  mentioned in the text + timestamp window).
- **Push notifications exist but need setup**: the GBP API can publish
  `NEW_REVIEW` events to a Pub/Sub topic. Without it you poll.

### 2.3 Limitations of the Maps review link

- `https://search.google.com/local/writereview?placeid=<PLACE_ID>` opens the
  composer. It works, it is widely used — and it is **not a documented, supported
  URL contract**. The officially surfaced equivalent is the short link from your
  Business Profile ("Ask for reviews"), which looks like
  `https://g.page/r/<hash>/review`. **Prefer the short link** and set it as
  `NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL`; keep the Place ID as the fallback.
- **You cannot pre-fill the review text.** There is no supported parameter. Any
  blog post claiming otherwise is describing something that will break.
- **You cannot pre-set the star rating.** Same reason.
- **The customer must be signed in to a Google account.** If they are not, Google
  interrupts with a sign-in wall. This is the single biggest drop-off point in
  the funnel and there is nothing any third party can do about it.
- **Behaviour varies by device**: the link may open the Maps app, Chrome, or an
  in-app browser depending on OS, default browser and whether the scan came from
  a camera app or a messaging app.
- **Google's spam filters can remove reviews.** Many reviews posted in a short
  window, from the same location or network, or from accounts with no history,
  get filtered. A busy valet desk is exactly that pattern. Reviews posted from the
  customer's own phone on their own mobile data — which is what a QR scan
  produces — are the safest version of this.

Because the text cannot be pre-filled, **clipboard + paste is the best legal
handoff that exists**, and it is what this system implements.

### 2.4 Policy limits that change the product design

**Review gating is prohibited.** Google's review policies forbid selectively
soliciting positive reviews or discouraging negative ones. The classic
"rate us → 5 stars go to Google, 1–3 stars go to a private form" funnel is a
policy violation and risks review removal or profile suspension.

> **This system does not gate.** The "Post on Google" button is shown at every
> rating, in the same place, with the same prominence. Private feedback is
> offered *in addition*, never *instead*. The private-feedback screen ends with
> "You can still leave a public Google review if you want to."

If you are tempted to hide the Google button for low ratings — don't. That single
change is what turns a compliant tool into a liability.

**Do not incentivise customers.** Offering a discount, a free wash, or entry to a
prize draw in exchange for a review violates Google policy. In Spain it also
runs into consumer-protection law implementing the EU Omnibus Directive, which
prohibits misleading consumer reviews and undisclosed incentivised reviews.
Rewarding *your own drivers* internally is a different thing and is fine — but
it creates the incentive to game the system, which is why every QR code here is
cryptographically signed (§4).

**Do not write the review for the customer.** The one-tap phrases assemble a
*draft*, shown in an editable box before anything is copied. The customer can
change every word. Keep it that way. Also vary the phrase list occasionally:
hundreds of reviews with byte-identical text look like spam to Google's filters.

**GDPR.** The system stores review text, star rating, booking reference and a
random session id. It stores **no** customer name, email or phone. Keep a short
retention window on the events store and mention the review page in your privacy
policy.

### 2.5 The recommended workflow, ranked

1. **What is built here** — compose on our page → clipboard → Google composer →
   paste → post. Maximum conversion within the rules, keeps driver attribution,
   gives you a real funnel to measure.
2. **Phase 2: close the loop with the Business Profile API.** Today the "posted"
   event is *self-reported* — the customer says they posted it. Once you have GBP
   API access, poll reviews and match the driver's name in the review body against
   the handoff timestamp. Then the leaderboard is verified rather than trusted.
   This matters if drivers are paid per review.
3. **The dumb version, for comparison** — a QR that goes straight to the Google
   link. Fewer steps, but you lose the driver's name in the review, all analytics,
   and any private-feedback channel. Only worth it if the extra screen measurably
   hurts, which you can now test, because you have the numbers.

---

## 3. Routes

| Route | What it is |
|---|---|
| `/r/<token>` | The customer review experience. Public, no login, dynamic. |
| `/api/vip/track` | Funnel beacon (`scan`, `rated`, `feedback`, `handoff`, `posted`). |
| `/dashboard` | Totals, average rating, conversion, daily chart, monthly table, leaderboard, private feedback. |
| `/dashboard/drivers` | Driver roster — display name and optional photo. |
| `/dashboard/qr` | Generates and prints signed QR badges. |
| `/dashboard/login` | Password gate. |

The Netlify starter's own demo pages are untouched; they moved into the
`app/(netlify)/` route group so the review flow could have its own root layout,
free of the starter's header, footer and dark-blue theme.

---

## 4. The QR code and why it is signed

A QR code encodes a URL like:

```
https://vipparkingalicante.com/r/eyJ2IjoxLCJkIjoic29maWFuZSIsIm4iOiJTb2ZpYW5lIn0.bPQhWPI19XVvIolFBG7YKw
                                  └────────────── payload ──────────────┘ └──── HMAC ────┘
```

The payload is a compact JSON claim (driver id, driver name, optional booking
reference, vehicle, issued-at, optional expiry). The suffix is an HMAC-SHA256
over that payload, truncated to 128 bits, keyed with `VIP_QR_SECRET`.

**Why it matters:** drivers are rewarded per review. If the URL were just
`/r?driver=sofiane`, any driver could hand-craft a link crediting themselves —
or a competitor could credit somebody else with a bad review. Because the code is
signed, a review can only ever be attributed to a driver whose badge was actually
generated by the company.

Two kinds of code:

- **Driver badge** — permanent, no expiry, ~120 characters, prints as a crisp
  low-density QR. Laminate it, clip it to the lanyard, use it forever.
- **Booking code** — carries the booking reference and vehicle, expires after
  three days. Generated per handover from the QR studio.

Tampering with either yields `bad-signature`; an old booking code yields
`expired`. Both render a polite screen, never a stack trace.

---

## 5. Conversion features that are actually in the build

The design target was *"a tired passenger holding a suitcase, one-handed, in the
sun, in a language that may not be English."*

- **Zero typing.** One-tap phrase chips compose the review. This is the single
  biggest lever — a textarea on a phone is where review flows die.
- **Driver name pre-filled** from the QR, with an explicit, checked-by-default
  "Mention Sofiane in the review" toggle that explains *why* ("this is how
  Sofiane gets credit for looking after you").
- **Five languages** — English, Spanish, French, German, Dutch — auto-selected
  from the phone's `Accept-Language`, switchable with a flag row. The chips and
  the composed review are all translated, not just the labels.
- **Clipboard + coaching screen** so the paste step is obvious rather than a
  guess.
- **Return detection** — when the tab regains focus after the Google handoff, the
  page asks "Did you manage to post it?" instead of sitting on a dead screen.
- **Confetti + a shimmering thank-you** on confirmation, naming the driver.
- **Haptics** on every meaningful tap (`navigator.vibrate`), with a five-star
  rating getting its own celebratory pattern.
- **Dark mode**, automatic from the OS.
- **`prefers-reduced-motion` respected** — animations collapse, confetti is
  removed entirely.
- **Safe-area insets, 16px minimum input font** (so iOS never zoom-jumps mid-flow),
  `100dvh` sizing, and 56px+ tap targets.
- **Private feedback path** available at every rating, which surfaces service
  problems to the manager the same day without touching the public listing.

### Ideas worth doing next

- **NFC tags** alongside the QR — a tap is even faster than a scan, same URL.
- **Verified leaderboard** via the GBP API (§2.5) so driver rewards pay out on
  confirmed reviews rather than self-reported ones.
- **A/B the splash screen.** The 1.9s thank-you beat is a guess; the funnel data
  can tell you whether skipping straight to the stars converts better.
- **Rotate the phrase chips** monthly so review text stays varied.
- **A "not signed in to Google?" hint** on the handoff screen — sign-in is the
  biggest drop-off and a one-line warning may recover some of it.
- **Weekly driver digest** — the leaderboard is far more motivating pushed to
  WhatsApp on Monday than sitting on a dashboard nobody opens.

---

## 6. Data

Netlify Blobs, two stores. No external database.

| Store | Key | Value |
|---|---|---|
| `vip-drivers` | `<driverId>` | id, name, photoUrl, active, timestamps |
| `vip-events` | `YYYY-MM-DD/<uuid>` | type, driverId, driverName, bookingRef, rating, comment, language, sessionId, createdAt |

The date prefix makes a range query a cheap prefix list. Aggregates are computed
on read rather than stored, so no counter can drift out of sync with the events —
at valet-desk volumes (hundreds a month) that is comfortably fast.

Outside a Netlify runtime (plain `next dev`), storage transparently falls back to
JSON files under `.netlify/vip-dev-store/`, so the whole app is usable locally.

**Conversion rate** = confirmed `posted` ÷ `scan`. **Reached Google** =
`handoff` ÷ `scan`. The gap between those two numbers is the Google sign-in wall
and paste friction — it is the number to optimise.

---

## 7. Setup

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev
```

**Required environment variables:**

| Variable | Why |
|---|---|
| `VIP_QR_SECRET` | Signs QR tokens. `openssl rand -base64 48`. Without it, a public dev secret is used and the app warns on every boot. |
| `VIP_DASHBOARD_PASSWORD` | Gates `/dashboard`. Without it the dashboard is open and says so in a banner. |
| `NEXT_PUBLIC_VIP_GOOGLE_PLACE_ID` *or* `NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL` | Makes the Google composer open directly instead of the plain Maps listing. |

Everything else in `.env.example` is optional branding.

**Getting the Place ID:** open the
[Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
and search for VIP Parking Alicante — it is the `ChIJ…` value. Or, better, take
the short review link straight from your Google Business Profile
("Ask for reviews") and use `NEXT_PUBLIC_VIP_GOOGLE_REVIEW_URL`.

**Then:**

1. `/dashboard/drivers` → add each driver.
2. `/dashboard/qr` → **Print badges** → laminate → clip to lanyards.
3. Hand the car back, ask for the scan.

**To see the dashboard populated before going live:**

```bash
node scripts/vip-demo-data.mjs 30     # 30 days of realistic demo activity
```

Delete `.netlify/vip-dev-store/` (or the blob stores) to clear it again.

---

## 8. Known gaps

- **`posted` is self-reported.** The customer taps "Yes, posted!" — nothing
  verifies it against Google. §2.5 explains the fix. If driver bonuses are paid
  from this number today, spot-check it against the real listing.
- **The clipboard can fail.** iOS in-app browsers (Instagram, Facebook) sometimes
  block `navigator.clipboard`. The code falls back to a hidden-textarea copy, and
  if both fail the draft is still shown on screen to copy by hand — but the paste
  step is genuinely less reliable there than in Safari or Chrome.
- **No rate limiting on `/api/vip/track`.** It is a public endpoint; a determined
  person could inflate scan counts (not ratings attribution, which needs a signed
  token, but the funnel numbers). Add Netlify rate limiting if that matters.
- **The dashboard uses one shared password.** Right-sized for a handful of
  managers; swap for real accounts if you ever need per-user audit trails.
- **The WhatsApp announcement screenshot referenced in the brief was not attached**
  to the request, so the current-process details are taken from the written
  description only. If it contains specifics — a bonus structure, required
  wording, a deadline — send it over and the copy can be aligned.
