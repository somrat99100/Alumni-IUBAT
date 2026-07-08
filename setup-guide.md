# IUBAT Agriculture Alumni Network — Full Setup Guide

This covers everything: folder structure, Firebase (Auth + Firestore + Storage), security rules, making yourself admin, and deploying on GitHub Pages under the `Alumni-IUBAT` repo.

## 1. Folder structure

```
Alumni-IUBAT/
├── index.html
├── department.html
├── login.html
├── register.html
├── alumni.html
├── my-profile.html
├── admin.html              (not linked anywhere in the nav — see §6)
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js  (you must fill in your own values — §3)
│   ├── cloudinary.js       (you must fill in your own values — §3b)
│   ├── auth-guard.js
│   ├── navbar-loader.js
│   ├── main.js
│   ├── alumni.js
│   ├── profile.js
│   └── admin.js
└── assets/
    └── (logo, favicon, etc.)
```

All the files above are already written and included with this guide. Just fill in your Firebase config (§3) before deploying.

## 2. Create the Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com/) → **Add project**. Name it (e.g. `iubat-agri-alumni`). Google Analytics is optional.
2. Click the web icon (`</>`) to register a web app and copy the config object — you'll paste it into `js/firebase-config.js`.
3. Enable the services you need:
   - **Authentication → Sign-in method** → enable **Email/Password**.
   - **Authentication → Sign-in method** → also enable **Phone**. This is used only during registration, to send a real SMS one-time code that proves the person actually owns the phone number they typed in (see §3c) — it never signs anyone in as a phone-auth user for real.
   - **Firestore Database → Create database** → start in **Production mode** (never "test mode," even temporarily — it leaves all data world-writable).
   - **Authentication → Settings → Authorized domains** → make sure the domain you'll deploy to (e.g. `yourusername.github.io`) is listed — the invisible reCAPTCHA that Phone sign-in uses will fail on an unauthorized domain.

**Skip Firebase Storage.** As of February 3, 2026, Firebase requires the paid Blaze plan (a card on file) just to provision or access a Storage bucket — even for small hobby usage. Auth and Firestore remain fully free on the Spark plan, so this project uses **Cloudinary** for alumni photo uploads instead (§3b) and never touches Firebase Storage at all.

## 3. Wire up the config

Open `js/firebase-config.js` and replace the placeholders with the values Firebase gave you:

```js
const firebaseConfig = {
  apiKey: "PASTE_FROM_CONSOLE",
  authDomain: "iubat-agri-alumni.firebaseapp.com",
  projectId: "iubat-agri-alumni",
  storageBucket: "iubat-agri-alumni.appspot.com",
  messagingSenderId: "…",
  appId: "…"
};
```

The web `apiKey` is not a secret — it's fine for it to be visible in public JS. What actually protects your data is the security rules in §5, not hiding this key. Never put a service-account key or any admin credential in front-end code.

## 3b. Set up Cloudinary (free, no card required) for photo uploads

1. Create a free account at [cloudinary.com](https://cloudinary.com/) — no payment method needed for the free tier (25 GB storage, 25 GB monthly bandwidth).
2. On your Cloudinary dashboard, copy your **Cloud name**.
3. Go to **Settings → Upload** → scroll to **Upload presets** → **Add upload preset**.
   - Set **Signing Mode** to **Unsigned** (this lets the browser upload directly without exposing any secret key).
   - Optionally set a folder name and a max file size under that preset's settings.
   - Save it and copy the **preset name**.
4. Open `js/cloudinary.js` and replace the two placeholders:
   ```js
   const CLOUDINARY_CLOUD_NAME = "your-cloud-name";
   const CLOUDINARY_UPLOAD_PRESET = "your-preset-name";
   ```
That's it — `register.html` and `my-profile.html` already call this helper for photo uploads, so no other code changes are needed.

## 3c. Set up EmailJS (approval emails + registration OTP codes)

The admin queue and the registration form both send email through the same EmailJS account, but they use **two different templates**:

1. If you haven't already, create a free account at [emailjs.com](https://www.emailjs.com/) and connect an Email Service (its id is `EMAILJS_SERVICE_ID` in the code) and grab your **Public Key** (Account → API Keys) — this is already wired into `admin.html`'s `emailjs.init(...)` call and now also into `register.html`'s.
2. **Approval email template** (already referenced as `EMAILJS_TEMPLATE_ID` in `js/admin.js`) — just needs `{{to_email}}` and `{{to_name}}` variables.
3. **New: OTP template** for the registration verification code — create a second template with `{{to_email}}`, `{{to_name}}`, and **`{{otp_code}}`** variables (e.g. body: "Hi {{to_name}}, your IUBAT Alumni Network verification code is {{otp_code}}. It's valid for a few minutes."). Copy its template id into `EMAILJS_OTP_TEMPLATE_ID` in `js/otp-verify.js`.

## 4. Data model

```
alumni/{uid}                     ← PUBLIC fields only
  fullName, studentId, batch, jobTitle, org, researchArea, photoUrl,
  jobHistory: [ { title, org, startDate, endDate } ],
  visibility: { phone: "public"|"private", whatsapp: "public"|"private" },
  status: "pending" | "approved" | "rejected",
  everApproved: boolean,
  previousApproved: { ...snapshot of the live values, see below } | (absent),
  createdAt, updatedAt

alumni/{uid}/private/contact     ← SENSITIVE fields, gated subcollection
  email, phone, whatsapp, facebookUrl, linkedinUrl
  (phone/whatsapp are stored WITH the country code, e.g. "+8801712345678" —
  the register/edit forms populate this from a country-code dropdown + a
  local-number box; js/country-codes.js does the joining/splitting)

contactRequests/{fromUid}_{toUid}
  fromUid, toUid, purpose, message,
  status: "pending" | "approved" | "rejected",
  createdAt, decidedAt

admins/{uid}
  (doc just needs to exist — presence = admin)
```

Keeping `admins/{uid}` as its own collection (rather than a field on the user doc) means a compromised or buggy client can never write itself into admin status — only you, editing it by hand in the console, can.

Contact-request docs are named `{fromUid}_{toUid}` on purpose — it lets both the app code and the security rules look up "does a request already exist between these two people" without needing a query.

**`previousApproved`**: the first time someone edits a profile that's currently *approved*, `js/profile.js` copies the still-live values into this field before overwriting them, and flips `status` back to `pending` as before. The admin queue (`js/admin.js`) diffs `previousApproved` against the incoming pending values and shows a "What changed since last approval" list on that review card, so an admin doesn't have to guess what was edited. The moment an admin approves the new version, `js/admin.js` deletes this field — the approved data becomes the new baseline, and the field never lingers around once the doc is public-readable again.

## 5. Security rules (the most important part)

### Firestore rules

Console → Firestore Database → **Rules** → paste in the full contents of `firestore.rules` from this repo (it's kept in sync with what the app actually needs — including validation for the `previousApproved` diff snapshot, notification docs, and the "resubmit for review" transition — rather than duplicated here where it could drift out of date).

Test every rule change in the Rules Playground before deploying — it lets you simulate a request as a specific (or anonymous) user and see whether it's allowed, without needing real user accounts to test with.

Photo uploads go through Cloudinary (§3b) instead of Firebase Storage, so there are no Storage rules to write — Cloudinary's unsigned upload preset handles file-type/size limits on its end.

## 6. The admin panel

- `admin.html` is **not linked** from the navbar or footer anywhere in the site. "Not linked" only means "not discoverable by browsing" — it does not mean secure on its own; anyone could still guess the URL.
- The real protection is the `isAdmin()` check baked into the rules above: even if someone loads `admin.html`, `auth-guard.js` will bounce them to the homepage unless their uid exists in the `admins` collection, and every Firestore read/write the page attempts will also be rejected by the rules regardless of what the client-side JS does.
- **To make yourself an admin:** register a normal account first, find your uid in **Authentication → Users**, then go to **Firestore → Data** and manually create a document at `admins/{your-uid}` (the document can be empty — its existence is the check).

## 7. Deploying on GitHub Pages

1. Push this folder to your `Alumni-IUBAT` GitHub repo.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → pick `main` and `/root`.
3. Your site will be live at `https://yourusername.github.io/Alumni-IUBAT/`.
4. Because it's a project repo (not a `username.github.io` root repo), the site lives under the `/Alumni-IUBAT/` path — every internal link and asset reference must stay relative (`css/style.css`, not `/css/style.css`). All the files here already use relative paths, so they work as-is.
5. In **Firebase Console → Authentication → Settings → Authorized domains**, add `yourusername.github.io` — Firebase authorizes by domain, not by path, so this automatically covers the `/Alumni-IUBAT/` subpath.
6. If you want a custom domain later, add a `CNAME` file in the repo root and point your DNS at GitHub Pages' IPs — GitHub's docs walk through the exact records.

## 8. Suggested build/test order

1. Firebase project + rules (§2–5) — get security right before real user data exists.
2. Cloudinary account + unsigned preset (§3b) — needed before registration photo uploads will work.
3. `register.html` / `login.html` — create an account, confirm it lands as `status: "pending"`.
4. Manually add yourself to `admins/{uid}`, open `admin.html`, approve your own test account.
5. `alumni.html` — confirm your approved profile shows up, search works.
6. Send yourself a contact request from a second test account, approve/reject it from `my-profile.html`, and confirm the 30-day cooldown message appears after a rejection.
7. `my-profile.html` — edit job history, toggle phone/WhatsApp visibility, re-save.

## 9. Before you consider it "done"

- [ ] Firestore rules from `firestore.rules` deployed in production mode, tested in the Rules Playground
- [ ] Cloudinary unsigned upload preset created and its cloud name/preset pasted into `js/cloudinary.js`
- [ ] Sensitive fields (email, phone, whatsapp, socials) live in `alumni/{uid}/private/contact`, never in the public doc
- [ ] `admins` collection is manually managed in the console, not writable by any client
- [ ] Authentication → Sign-in method has both **Email/Password** and **Phone** enabled
- [ ] Authorized domains list in Firebase Auth matches your real deployed URL (needed for both login redirects and the invisible reCAPTCHA used by phone verification)
- [ ] EmailJS OTP template created with an `{{otp_code}}` variable, and its id pasted into `EMAILJS_OTP_TEMPLATE_ID` in `js/otp-verify.js`
- [ ] `js/firebase-config.js` has your real project values (not the placeholders)
- [ ] No API keys other than the public Firebase web config and Cloudinary cloud name appear anywhere in the code
- [ ] Registered a fresh test account end-to-end and confirmed the "verify your contact info" dialog actually requires both a real email code and a real SMS code before the account gets created
- [ ] Edited an already-approved test profile and confirmed the admin queue shows a "What changed since last approval" list on that card
